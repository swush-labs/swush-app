# Environment Configuration

## 🏗️ **Architecture Overview**

With nginx handling SSL termination:
```
Client (HTTPS) → Nginx (SSL Termination) → Node.js App (HTTP)
```

Your Node.js application only needs to run HTTP internally.

## Development Environment

Create a `.env.development` file in the root directory:

```env
# API Configuration
NEXT_PUBLIC_API_HOST=localhost
NEXT_PUBLIC_API_PORT=3001
NEXT_PUBLIC_USE_HTTPS=false

# Backend Configuration  
NODE_ENV=development
PORT=3001
```

## Production Environment (with Nginx)

Create a `.env.production` file in the root directory:

```env
# API Configuration  
NEXT_PUBLIC_API_HOST=app.swush.me
NEXT_PUBLIC_USE_HTTPS=true

# Backend Configuration
NODE_ENV=production
PORT=3001
TRUST_PROXY=true
```

## Environment Variable Reference

### Frontend Variables (NEXT_PUBLIC_*)
- `NEXT_PUBLIC_API_HOST`: API server hostname 
  - Development: `localhost`
  - Production: `app.swush.me`
- `NEXT_PUBLIC_API_PORT`: HTTP port for development (default: `3001`)
- `NEXT_PUBLIC_USE_HTTPS`: Enable HTTPS for API calls 
  - Development: `false` 
  - Production: `true`

### Backend Variables
- `NODE_ENV`: Environment mode (`development`/`production`)
- `PORT`: HTTP server port (default: `3001`)
- `TRUST_PROXY`: Trust nginx proxy headers (`true` in production)

## 🚀 **Quick Start Commands**

### Development (HTTP only)
```bash
cp .env.development .env
pnpm dev
```

### Production (with Nginx SSL)
```bash
cp .env.production .env
pnpm start
```

## 🔧 **Nginx Configuration Example**
Refer to [nginx.md](./ci/nginx.md) for the nginx configuration.

## ✅ **Benefits of This Setup**

1. **Simplicity**: Node.js app is just HTTP
2. **Performance**: Nginx handles SSL efficiently
3. **Security**: Only nginx needs certificate access
4. **Scalability**: Easy to add load balancing
5. **Maintenance**: Standard nginx SSL management