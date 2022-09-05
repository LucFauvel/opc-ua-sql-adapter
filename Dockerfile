FROM node:16 as base

WORKDIR /usr/src/app

COPY package.json ./
COPY yarn.lock ./
COPY tsconfig.json ./

RUN yarn install --immutable

COPY src ./src
RUN yarn run build

FROM node:16 as production
WORKDIR /usr/src/app
COPY package.json ./
COPY yarn.lock ./
RUN yarn install --immutable --production
COPY --from=base /usr/src/app/dist .
CMD ["node", "index.js"]