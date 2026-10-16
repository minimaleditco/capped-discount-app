FROM node:22-alpine AS base
WORKDIR /app

# Step 1: Install dependencies
FROM base AS dependencies
WORKDIR /app
COPY package.json ./
RUN npm install

# Step 2: Build production assets
FROM base AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Step 3: Production runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=dependencies /app/package.json ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/app ./app
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/shopify.app.toml ./

EXPOSE 3000

CMD ["npm", "run", "start"]
