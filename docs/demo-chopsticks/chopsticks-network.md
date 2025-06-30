Chat name : Setup dev staging environment for testing

## 🚀 **Concise Reconnection Solution**

### **What I Added:**

#### **1. Automatic Reconnection:**
- **Health Monitoring**: Checks connection every 30 seconds
- **Auto-Retry**: Up to 5 reconnection attempts  
- **Exponential Backoff**: 2s → 4s → 8s → 16s → 32s delays
- **Silent Recovery**: Reconnects without user intervention

#### **2. Smart Connection Handling:**
- **Endpoint Fallback**: Tries both Asset Hub (3421) and Hydration (3422) ports
- **Faster Timeouts**: 3-second timeout per endpoint (faster failure detection)
- **Graceful Degradation**: Continues if at least one endpoint works

#### **3. Better UX:**
- **Status Updates**: "Reconnecting Chopsticks..." during attempts
- **No Spam**: Maintains single toast ID for clean notifications
- **Transparent**: Console logs for debugging but silent for users

### **How It Works:**

```
App Starts → Verify Chopsticks → Start Health Monitor (30s interval)
    ↓                                       ↓
Connected ←------- Connection Lost ← Health Check Fails
    ↓                    ↓
Continues Working    Auto-Reconnect (with exponential backoff)
```

### **Demo Benefits:**
✅ **Hands-off**: Reconnects automatically when RPC endpoints fail  
✅ **Resilient**: Handles the `wss://rpc.hydradx.cloud` disconnections  
✅ **User-friendly**: Transparent reconnection without interrupting demo  
✅ **Reliable**: Falls back between endpoints, retries with smart delays  
✅ **Clean**: Single status indicator, no notification spam  

Now when `wss://rpc.hydradx.cloud` disconnects (like in your logs), chopsticks will automatically reconnect using the fallback endpoints from your `hydration.yml` config! Perfect for smooth demo experience! 🎉

# Chopsticks Demo Environment

## 🎯 **Docker-Based Solution for Beta Testing**

### **Overview:**
The demo environment now uses a simple, reliable Docker-based approach optimized for temporary beta testing. Docker Compose manages the chopsticks process lifecycle, while the UI only performs health checks and basic restart functionality.

### **How It Works:**

#### **1. Docker-Managed Process:**
- **Docker Compose**: Builds and runs chopsticks in a container
- **Auto-Restart**: `restart: unless-stopped` ensures chopsticks stays running
- **Health Checks**: Built-in Docker health monitoring with TCP port checks
- **Volume Mounting**: Configuration files mounted from `./packages/chopsticks/config`

#### **2. Simple UI Integration:**
- **Health Check**: UI calls `/api/chopsticks/health` to verify WebSocket endpoints
- **Restart**: UI calls `/api/chopsticks/restart` → `docker compose restart chopsticks`
- **Status Display**: Clean status indicators without complex state management

#### **3. Cross-Platform Compatibility:**
- **Docker Desktop**: Works on Windows, Mac, and Linux
- **Container Isolation**: No native process management or platform-specific commands
- **Consistent Environment**: Same chopsticks runtime regardless of host OS

### **User Flow:**

```
User Opens UI → Health Check → Decision
    ↓                ↓           ↓
    ↓        ✅ Healthy     ❌ Unhealthy  
    ↓            ↓              ↓
    ↓    "Demo ready!"   Docker Restart
    ↓     (Continue)       (Auto-fix)
    ↓            ↓              ↓
    ↓        Connected ← Connected
    ↓                ↓
Demo Ready ←-------- Health Monitor (30s)
```

### **Key Benefits:**

✅ **Reliable**: Docker handles process lifecycle, restart, and health checks  
✅ **Simple**: ~50 lines of code vs 300+ lines of complex process management  
✅ **Cross-Platform**: Works on Windows, Mac, Linux via Docker Desktop  
✅ **Self-Healing**: Docker auto-restarts on failure, UI can trigger manual restart  
✅ **Fast Setup**: No complex reconnection logic or exponential backoff  
✅ **Beta-Ready**: Perfect for temporary testing environment  

### **Technical Stack:**

- **Container**: Custom Node.js Alpine image with chopsticks installed
- **Health Check**: TCP port connectivity test (3421, 3422)
- **API Endpoints**: Simple health check and restart via Docker Compose
- **UI Service**: Minimal health monitoring and status display

### **Status Messages:**

- 🔍 **"Checking demo environment..."** - Initial health check
- ✅ **"Demo environment ready!"** - Healthy chopsticks found
- 🆕 **"Demo environment started!"** - Docker restart successful
- 🔴 **"Demo environment unavailable"** - Health check failed

### **Files Structure:**

```
docker-compose.dev.yml          # Docker service definition
packages/chopsticks/Dockerfile  # Custom chopsticks container
apps/web/src/app/api/chopsticks/
  ├── health/route.ts           # Health check endpoint
  └── restart/route.ts          # Docker restart endpoint
apps/web/src/services/
  └── ChopsticksService.ts      # Simplified UI service
```

### **Commands:**

```bash
# Start chopsticks (development)
docker compose -f docker-compose.dev.yml up -d chopsticks

# Restart chopsticks
docker compose -f docker-compose.dev.yml restart chopsticks

# Check logs
docker compose -f docker-compose.dev.yml logs chopsticks

# Stop chopsticks
docker compose -f docker-compose.dev.yml down chopsticks

# Rebuild if needed
docker compose -f docker-compose.dev.yml up -d --build chopsticks
```

This approach eliminates 90% of the complexity while providing a stable, self-healing demo environment perfect for beta testing! 🚀

## Clean Up

```bash

# Remove containers and images (optional)
docker compose -f docker-compose.dev.yml down --rmi all

# Remove all containers and images
docker compose -f docker-compose.dev.yml down --volumes --remove-orphans

# Build again without cache
docker compose -f docker-compose.dev.yml build --no-cache chopsticks
```
