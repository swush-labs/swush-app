
## Prerequisites

- Node.js >= 20.17.0 
- pnpm >= 9.13.0
- Docker & Docker Compose (for containerized development)

## Getting Started

### Local Development

1. Install dependencies:
```bash
pnpm i
```

2. Start the development servers:
```bash
# Start both web and API services
pnpm dev

```

The web application will be available at [http://localhost:3000](http://localhost:3000)
The API server will be available at [http://localhost:3001](http://localhost:3001)

### Docker Development Environment

The project includes a Docker setup for consistent development environments:

```bash
# Start all services
docker-compose up --build

# Stop services
docker compose down
```

### Environment Variables

Create a `.env` file in the root directory:

```env
NEXT_PUBLIC_API_HOST=localhost  # API host for web application
```

## Development Tools

- TypeScript for type safety
- ESLint for code linting
- Jest for testing
- PAPI for Polkadot chain interactions

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Polkadot-API Documentation](https://papi.how/)