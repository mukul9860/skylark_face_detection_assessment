FROM node:18 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:stable-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/nginx.conf

CMD ["/bin/sh",  "-c",  "envsubst < /etc/nginx/conf.d/nginx.conf > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]