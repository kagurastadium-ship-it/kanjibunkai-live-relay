FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY relay.mjs server.mjs relay.test.mjs render.yaml README.md Dockerfile LICENSE THIRD_PARTY_NOTICES.md ./
ENV HOST=0.0.0.0 PORT=8080 NODE_ENV=production
USER node
EXPOSE 8080
CMD ["node","server.mjs"]
