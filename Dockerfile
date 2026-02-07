# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy root and server package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies (including those for shared code if any)
RUN npm install
RUN cd server && npm install

# Copy source code
COPY src/ ./src/
COPY server/ ./server/

# Build the server
RUN cd server && npm run build

# Runtime stage
FROM node:20-slim

WORKDIR /app

# Set environment
ENV NODE_ENV=production
ENV PORT=4000

# Copy package files for runtime install
COPY package*.json ./
COPY server/package*.json ./server/

# Install production dependencies
RUN npm install --omit=dev
RUN cd server && npm install --omit=dev

# Copy compiled files from builder
COPY --from=builder /app/server/dist ./server/dist

# Expose port
EXPOSE 4000

# Start the server
# Note: The start script in server/package.json is "node dist/server/src/index.js"
WORKDIR /app/server
CMD ["npm", "run", "start"]
