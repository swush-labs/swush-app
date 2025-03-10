# Architecture Overview

## System Architecture

The application consists of two main components:
1. Next.js Web Application (`apps/web`)
2. Polkadot API Server (`packages/api`)

```mermaid
    UI  --> API[Polkadot API Server]
    API --> AssetHub[Asset Hub]
    API --> Hydration[Hydration Network]
```

## API Server Architecture

The API server is built using Express.js and integrates with multiple Polkadot-based chains using PAPI (Polkadot API).

### Supported Chains

The API server connects to multiple chains:
- Polkadot Relay Chain
- Polkadot Asset Hub
- Hydration Network

Configuration for these chains can be found in `.papi/polkadot-api.json`.

### API Endpoints

The API server exposes RESTful endpoints for interacting with the blockchain networks:

#### Asset Management
```typescript
GET /api/v1/assets/balance/:address/:assetId
- Returns asset balances for a given account
- Query params: address, assetId

POST /api/v1/assets/find-route
- Finds the best route for a given asset transfer
- Query params: fromAsset, toAsset, amountIn, dex

GET /api/v1/assets
- Returns list of all assets across asset hub and hydradx
```


### Security Features

The API implements several security measures:
- Rate limiting via `express-rate-limit`
- Security headers via `helmet`
- CORS protection
- Input validation using `zod`

### WebSocket Connections

The server maintains WebSocket connections to the blockchain networks for:
- Real-time updates
- Subscription-based data
- Event monitoring


## Development Guidelines

1. **Chain Integration**
   - Use PAPI for all chain interactions
   - Maintain chain-specific types in `.papi/descriptors`
   - Keep metadata files up to date

2. **Testing**
   - Unit tests with Jest
   - TODO: Integration tests using `@acala-network/chopsticks-testing`
   - TODO: Mock chain responses when appropriate

3. **Performance**
   - Implement caching where appropriate
   - TODO: Use connection pooling for chain interactions
   - TODO: Monitor memory usage with WebSocket subscriptions
