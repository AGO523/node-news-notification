FROM node:23-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY index.js .

CMD ["npm", "start"]
