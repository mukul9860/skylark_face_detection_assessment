mkdir -p /usr/share/nginx/html

echo "{\"VITE_API_BASE_URL\":\"${VITE_API_BASE_URL}\"}" > /usr/share/nginx/html/config.json

nginx -g 'daemon off;'