# Build da API a partir da raiz do monorepo:
#   docker build -f apps/api/Dockerfile -t madepinus-api .

FROM node:20-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm install --omit=optional

FROM deps AS build
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace @cortemadepinus/shared \
  && npm run build --workspace @cortemadepinus/api

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api
RUN mkdir -p /dados/uploads
EXPOSE 4000

# Aplica as migracoes e garante o usuario administrador antes de subir.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts; node dist/index.js"]
