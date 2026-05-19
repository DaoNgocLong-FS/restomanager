const Minio = require('minio');
const crypto = require('crypto');
const path = require('path');

const endPoint  = process.env.MINIO_ENDPOINT   || 'minio';
const port      = parseInt(process.env.MINIO_PORT) || 9000;
const useSSL    = (process.env.MINIO_USE_SSL === 'true');
const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';
const BUCKET    = process.env.MINIO_BUCKET     || 'restaurant';
const PUBLIC_URL = process.env.MINIO_PUBLIC_URL || `http://localhost:9000`;

const client = new Minio.Client({ endPoint, port, useSSL, accessKey, secretKey });

async function initStorage(maxRetries = 30, delayMs = 2000) {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const exists = await client.bucketExists(BUCKET).catch(() => false);
      if (!exists) {
        await client.makeBucket(BUCKET, 'us-east-1');
        console.log(`✅ MinIO bucket '${BUCKET}' đã được tạo`);
      } else {
        console.log(`✅ MinIO bucket '${BUCKET}' đã tồn tại`);
      }
      // Public read policy (anyone can read objects)
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${BUCKET}/*`],
          },
        ],
      };
      try { await client.setBucketPolicy(BUCKET, JSON.stringify(policy)); } catch (_) {}
      return;
    } catch (err) {
      console.log(`⏳ MinIO chưa sẵn sàng (${i}/${maxRetries})... ${err.message}`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  console.warn('⚠️  Không thể khởi tạo MinIO — upload sẽ thất bại');
}

/**
 * Upload buffer to MinIO. Returns { key, url }.
 */
async function uploadBuffer(buffer, originalName, mimeType, prefix = 'menu') {
  const ext = path.extname(originalName || '').toLowerCase() || '';
  const key = `${prefix}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  await client.putObject(BUCKET, key, buffer, buffer.length, {
    'Content-Type': mimeType || 'application/octet-stream',
  });
  return {
    key,
    url: `${PUBLIC_URL}/${BUCKET}/${key}`,
  };
}

async function deleteObject(key) {
  if (!key) return;
  try { await client.removeObject(BUCKET, key); } catch (e) { console.warn('removeObject:', e.message); }
}

module.exports = { client, initStorage, uploadBuffer, deleteObject, BUCKET, PUBLIC_URL };
