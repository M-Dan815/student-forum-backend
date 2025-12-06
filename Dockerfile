FROM node:22

WORKDIR /app

COPY package*.json ./

# This line is the important part
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
