FROM node:16.16.0

WORKDIR /projects/jamesSnake/api

COPY package.json ./

RUN yarn

COPY . .

RUN yarn build

CMD ["yarn", "start:prod"]
