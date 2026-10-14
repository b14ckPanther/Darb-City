# Darb API (Railway). Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:22.23.3-bookworm-slim@sha256:REPLACE_WITH_PRINTED_DIGEST AS build
WORKDIR /app
# openssl before install: Prisma picks its schema engine by the OpenSSL it finds (3.x, as at runtime).
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter=@darb/api

FROM node:22.23.3-bookworm-slim@sha256:REPLACE_WITH_PRINTED_DIGEST
WORKDIR /app
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
# Owned by node: the pre-deploy `prisma migrate deploy` runs as this user.
COPY --chown=node:node --from=build /app /app
USER node
# pnpm is fetched now, not on every pre-deploy or seed run.
RUN corepack install
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
