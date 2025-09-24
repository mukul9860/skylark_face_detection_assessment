FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN echo "VITE_API_BASE_URL=${VITE_API_BASE_URL}" > .env.production
RUN echo "VITE_WORKER_URL=${VITE_WORKER_URL}" >> .env.production
RUN echo "VITE_MEDIAMTX_URL=${VITE_MEDIAMTX_URL}" >> .env.production
RUN npm run build

FROM nginx:stable-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/
CMD ["nginx", "-g", "daemon off;"]