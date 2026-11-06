FROM node:22-slim
# git: algumas dependências do Baileys são baixadas do GitHub.
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
ENV NODE_ENV=production BOT_DATA_DIR=/data
VOLUME /data
CMD ["npm", "start"]
