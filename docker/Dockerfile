FROM node:20-slim as base

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.13.0 --activate

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./

# Create stage for development
FROM base as development

CMD ["pnpm", "dev"] 