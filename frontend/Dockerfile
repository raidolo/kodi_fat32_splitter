# Build stage
FROM node:20-slim as build-stage
WORKDIR /app
COPY package*.json ./
RUN yarn config set network-timeout 300000 && \
    yarn install
COPY . .
RUN yarn build

# Production stage
FROM nginx:alpine
RUN apk add --no-cache gettext
COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
