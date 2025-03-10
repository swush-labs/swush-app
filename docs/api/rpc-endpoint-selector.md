1. **RPC Configuration (`rpc-config.ts`)**:
   - Type-safe configuration using Zod schemas
   - Default endpoints for each network
   - Health check settings
   - Priority-based endpoint selection

2. **RPC Endpoint Manager (`RpcEndpointManager.ts`)**:
   - Singleton pattern for global state
   - Health checks for endpoints
   - Round-robin endpoint selection
   - Error handling and recovery
   - Event-based communication

3. **Connection Manager Integration**:
   - Uses RPC Endpoint Manager for endpoint selection
   - Automatic failover on connection errors
   - Proper cleanup on disconnect
   - Event-based reconnection

Key features:
1. **Automatic Failover**:
   - If an endpoint fails, automatically tries the next one
   - Endpoints are prioritized by their priority setting
   - Failed endpoints are temporarily disabled

2. **Health Monitoring**:
   - Regular health checks every 30 seconds
   - Automatic recovery after 5 minutes
   - Event-based notifications for errors and recovery

3. **Simple but Effective**:
   - Easy to maintain and understand
   - No complex metrics or scoring
   - Clear separation of concerns


#### Health Check logic


1. **HEALTH_CHECK.INTERVAL** (2 minutes):
```typescript
INTERVAL: 2 * 60 * 1000    // Check every 2 minutes
```
- This is how often we actively check if each RPC endpoint is healthy
- Every 2 minutes, the system will try to establish a WebSocket connection to each endpoint
- Think of it like a regular "heartbeat" check to ensure endpoints are still responsive
- Example: If an endpoint goes down at 10:00:00, we'll detect it by 10:02:00 at the latest

2. **HEALTH_CHECK.TIMEOUT** (10 seconds):
```typescript
TIMEOUT: 10 * 1000         // 10 seconds timeout for health checks
```
- This is how long we wait for each individual health check attempt to complete
- If an endpoint doesn't respond within 10 seconds during a health check, we mark it as failed
- This prevents hanging on unresponsive endpoints
- Example: When checking an endpoint, if it doesn't establish a connection within 10 seconds, we consider it unhealthy

3. **HEALTH_CHECK.REACTIVATION** (10 minutes):
```typescript
REACTIVATION: 10 * 60 * 1000 // Reactivate after 10 minutes
```
- After an endpoint fails (either through health check or actual usage), we wait this long before trying it again
- This prevents constantly trying to use a potentially problematic endpoint
- Gives time for temporary issues to resolve
- Example: If an endpoint fails at 10:00:00, we won't try to use it again until 10:10:00

Here's a practical example of how they work together:
```
Timeline Example:
10:00:00 - Regular health check starts (INTERVAL)
10:00:10 - Endpoint A doesn't respond (TIMEOUT reached)
10:00:11 - Endpoint A marked as inactive
10:10:11 - Endpoint A becomes eligible for use again (REACTIVATION)
10:12:00 - Next health check starts (INTERVAL)
```

The relationship between these values is important:
- TIMEOUT (10s) < INTERVAL (2m): Ensures health checks complete before the next one starts
- REACTIVATION (10m) > INTERVAL (2m): Gives failed endpoints enough "cool down" time
- REACTIVATION (10m) > TIMEOUT (10s): Ensures proper recovery window after failure

