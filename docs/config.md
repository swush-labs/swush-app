# Environment Configuration

## 🏗️ **Architecture Overview**

With nginx handling SSL termination:
```
Client (HTTPS) → Nginx (SSL Termination) → Node.js App (HTTP)
```

Your Node.js application only needs to run HTTP internally.

## Local Development Environment

Create a `.env.local` file in the root directory:

```env
# API Configuration
NEXT_PUBLIC_API_HOST=localhost
NEXT_PUBLIC_API_PORT=3001
NEXT_PUBLIC_USE_HTTPS=false

# Backend Configuration  
NODE_ENV=development
PORT=3001
```

## Dev Staging Environment (with Nginx)

Create a `.env.dev` file in the root directory:

```env
# API Configuration  
NEXT_PUBLIC_API_HOST=dev.swush.me
NEXT_PUBLIC_USE_HTTPS=true

# Backend Configuration
NODE_ENV=dev
PORT=4001
TRUST_PROXY=true

# Additional dev-specific configurations
LOG_LEVEL=debug
```

Refer restart-dev.sh for more details.

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


## 🔧 **Nginx Configuration Example**
Refer to [nginx.md](./ci/nginx.md) for the nginx configuration.

### Domain Configuration
- **Development**: `localhost:3000` and `localhost:3001`
- **Dev Staging**: `dev.swush.me` (both UI and API)
- **Production**: `app.swush.me` (UI) and `api.swush.me` (API)

### Port Configuration
- **Frontend (Next.js)**: Port 3000
- **Backend (Express API)**: Port 3001
- **Nginx**: Handles HTTPS termination and proxying

## 🚨 **Important Notes**

1. **Nginx Configuration**: Ensure nginx is configured for `dev.swush.me` before starting staging
2. **SSL Certificates**: Staging and production need valid SSL certificates
3. **Environment Variables**: Always use the correct `.env` file for each environment
4. **Log Files**: 
   - Dev staging logs: `dev-output.log`
   - Production logs: `output.log`
5. **Process Management**: Use the provided scripts to avoid port conflicts