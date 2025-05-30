import { TypedApi } from 'polkadot-api';
import { polkadot_asset_hub, hydration } from '@polkadot-api/descriptors';
import type { Transaction } from 'polkadot-api';
import { FrontendConnectionManager } from '@/services/FrontendConnectionManager';
import { XcmDryRunService, XcmDryRunResult, ChainExecutionResult, DryRunOptions } from '@/services/xcm/XcmDryRunService';
import { 
  buildAssetHubTransaction,
  buildHydraDxTransaction 
} from './transactionBuilders';
import { AssetsMap } from '../types';

// Enhanced result types
export interface EnhancedTransactionResult {
  transaction: Transaction<any, any, any, any>;
  dryRunResult?: XcmDryRunResult | ChainExecutionResult;
  dexType: 'asset_hub' | 'hydra_dx';
  estimatedSuccess: boolean;
  totalEstimatedFees: bigint;
  simulationDuration?: number;
}

export interface TransactionBuildOptions {
  performDryRun?: boolean;
  dryRunOptions?: DryRunOptions;
  fallbackOnDryRunFailure?: boolean;
}

/**
 * Enhanced Asset Hub transaction builder with integrated dry run
 */
export const buildEnhancedAssetHubTransaction = async (
  assetHubApi: TypedApi<typeof polkadot_asset_hub>,
  assetsMap: AssetsMap,
  inputAssetId: string,
  outputAssetId: string,
  inputAmountPlanck: bigint,
  minOutputAmountPlanck: bigint,
  walletAddress: string,
  routePath?: string[],
  options: TransactionBuildOptions = {}
): Promise<EnhancedTransactionResult> => {
  const startTime = Date.now();
  
  try {
    // Build the base Asset Hub transaction
    const transaction = await buildAssetHubTransaction(
      assetHubApi,
      assetsMap,
      inputAssetId,
      outputAssetId,
      inputAmountPlanck,
      minOutputAmountPlanck,
      walletAddress,
      routePath
    );

    let dryRunResult: ChainExecutionResult | undefined;
    let estimatedSuccess = true; // Default to true for Asset Hub transactions
    let totalEstimatedFees = BigInt(0);

    // Perform dry run if requested
    if (options.performDryRun !== false) {
      try {
        const dryRunService = XcmDryRunService.getInstance();
        dryRunResult = await dryRunService.dryRunAssetHubTransaction(
          assetHubApi,
          transaction,
          walletAddress,
          {
            verbose: options.dryRunOptions?.verbose || false,
            timeoutMs: options.dryRunOptions?.timeoutMs || 30000,
            xcmVersion: options.dryRunOptions?.xcmVersion || 4
          }
        );

        estimatedSuccess = dryRunResult.success;
        totalEstimatedFees = dryRunResult.fees || BigInt(0);

        if (options.dryRunOptions?.verbose) {
          console.log('🔍 Asset Hub transaction dry run completed:', {
            success: estimatedSuccess,
            fees: totalEstimatedFees.toString(),
            hasCompatibilityWarning: dryRunResult.error?.includes('DryRunApi') || false
          });
        }

        // If we have a compatibility warning but success is true, log it
        if (dryRunResult.success && dryRunResult.error?.includes('DryRunApi')) {
          console.warn('⚠️ Using fallback validation due to DryRunApi compatibility:', dryRunResult.error);
        }

      } catch (error) {
        console.warn('Asset Hub dry run failed:', error);
        
        if (!options.fallbackOnDryRunFailure) {
          throw new Error(`Dry run failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Fallback: proceed without dry run data
        console.log('Falling back to transaction without dry run validation');
      }
    }

    return {
      transaction,
      dryRunResult,
      dexType: 'asset_hub',
      estimatedSuccess,
      totalEstimatedFees,
      simulationDuration: Date.now() - startTime
    };

  } catch (error) {
    console.error('Enhanced Asset Hub transaction building failed:', error);
    throw new Error(`Failed to build enhanced Asset Hub transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Enhanced HydraDX transaction builder with comprehensive XCM dry run
 */
export const buildEnhancedHydraDxTransaction = async (
  assetHubApi: TypedApi<typeof polkadot_asset_hub>,
  assetsMap: AssetsMap,
  inputAssetId: string,
  outputAssetId: string,
  inputAmountPlanck: bigint,
  minOutputAmountPlanck: bigint,
  alicePublicKey: Uint8Array,
  walletAddress: string,
  options: TransactionBuildOptions = {}
): Promise<EnhancedTransactionResult> => {
  const startTime = Date.now();
  
  try {
    // Build the base HydraDX XCM transaction
    const transaction = await buildHydraDxTransaction(
      assetHubApi,
      assetsMap,
      inputAssetId,
      outputAssetId,
      inputAmountPlanck,
      minOutputAmountPlanck,
      alicePublicKey,
      walletAddress
    );

    let dryRunResult: XcmDryRunResult | undefined;
    let estimatedSuccess = true; // Default to true
    let totalEstimatedFees = BigInt(0);

    // Perform comprehensive XCM dry run if requested
    if (options.performDryRun !== false) {
      try {
        // Get HydraDX connection for comprehensive testing
        const hydraDxConnection = await FrontendConnectionManager.getInstance().getConnection('hydra_dx');
        
        if (!hydraDxConnection || !hydraDxConnection.api) {
          throw new Error('HydraDX connection not available for dry run');
        }

        const hydraDxApi = hydraDxConnection.api as TypedApi<typeof hydration>;
        const dryRunService = XcmDryRunService.getInstance();

        // Perform comprehensive XCM dry run
        dryRunResult = await dryRunService.dryRunHydraDxXcmTransaction(
          assetHubApi,
          hydraDxApi,
          transaction,
          walletAddress,
          {
            includeHydraDx: true,
            includeReturnPath: true,
            verbose: options.dryRunOptions?.verbose || false,
            timeoutMs: options.dryRunOptions?.timeoutMs || 60000,
            xcmVersion: options.dryRunOptions?.xcmVersion || 4,
            ...options.dryRunOptions
          }
        );

        estimatedSuccess = dryRunResult.overallSuccess;
        totalEstimatedFees = dryRunResult.totalEstimatedFees;

        if (options.dryRunOptions?.verbose) {
          console.log('🚀 HydraDX XCM transaction dry run completed:', {
            overallSuccess: estimatedSuccess,
            assetHubSuccess: dryRunResult.assetHubExecution.success,
            hydraDxSuccess: dryRunResult.hydraDxExecution?.success,
            returnPathSuccess: dryRunResult.returnExecution?.success,
            totalFees: totalEstimatedFees.toString(),
            duration: dryRunResult.estimatedDuration
          });
        }

        // Log detailed results for debugging
        if (!estimatedSuccess) {
          console.warn('HydraDX XCM dry run detected potential issues:', {
            assetHubError: dryRunResult.assetHubExecution.error,
            hydraDxError: dryRunResult.hydraDxExecution?.error,
            returnError: dryRunResult.returnExecution?.error,
            generalError: dryRunResult.error
          });
        }

      } catch (error) {
        console.warn('HydraDX XCM dry run failed:', error);
        
        if (!options.fallbackOnDryRunFailure) {
          throw new Error(`XCM dry run failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Fallback: proceed without comprehensive dry run data
        console.log('Falling back to HydraDX transaction without comprehensive validation');
      }
    }

    return {
      transaction,
      dryRunResult,
      dexType: 'hydra_dx',
      estimatedSuccess,
      totalEstimatedFees,
      simulationDuration: Date.now() - startTime
    };

  } catch (error) {
    console.error('Enhanced HydraDX transaction building failed:', error);
    throw new Error(`Failed to build enhanced HydraDX transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Universal enhanced transaction builder that automatically selects the appropriate DEX
 */
export const buildEnhancedTransaction = async (
  assetHubApi: TypedApi<typeof polkadot_asset_hub>,
  assetsMap: AssetsMap,
  inputAssetId: string,
  outputAssetId: string,
  inputAmountPlanck: bigint,
  minOutputAmountPlanck: bigint,
  walletAddress: string,
  dexType: 'asset_hub' | 'hydra_dx',
  routePath?: string[],
  alicePublicKey?: Uint8Array,
  options: TransactionBuildOptions = {}
): Promise<EnhancedTransactionResult> => {
  
  if (dexType === 'asset_hub') {
    return buildEnhancedAssetHubTransaction(
      assetHubApi,
      assetsMap,
      inputAssetId,
      outputAssetId,
      inputAmountPlanck,
      minOutputAmountPlanck,
      walletAddress,
      routePath,
      options
    );
  } else {
    if (!alicePublicKey) {
      throw new Error('alicePublicKey is required for HydraDX transactions');
    }
    
    return buildEnhancedHydraDxTransaction(
      assetHubApi,
      assetsMap,
      inputAssetId,
      outputAssetId,
      inputAmountPlanck,
      minOutputAmountPlanck,
      alicePublicKey,
      walletAddress,
      options
    );
  }
};

/**
 * Quick dry run validation utility
 */
export const validateTransactionQuickly = async (
  assetHubApi: TypedApi<typeof polkadot_asset_hub>,
  transaction: Transaction<any, any, any, any>,
  walletAddress: string,
  xcmVersion: number = 4
): Promise<boolean> => {
  try {
    const dryRunService = XcmDryRunService.getInstance();
    return await dryRunService.quickDryRun(assetHubApi, transaction, walletAddress, xcmVersion);
  } catch {
    // If quick validation fails, return false to be safe
    return false;
  }
};

/**
 * Enhanced simulation result for UI consumption
 */
export interface SimulationSummary {
  willSucceed: boolean;
  estimatedFees: string; // Formatted string
  breakdown: {
    assetHub?: { success: boolean; fees?: string; error?: string };
    hydraDx?: { success: boolean; fees?: string; error?: string };
    returnPath?: { success: boolean; fees?: string; error?: string };
  };
  totalDuration?: number;
  recommendations?: string[];
}

/**
 * Creates a user-friendly simulation summary from dry run results
 */
export const createSimulationSummary = (
  result: EnhancedTransactionResult,
  inputTokenDecimals: number = 10
): SimulationSummary => {
  const formatFees = (fees: bigint | undefined): string => {
    if (!fees) return '0';
    // Simple formatting - you might want to use your existing formatAmount utility
    return (Number(fees) / Math.pow(10, inputTokenDecimals)).toFixed(6);
  };

  const summary: SimulationSummary = {
    willSucceed: result.estimatedSuccess,
    estimatedFees: formatFees(result.totalEstimatedFees),
    breakdown: {},
    totalDuration: result.simulationDuration,
    recommendations: []
  };

  // Handle Asset Hub results
  if (result.dexType === 'asset_hub' && result.dryRunResult) {
    const ahResult = result.dryRunResult as ChainExecutionResult;
    summary.breakdown.assetHub = {
      success: ahResult.success,
      fees: formatFees(ahResult.fees),
      error: ahResult.error
    };
  }

  // Handle HydraDX XCM results
  if (result.dexType === 'hydra_dx' && result.dryRunResult) {
    const xcmResult = result.dryRunResult as XcmDryRunResult;
    
    summary.breakdown.assetHub = {
      success: xcmResult.assetHubExecution.success,
      fees: formatFees(xcmResult.assetHubExecution.fees),
      error: xcmResult.assetHubExecution.error
    };

    if (xcmResult.hydraDxExecution) {
      summary.breakdown.hydraDx = {
        success: xcmResult.hydraDxExecution.success,
        fees: formatFees(xcmResult.hydraDxExecution.fees),
        error: xcmResult.hydraDxExecution.error
      };
    }

    if (xcmResult.returnExecution) {
      summary.breakdown.returnPath = {
        success: xcmResult.returnExecution.success,
        fees: formatFees(xcmResult.returnExecution.fees),
        error: xcmResult.returnExecution.error
      };
    }
  }

  // Add recommendations based on results
  if (!summary.willSucceed) {
    summary.recommendations?.push('Transaction may fail. Consider reviewing parameters.');
    
    if (summary.breakdown.assetHub && !summary.breakdown.assetHub.success) {
      summary.recommendations?.push('Asset Hub execution failed. Check asset balances and permissions.');
    }
    
    if (summary.breakdown.hydraDx && !summary.breakdown.hydraDx.success) {
      summary.recommendations?.push('HydraDX execution failed. Check liquidity and slippage tolerance.');
    }
    
    if (summary.breakdown.returnPath && !summary.breakdown.returnPath.success) {
      summary.recommendations?.push('Return path failed. Assets may be locked on HydraDX.');
    }
  }

  // Add compatibility warnings
  if (summary.breakdown.assetHub?.error?.includes('DryRunApi')) {
    summary.recommendations?.push('Using fallback validation due to runtime compatibility.');
  }

  return summary;
}; 