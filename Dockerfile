FROM node:22-alpine

# Install git
RUN apk add --no-cache git

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Clone qulearn-frontend repository (docker branch) and replace types-frontend.mts
RUN git clone -b docker --single-branch https://github.com/qu-learn/qulearn-frontend.git /tmp/qulearn-frontend && \
    cp /tmp/qulearn-frontend/src/utils/types.ts ./src/types-frontend.mts && \
    rm -rf /tmp/qulearn-frontend

# Expose port
EXPOSE 4000

# Start the application
CMD ["pnpm", "start"]
