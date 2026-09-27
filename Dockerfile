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
