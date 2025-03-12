# Architecture Overview

## System Architecture

The application consists of two main components:
1. Next.js Web Application (`apps/web`)
2. Polkadot API Server (`packages/api`)

## API Server Architecture

The API server is built using Express.js and integrates with multiple Polkadot-based chains using PAPI (Polkadot API) and Polkadot JS API.

### Supported Chains

The API server connects to multiple chains:
- Polkadot Asset Hub
- Hydration Network

Configuration for these chains can be found in `.papi/polkadot-api.json`.

### API Endpoints

The API server exposes RESTful endpoints for interacting with the blockchain networks:

#### Asset Management

```typescript
POST /api/v1/assets/find-route
- Query params: fromAsset, toAsset, amountIn, dex
- Finds the best route for a given asset transfer

GET /api/v1/assets
- Returns list of all assets across asset hub and hydradx
```

#### Balance Management

```typescript
GET /api/v1/assets/balance/:address/:assetId
- Query params: address, assetId
- Returns asset balances for a given account

```

### Security Features

The API implements several security measures:
- Rate limiting via `express-rate-limit`
- Security headers via `helmet`
- CORS protection
- Input validation using `zod`

Backend services overview can be found in the [Backend Services docs](./BACKEND_SERVICES.md).