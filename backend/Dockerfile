# Use Node.js 18 slim image for a smaller footprint
FROM node:18-slim

# Install FFmpeg and CA certificates for secure cloud communication
RUN apt-get update && \
    apt-get install -y ffmpeg ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy configuration files first to leverage Docker layer caching
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install all dependencies (including devDependencies needed for the build)
RUN npm install

# Copy the rest of the source code
COPY . .

# --- BUILD OPTIMIZATION ---
# 1. Remove any existing build artifacts or cache from the host machine
# 2. Execute the NestJS build using the TSC builder for a clean, non-incremental compilation
RUN rm -rf dist *.tsbuildinfo && \
    ./node_modules/.bin/nest build --builder tsc

# Final validation: Ensure the build succeeded and main.js exists before finalizing the image
RUN if [ ! -f "dist/main.js" ]; then \
        echo "CRITICAL ERROR: dist/main.js not found!"; \
        ls -R dist; \
        exit 1; \
    fi

# Expose the application port
EXPOSE 3000

# Run the application using the compiled production build
CMD ["node", "dist/main.js"]