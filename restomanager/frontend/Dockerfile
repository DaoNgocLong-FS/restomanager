FROM nginx:1.27-alpine

# Cấu hình Nginx (proxy /api -> backend, phục vụ static)
COPY nginx.conf /etc/nginx/nginx.conf

# Sao chép các file tĩnh
COPY index.html  /usr/share/nginx/html/index.html
COPY pos.html    /usr/share/nginx/html/pos.html
COPY admin.html  /usr/share/nginx/html/admin.html
COPY js          /usr/share/nginx/html/js

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
