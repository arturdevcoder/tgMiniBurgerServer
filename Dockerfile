FROM oven/bun:1-alpine
WORKDIR /app

# Copy dependency manifests
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

# Copy application source code
COPY . .

# Set default environment variables
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
