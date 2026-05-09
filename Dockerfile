# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3, sharp)
RUN apk add --no-cache libc6-compat python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .

# Build the Next.js application
# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Install runtime dependencies for native modules
RUN apk add --no-cache libc6-compat

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from the build stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh

# Ensure storage and sqlite files are writable by the nextjs user
RUN mkdir -p storage && chown -R nextjs:nodejs /app
RUN apk add --no-cache imagemagick \
    libjpeg62-turbo \
    libpng16-16 \
    libwebp7 \
    file \
    && rm -rf /var/lib/apt/lists/*
RUN ln -s "$(which convert)" /usr/local/bin/magick

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "start"]
