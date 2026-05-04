// =============================================================================
//  validate(schema) – middleware kiểm tra body/query/params nhanh gọn
//  schema = { fieldName: { required, type, enum, min, max, minLength, maxLength } }
// =============================================================================
const { ApiError } = require('../utils/response');

function checkValue(field, v, rules) {
  const errs = [];
  const present = v !== undefined && v !== null && v !== '';
  if (rules.required && !present) { errs.push(`${field}: bắt buộc`); return errs; }
  if (!present) return errs; // optional & vắng → bỏ qua
  if (rules.type) {
    if (rules.type === 'number'  && (isNaN(Number(v))))                                   errs.push(`${field}: phải là số`);
    if (rules.type === 'integer' && (!Number.isFinite(Number(v)) || !Number.isInteger(Number(v)))) errs.push(`${field}: phải là số nguyên`);
    if (rules.type === 'boolean' && typeof v !== 'boolean' && v !== 'true' && v !== 'false') errs.push(`${field}: phải là boolean`);
    if (rules.type === 'array'   && !Array.isArray(v))                                    errs.push(`${field}: phải là mảng`);
    if (rules.type === 'string'  && typeof v !== 'string')                                errs.push(`${field}: phải là chuỗi`);
  }
  if (rules.enum && !rules.enum.includes(v))                              errs.push(`${field}: phải thuộc {${rules.enum.join('|')}}`);
  if (rules.min !== undefined && Number(v) < rules.min)                   errs.push(`${field}: tối thiểu ${rules.min}`);
  if (rules.max !== undefined && Number(v) > rules.max)                   errs.push(`${field}: tối đa ${rules.max}`);
  if (rules.minLength !== undefined && String(v).length < rules.minLength) errs.push(`${field}: tối thiểu ${rules.minLength} ký tự`);
  if (rules.maxLength !== undefined && String(v).length > rules.maxLength) errs.push(`${field}: tối đa ${rules.maxLength} ký tự`);
  return errs;
}

function build(source, schema) {
  return (req, _res, next) => {
    const data = req[source] || {};
    const errors = [];
    for (const [field, rules] of Object.entries(schema)) {
      errors.push(...checkValue(field, data[field], rules));
    }
    if (errors.length) return next(ApiError.validation('Dữ liệu không hợp lệ', errors));
    next();
  };
}

const validateBody   = (schema) => build('body', schema);
const validateQuery  = (schema) => build('query', schema);
const validateParams = (schema) => build('params', schema);

module.exports = { validateBody, validateQuery, validateParams };
