FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
ENV VITE_PREVIEW_MOCK=1
RUN npm run build
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
RUN printf 'server {\n    listen 80;\n    server_name _;\n    root /usr/share/nginx/html;\n    index index.html;\n    gzip on;\n    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;\n    location / { try_files $uri $uri/ /index.html; }\n    location /health { access_log off; return 200 "{\"ok\":true}"; add_header Content-Type application/json; }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
