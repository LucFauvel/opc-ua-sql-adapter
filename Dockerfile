FROM node:16 as base

WORKDIR /usr/src/app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci

COPY src ./src
RUN npm run build

FROM node:16 as production
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=base /usr/src/app/dist .
CMD ["node", "index.js"]