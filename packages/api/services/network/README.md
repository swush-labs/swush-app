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