# Use the official lightweight Bun image
FROM oven/bun:1.3-alpine AS base

# Set working directory inside the container
WORKDIR /app

# Copy lockfile and package configuration
COPY package.json bun.lock ./

# Install dependencies
RUN bun install

# Copy the rest of the server source code
COPY . .

# Port configuration (can be overridden at build time via --build-arg PORT=xxxx)
ARG PORT=5000
ENV PORT=${PORT}
EXPOSE ${PORT}

# Set production environment variables by default
ENV NODE_ENV=production

# Start the Hono server
CMD ["bun", "run", "src/main.ts"]
