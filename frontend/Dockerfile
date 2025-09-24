FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:stable-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/nginx.conf.template

CMD /bin/sh -c "envsubst '\$VITE_API_BASE_URL \$VITE_WORKER_URL \$NGINX_PROXY_URL \$NGINX_PROXY_BACKEND_URL \$NGINX_PROXY_WORKER_URL' < /etc/nginx/conf.d/nginx.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"