FROM node:18-slim

# Install ffmpeg and basics dependencies
RUN apt-get update && \
    apt-get install -y ffmpeg ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application code
COPY . .

# NestJS's build step
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/main.js"]