FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

EXPOSE 5173

CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]
