# Network and RPC Architecture

## Overview
The network module provides a robust and fault-tolerant system for managing connections to multiple blockchain networks (Asset Hub, HydraDX) using both Polkadot-JS API and PAPI (Polkadot API). The architecture is designed to handle various failure scenarios, network interruptions, and system events while maintaining connection stability.

## Architecture Components

### 1. Connection Manager (`ConnectionManager.ts`)
The central orchestrator for all network connections, implementing:
- Singleton pattern for global connection management
- Connection state tracking for multiple networks
- Automatic reconnection with exponential backoff
- Error handling and recovery strategies

```typescript
// Usage example
const manager = ConnectionManager.getInstance();
await manager.initialize(); // Sets up connections to all networks
const api = manager.getHydradxApi(); // Get HydraDX connection
```

### 2. RPC Connection (`Rpc/RpcConnection.ts`)
Handles individual RPC connections with:
- Support for both Polkadot-JS and PAPI implementations
- Connection lifecycle management
- Timeout handling
- Event-based connection monitoring

### 3. RPC Endpoint Manager (`Rpc/RpcEndpointManager.ts`)
Manages multiple RPC endpoints per network:
- Health checking of endpoints
- Round-robin endpoint rotation
- Priority-based endpoint selection
- Automatic failover to healthy endpoints

### 4. Type System (`types.ts`)
Provides type safety and runtime validation:
- Network type definitions
- Chain descriptor mappings
- Type guards for connection types
- Generic connection creators

## Connection Flow

1. **Initialization**
   ```
   ConnectionManager
   ├─> Initialize endpoints
   ├─> Setup health checks
   └─> Establish initial connections
   ```

2. **Health Monitoring**
   ```
   RpcEndpointManager
   ├─> Regular health checks
   ├─> Endpoint status updates
   └─> Automatic failover
   ```

3. **Error Recovery**
   ```
   Connection Error
   ├─> Attempt reconnection
   ├─> Exponential backoff
   └─> Switch endpoints if needed
   ```

## Fault Tolerance Features

### 1. Connection Recovery
- Automatic reconnection attempts
- Configurable retry limits
- Exponential backoff with jitter
- Connection state preservation

### 2. Endpoint Management
- Multiple endpoints per network
- Priority-based endpoint selection
- Health-based endpoint rotation
- Automatic failover to healthy endpoints

### 3. Error Handling
- Graceful error recovery
- Detailed error logging
- Connection state tracking
- Resource cleanup on failures

## Configuration

### Network Configuration
```typescript
// Example configuration in constants.ts
export const RPC_ENDPOINTS = {
  ASSET_HUB: {
    endpoints: [
      { url: 'wss://primary-endpoint', priority: 1 },
      { url: 'wss://backup-endpoint', priority: 2 }
    ],
    healthCheck: {
      interval: 60000,  // 1 minute
      timeout: 5000     // 5 seconds
    }
  }
};
```

### Connection Parameters
```typescript
export const CONNECTION_CONFIG = {
  MAX_RECONNECT_ATTEMPTS: 5,
  BASE_RECONNECT_DELAY: 1000,   // 1 second
  MAX_RECONNECT_DELAY: 30000,   // 30 seconds
  ATTEMPT_RESET_TIMEOUT: 30000, // 30 seconds
  CONNECTION_TIMEOUT: 15000     // 15 seconds
};
```

## Best Practices

1. **Connection Management**
   - Always use the ConnectionManager singleton
   - Handle connection cleanup properly
   - Monitor connection states

2. **Error Handling**
   - Implement proper error boundaries
   - Log connection issues
   - Handle cleanup on errors

3. **Resource Management**
   - Clean up connections when not needed
   - Monitor resource usage
   - Implement proper timeouts

## Common Scenarios

### 1. Network Interruptions
The system automatically handles:
- Temporary network outages
- Connection timeouts
- Endpoint failures

### 2. System Events
Handles various system events:
- System sleep/wake cycles
- Network connectivity changes
- Application state changes

### 3. Performance Optimization
- Connection pooling
- Resource cleanup
- State management

## Debugging

### Common Issues
1. **Connection Timeouts**
   - Check network connectivity
   - Verify endpoint health
   - Review connection parameters

2. **Reconnection Loops**
   - Check endpoint availability
   - Review reconnection parameters
   - Verify network stability

3. **Resource Leaks**
   - Monitor connection cleanup
   - Check event listener cleanup
   - Verify timeout clearing

### Logging
The system provides detailed logging for:
- Connection attempts
- Health check results
- Error conditions
- State transitions

## Future Improvements

1. **Monitoring**
   - Add detailed metrics collection
   - Implement performance tracking
   - Enhanced error reporting

2. **Optimization**
   - Connection pooling
   - Better resource management
   - Enhanced caching

3. **Features**
   - Additional network support
   - Enhanced type safety
   - Better state management 


## 06/03 : Improvements on RpcEndpointManager
Cursor ID : WebSocket Connection Error Troubleshooting

Currently, the flow works like this:

1. **Health Check System**:
   - Every 2 minutes (`HEALTH_CHECK.INTERVAL`), all endpoints are checked
   - Each endpoint gets 2 retries with exponential backoff before being marked as failed
   - Failed endpoints are marked as `isActive: false`

2. **Node Selection** (in `getEndpoint`):
```typescript
public getEndpoint(network: string): string {
    // Gets only active endpoints and sorts by priority
    const activeEndpoints = config.endpoints
      .filter(e => e.isActive)
      .sort((a, b) => a.priority - b.priority);

    // If no active endpoints, falls back to the first endpoint
    if (activeEndpoints.length === 0) {
      return config.endpoints[0].url;
    }

    // Uses round-robin between active endpoints
    config.currentIndex = (config.currentIndex + 1) % activeEndpoints.length;
    return activeEndpoints[config.currentIndex].url;
}
```

3. **Error Handling** (in `markEndpointError`):
```typescript
public markEndpointError(network: string, url: string, error: Error): void {
    // Marks endpoint as inactive
    endpoint.isActive = false;
    // Schedules reactivation after 5 minutes (HEALTH_CHECK.REACTIVATION)
    setTimeout(() => {
        endpoint.isActive = true;
    }, HEALTH_CHECK.REACTIVATION);
}
```

The current implementation has a few limitations:
1. It waits for the full timeout before switching nodes
2. The round-robin switching only happens on new connection attempts
3. There's no immediate failover when a node becomes unresponsive

Let's improve this by adding immediate failover. Here's the enhanced version:

```typescript:packages/api/services/network/Rpc/RpcEndpointManager.ts
// ... existing imports ...

interface EndpointEvent {
  network: string;
  url: string;
  error?: string;
  nextUrl?: string; // Add this for failover information
}

export class RpcEndpointManager extends EventEmitter {
  // ... existing code ...

  public getEndpoint(network: string): string {
    const config = this.networkConfigs[network];
    if (!config) {
      throw new Error(`No configuration found for network: ${network}`);
    }

    // Get active endpoints sorted by priority
    const activeEndpoints = config.endpoints
      .filter(e => e.isActive)
      .sort((a, b) => a.priority - b.priority);

    if (activeEndpoints.length === 0) {
      // If no active endpoints, try to reactivate the highest priority endpoint
      const highestPriorityEndpoint = [...config.endpoints].sort((a, b) => a.priority - b.priority)[0];
      if (!highestPriorityEndpoint) {
        throw new Error(`No endpoints available for network: ${network}`);
      }
      highestPriorityEndpoint.isActive = true;
      return highestPriorityEndpoint.url;
    }

    // Get the current endpoint
    const currentIndex = config.currentIndex % activeEndpoints.length;
    return activeEndpoints[currentIndex].url;
  }

  public async markEndpointError(network: string, url: string, error: Error): Promise<string | null> {
    const config = this.networkConfigs[network];
    if (!config) return null;

    const endpoint = config.endpoints.find(e => e.url === url);
    if (!endpoint) return null;

    // Mark current endpoint as inactive
    endpoint.isActive = false;
    endpoint.lastError = error.message;
    endpoint.lastChecked = new Date();

    // Try to find next best endpoint
    const activeEndpoints = config.endpoints
      .filter(e => e.isActive && e.url !== url)
      .sort((a, b) => a.priority - b.priority);

    let nextUrl: string | null = null;

    if (activeEndpoints.length > 0) {
      // Update the current index to point to the next best endpoint
      const nextEndpoint = activeEndpoints[0];
      config.currentIndex = config.endpoints.findIndex(e => e.url === nextEndpoint.url);
      nextUrl = nextEndpoint.url;
    } else {
      // If no active endpoints, try to reactivate the highest priority endpoint
      const highestPriorityEndpoint = [...config.endpoints]
        .filter(e => e.url !== url) // Don't reactivate the one that just failed
        .sort((a, b) => a.priority - b.priority)[0];

      if (highestPriorityEndpoint) {
        highestPriorityEndpoint.isActive = true;
        config.currentIndex = config.endpoints.findIndex(e => e.url === highestPriorityEndpoint.url);
        nextUrl = highestPriorityEndpoint.url;
      }
    }

    // Emit the error event with the next URL if available
    this.emit('endpointError', {
      network,
      url,
      error: error.message,
      nextUrl
    } as EndpointEvent);

    // Schedule reactivation after configured time
    setTimeout(() => {
      if (endpoint.lastError === error.message) {
        endpoint.isActive = true;
        endpoint.lastError = undefined;
        this.emit('endpointRecovered', {
          network,
          url
        } as EndpointEvent);
      }
    }, HEALTH_CHECK.REACTIVATION);

    return nextUrl;
  }

  // ... rest of existing code ...
```
Improved node switching behavior:

1. **Immediate Failover**:
   - When a node error occurs, `markEndpointError` immediately:
     1. Marks the current endpoint as inactive
     2. Finds the next best available endpoint (by priority)
     3. Returns the new endpoint URL
     4. Emits an event with both the error and the next URL to use

2. **Smarter Endpoint Selection**:
   - Endpoints are always sorted by priority
   - If all endpoints are down, it tries to reactivate the highest priority endpoint (except the one that just failed)
   - The system maintains the current working endpoint until it fails

3. **Recovery Process**:
   - Failed endpoints are still reactivated after 5 minutes (HEALTH_CHECK.REACTIVATION)
   - Health checks continue to run every 2 minutes to verify endpoint status
   - When an endpoint recovers, it becomes available in the pool of active endpoints

To use this improved version in your connection code, you should:

1. Handle the endpoint error
2. Get the next URL from the error handler
3. Immediately reconnect using the new URL

Example usage:
```typescript
try {
  // Your connection code
} catch (error) {
  const nextUrl = await rpcManager.markEndpointError(network, currentUrl, error);
  if (nextUrl) {
    // Immediately reconnect using nextUrl
    await connect(nextUrl);
  }
}
```

This improved version provides:
- Faster recovery from failed endpoints
- Priority-based failover
- Immediate switching to working nodes
- Better handling of all-endpoints-down scenarios

Let me know if you'd like me to show you how to integrate this with your connection handling code!
