# Tiizi API production image (Cloud Run target, provider-neutral runtime).
# Build context is the api/ directory:
#   docker build -f api/Dockerfile -t tiizi-api ./api
# No secrets, .env files, or service-account JSON are ever copied in.

# syntax=docker/dockerfile:1
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
# test/ is copied so tsc sees the same file set as local builds and emits the
# identical dist/src layout that `npm start` uses (it is pruned afterwards).
COPY test ./test
# Compiled output lands in dist/src/*.js while migrate.ts resolves SQL from
# dist/migrations at runtime, so ship the migrations alongside the build.
RUN npm run build \
  && rm -rf dist/test \
  && mkdir -p dist/migrations \
  && cp -r migrations/. dist/migrations/

FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
# Run as the unprivileged user shipped with the official Node image.
USER node
EXPOSE 8080
# Cloud Run performs its own health checking; this only helps plain `docker run`.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||'8080')+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
# Existing compiled API entrypoint. Honors $PORT supplied by Cloud Run.
# Migrations run separately with the same image: `node dist/src/migrateCli.js`.
CMD ["node", "dist/src/index.js"]
