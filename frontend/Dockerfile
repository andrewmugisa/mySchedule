# Frontend Dockerfile — Node 20 + Vite dev server
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json .
RUN npm install

# Copy all source files
COPY . .

# Expose Vite port
EXPOSE 5174

# Run Vite dev server (proxies /api/ to backend)
CMD ["npm", "run", "dev"]
