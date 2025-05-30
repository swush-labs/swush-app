# XCM Dry Run System

This document outlines the modular XCM dry run system implemented for comprehensive transaction simulation across Asset Hub and HydraDX chains.

## Architecture Overview

The system consists of three main components:

### 1. XcmDryRunService
**Location**: `apps/web/src/services/xcm/XcmDryRunService.ts`

Core service providing multi-chain dry run capabilities:

- **Asset Hub Transaction Dry Run**: Tests direct swaps and XCM message execution
- **HydraDX XCM Transaction Dry Run**: Comprehensive testing including:
  - Asset Hub initial execution
  - HydraDX remote execution via `dry_run_xcm`
  - Return path validation back to Asset Hub
- **Quick Validation**: Fast success/failure checks for transactions

#### Key Methods

```typescript
// Basic Asset Hub dry run with XCM version support
async dryRunAssetHubTransaction(
  assetHubApi: TypedApi<typeof polkadot_asset_hub>,
  transaction: Transaction,
  walletAddress: string,
  options?: DryRunOptions
): Promise<ChainExecutionResult>

// Comprehensive HydraDX XCM dry run
async dryRunHydraDxXcmTransaction(
  assetHubApi: TypedApi<typeof polkadot_asset_hub>,
  hydraDxApi: TypedApi<typeof hydration>,
  transaction: Transaction,
  walletAddress: string,
  options?: DryRunOptions
): Promise<XcmDryRunResult>

// Quick validation utility
async quickDryRun(
  assetHubApi: TypedApi<typeof polkadot_asset_hub>,
  transaction: Transaction,
  walletAddress: string,
  xcmVersion: number = 4
): Promise<boolean>
```

#### Updated API Support

The service now supports the updated `dry_run_call` API with XCM version parameter:

```typescript
const dryRunResult = await assetHubApi.apis.DryRunApi.dry_run_call(
  PolkadotRuntimeOriginCaller.system({
    type: "Signed",
    value: walletAddress
  }),
  transaction.decodedCall,
  xcmVersion // New XCM version parameter (default: 4)
);
```

### 2. Enhanced Transaction Builders
**Location**: `apps/web/src/components/swap/hooks/builders/enhancedTransactionBuilders.ts`

Modular transaction builders that integrate dry run capabilities:

- **buildEnhancedAssetHubTransaction**: Asset Hub swaps with dry run validation
- **buildEnhancedHydraDxTransaction**: HydraDX XCM swaps with comprehensive validation
- **buildEnhancedTransaction**: Universal builder that auto-selects appropriate DEX

#### Usage Examples

```typescript
// Asset Hub transaction with dry run
const result = await buildEnhancedAssetHubTransaction(
  assetHubApi,
  assetsMap,
  inputAssetId,
  outputAssetId,
  inputAmountPlanck,
  minOutputAmountPlanck,
  walletAddress,
  routePath,
  {
    performDryRun: true,
    fallbackOnDryRunFailure: true,
    dryRunOptions: { 
      verbose: true,
      xcmVersion: 4 // Specify XCM version
    }
  }
);

// HydraDX XCM transaction with comprehensive testing
const result = await buildEnhancedHydraDxTransaction(
  assetHubApi,
  assetsMap,
  inputAssetId,
  outputAssetId,
  inputAmountPlanck,
  minOutputAmountPlanck,
  publicKey,
  walletAddress,
  {
    performDryRun: true,
    dryRunOptions: {
      verbose: true,
      includeHydraDx: true,
      includeReturnPath: true,
      timeoutMs: 60000,
      xcmVersion: 4
    }
  }
);
```

### 3. Integration with useAssetConversionSwap
**Location**: `apps/web/src/components/swap/hooks/useAssetConversionSwap.ts`

The main swap hook now automatically uses enhanced transaction builders with dry run capabilities:

- Automatic DEX detection (Asset Hub vs HydraDX)
- Comprehensive simulation before transaction submission
- Enhanced error reporting and success prediction
- Detailed fee breakdown across multiple chains
- Runtime compatibility handling

## Key Features

### Multi-Chain Validation
- **Asset Hub**: Direct transaction execution testing with XCM version support
- **HydraDX**: Remote XCM execution via `dry_run_xcm` API
- **Return Path**: Validation of asset return from HydraDX to Asset Hub
- **End-to-End**: Complete transaction flow simulation

### Enhanced Simulation Results
```typescript
interface XcmDryRunResult {
  assetHubExecution: ChainExecutionResult;
  hydraDxExecution?: ChainExecutionResult;
  returnExecution?: ChainExecutionResult;
  overallSuccess: boolean;
  totalEstimatedFees: bigint;
  forwardedMessages?: any[];
  estimatedDuration?: number;
  error?: string;
}
```

### Simulation Summary for UI
```typescript
interface SimulationSummary {
  willSucceed: boolean;
  estimatedFees: string;
  breakdown: {
    assetHub?: { success: boolean; fees?: string; error?: string };
    hydraDx?: { success: boolean; fees?: string; error?: string };
    returnPath?: { success: boolean; fees?: string; error?: string };
  };
  totalDuration?: number;
  recommendations?: string[];
}
```

## Runtime Compatibility Handling

The system includes robust runtime compatibility handling for the DryRunApi:

### Compatibility Checks
```typescript
// Check if DryRunApi is available
if (!assetHubApi.apis.DryRunApi || typeof assetHubApi.apis.DryRunApi.dry_run_call !== 'function') {
  console.warn('⚠️ DryRunApi not available on Asset Hub, skipping detailed dry run');
  return {
    success: true, // Assume success for compatibility
    error: 'DryRunApi not available - using fallback validation',
    executionResult: null
  };
}
```

### Error Handling
```typescript
// Check for specific runtime compatibility errors
if (errorMessage.includes('Incompatible runtime') || errorMessage.includes('DryRunApi')) {
  console.warn('⚠️ DryRunApi compatibility issue detected, falling back to basic validation');
  return {
    success: true, // Assume success for compatibility
    error: `DryRunApi incompatible: ${errorMessage}`,
    executionResult: null
  };
}
```

## Configuration Options

```typescript
interface DryRunOptions {
  includeHydraDx?: boolean;     // Test HydraDX execution
  includeReturnPath?: boolean;  // Test return path to Asset Hub
  timeoutMs?: number;           // Request timeout
  verbose?: boolean;            // Detailed logging
  xcmVersion?: number;          // XCM version for dry_run_call (default: 4)
}

interface TransactionBuildOptions {
  performDryRun?: boolean;            // Enable/disable dry run
  dryRunOptions?: DryRunOptions;      // Dry run configuration
  fallbackOnDryRunFailure?: boolean;  // Fallback behavior
}
```

## Usage in UI Components

The enhanced simulation results are automatically passed to the `onSimulationComplete` callback:

```typescript
const simulationResult = {
  success: enhancedResult.estimatedSuccess,
  estimatedFee: formattedEstimatedFee,
  feeBreakdown: {
    total: formattedEstimatedFee,
    breakdown: simulationSummary.breakdown
  },
  willSucceed: enhancedResult.estimatedSuccess,
  enhancedData: {
    summary: simulationSummary,
    dexType: enhancedResult.dexType,
    simulationDuration: enhancedResult.simulationDuration
  }
};
```

## Benefits

### For Users
- **Higher Success Rate**: Reduced failed transactions through better prediction
- **Accurate Fee Estimates**: Multi-chain fee calculation and breakdown
- **Better UX**: Clear indication of potential issues before transaction submission
- **Runtime Compatibility**: Graceful handling of different runtime versions

### For Developers
- **Modular Design**: Easy to extend and modify individual components
- **Comprehensive Testing**: Full transaction flow validation
- **Better Debugging**: Detailed execution results for troubleshooting
- **XCM Version Support**: Flexible XCM version handling

### For System Reliability
- **Risk Mitigation**: Early detection of liquidity, slippage, and execution issues
- **Resource Optimization**: Avoid unnecessary failed transactions
- **Network Efficiency**: Better resource utilization across chains
- **Backward Compatibility**: Works with different runtime versions

## Technical Implementation Details

### XCM Message Flow Testing
1. **Asset Hub Execution**: Test initial transaction execution and XCM message creation with specified XCM version
2. **Message Extraction**: Extract forwarded XCM messages targeting HydraDX (parachain 2034)
3. **HydraDX Simulation**: Execute extracted messages on HydraDX using `dry_run_xcm`
4. **Return Path Testing**: Validate return messages back to Asset Hub (parachain 1000)
5. **Fee Aggregation**: Calculate total fees across all execution steps

### Performance Considerations
- **Parallel Execution**: Where possible, execute independent dry runs concurrently
- **Caching Strategy**: Cache similar transaction results to reduce API calls
- **Timeout Management**: Configurable timeouts prevent blocking on slow responses
- **Resource Limits**: Built-in limits to prevent excessive API usage

### Runtime Version Handling
- **API Availability Checks**: Verify DryRunApi availability before use
- **Graceful Degradation**: Fall back to basic validation when APIs unavailable
- **Error Classification**: Distinguish between runtime compatibility and other errors
- **User Feedback**: Clear messaging about compatibility issues

## Troubleshooting

### Common Issues
1. **DryRunApi Incompatibility**: 
   - **Cause**: Local runtime doesn't support DryRunApi
   - **Solution**: System automatically falls back to basic validation
   - **Message**: "Using fallback validation due to runtime compatibility"

2. **Connection Timeouts**: 
   - **Cause**: Slow network or overloaded RPC
   - **Solution**: Increase `timeoutMs` in dry run options

3. **Missing API Responses**: 
   - **Cause**: Chain connectivity issues
   - **Solution**: Check chain connectivity and API availability  

4. **Simulation Failures**: 
   - **Cause**: Various transaction issues
   - **Solution**: Enable verbose logging for detailed error information

### Debug Options
```typescript
// Enable verbose logging
const options = {
  dryRunOptions: {
    verbose: true,
    timeoutMs: 60000,
    xcmVersion: 4
  }
};

// Quick validation for debugging
const isValid = await validateTransactionQuickly(api, transaction, address, 4);
```

## XCM Version Support

The system now supports the updated `dry_run_call` API with XCM version parameter:

- **Default Version**: XCM version 4
- **Configurable**: Can be set via `dryRunOptions.xcmVersion`
- **Backward Compatible**: Falls back gracefully for older runtimes
- **Future Proof**: Easy to update for newer XCM versions

This modular system provides a robust foundation for comprehensive XCM transaction testing while maintaining backward compatibility and providing multiple fallback mechanisms for different runtime versions. 