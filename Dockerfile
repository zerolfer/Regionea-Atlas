# syntax=docker/dockerfile:1.7

# Base Node para app web
FROM node:20-bullseye AS base
WORKDIR /app

# Dependencias JS (cacheable)
FROM base AS deps
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# Desarrollo: Vite dev server (HMR)
FROM base AS dev
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
EXPOSE 5173
CMD ["npm","run","dev","--","--host","0.0.0.0"]

# Build de producción
FROM base AS build
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
RUN npm run build

# Runtime de producción: Nginx sirviendo /dist
FROM nginx:1.27-alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx","-g","daemon off;"]

# ---------- Herramientas de teselado (tippecanoe + pmtiles) ----------
FROM debian:stable-slim AS tiles
WORKDIR /work
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git cmake libsqlite3-dev zlib1g-dev libprotobuf-dev protobuf-compiler \
    ca-certificates curl wget gdal-bin python3-gdal jq tar && rm -rf /var/lib/apt/lists/*
# Compila tippecanoe (rápido con depth=1)
# RUN git clone --depth 1 https://github.com/mapbox/tippecanoe.git \
RUN git clone --depth 1 https://github.com/felt/tippecanoe.git \
    && cd tippecanoe && make -j && make install
# Instala pmtiles CLI (ajusta versión si quieres fijarla)
ARG PMTILES_TAG=v1.28.0
RUN set -eux; \
  arch="$(uname -m)"; \
  case "$arch" in \
    x86_64)  A="x86_64" ;; \
    aarch64) A="arm64"  ;; \
    *)       A="x86_64" ;; \
  esac; \
  TAG="$(curl -fsSL https://api.github.com/repos/protomaps/go-pmtiles/releases/latest | jq -r .tag_name)"; \
  VER="${TAG#v}"; \
  ASSET="go-pmtiles_${VER}_Linux_${A}.tar.gz"; \
  URL="https://github.com/protomaps/go-pmtiles/releases/download/${TAG}/${ASSET}"; \
  echo "Downloading $URL"; \
  curl -fL "$URL" -o /tmp/${ASSET}; \
  tar -xzf /tmp/${ASSET} -C /tmp; \
  # el tar contiene un binario llamado 'pmtiles'
  install -m 0755 /tmp/pmtiles /usr/local/bin/pmtiles; \
  pmtiles version
ENTRYPOINT ["/bin/sh","-lc"]
CMD ["sleep infinity"]
