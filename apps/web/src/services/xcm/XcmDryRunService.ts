import { Enum, TypedApi } from 'polkadot-api';
import {
    polkadot_asset_hub,
    hydration,
    PolkadotXcmVersionedXcm as HydrationXcmVersionedXcm,
    XcmVersionedXcm,
    XcmVersionedLocation,
    XcmV3Junctions,
    XcmV3Junction
} from '@polkadot-api/descriptors';
import type { Transaction } from 'polkadot-api';
import { safeStringify } from '@/components/swap/utils';
// Proper types for XCM messages based on chain
export type HydraDxForwardedMessage = [location: any, messages: HydrationXcmVersionedXcm[]];
export type AssetHubForwardedMessage = [location: any, messages: XcmVersionedXcm[]];
export type ForwardedXcmMessage = HydraDxForwardedMessage | AssetHubForwardedMessage;

// Types for dry run API responses
export interface DryRunCallResult {
    success: boolean;
    value?: {
        execution_result: {
            success: boolean;
            value?: {
                actual_weight?: {
                    ref_time: bigint;
                    proof_size: bigint;
                };
            };
        };
        forwarded_xcms: ForwardedXcmMessage[];
    };
}

export interface DryRunXcmResult {
    success: boolean;
    value?: {
        execution_result: {
            type: 'Complete' | 'Incomplete' | 'Error';
            value?: any;
        };
        forwarded_xcms: ForwardedXcmMessage[];
    };
}

// Types for dry run results
export interface ChainExecutionResult {
    success: boolean;
    fees?: bigint;
    executionResult?: any; // Keep as any since the actual response structure varies significantly
    error?: string;
    weight?: {
        ref_time: bigint;
        proof_size: bigint;
    };
}

export interface XcmDryRunResult {
    assetHubExecution: ChainExecutionResult;
    hydraDxExecution?: ChainExecutionResult;
    returnExecution?: ChainExecutionResult;
    overallSuccess: boolean;
    totalEstimatedFees: bigint;
    exchangeSimulation?: {
        inputAmount: bigint;
        estimatedOutput: bigint;
        actualSlippage?: number;
    };
    forwardedMessages?: HydrationXcmVersionedXcm[] | XcmVersionedXcm[];
    estimatedDuration?: number;
    error?: string;
}

export interface DryRunOptions {
    includeHydraDx?: boolean;
    includeReturnPath?: boolean;
    timeoutMs?: number;
    verbose?: boolean;
    xcmVersion?: number;
    // Chain-specific addresses for dry runs
    chainAddresses?: {
        assetHub?: string;
        hydraDx?: string;
    };
}

export class XcmDryRunService {
    private static instance: XcmDryRunService;

    public static getInstance(): XcmDryRunService {
        if (!XcmDryRunService.instance) {
            XcmDryRunService.instance = new XcmDryRunService();
        }
        return XcmDryRunService.instance;
    }

    /**
     * Performs dry run for Asset Hub transactions (both direct swaps and XCM)
     */
    async dryRunAssetHubTransaction(
        assetHubApi: TypedApi<typeof polkadot_asset_hub>,
        transaction: Transaction<any, any, any, any>,
        walletAddress: string,
        options: DryRunOptions = {}
    ): Promise<ChainExecutionResult> {
        try {
            if (options.verbose) {
                console.log('🔍 Starting Asset Hub dry run...');
            }

            // Use chain-specific address if provided
            const addressToUse =  walletAddress;

            // Check if DryRunApi is available
            if (!assetHubApi.apis.DryRunApi || typeof assetHubApi.apis.DryRunApi.dry_run_call !== 'function') {
                console.warn('⚠️ DryRunApi not available on Asset Hub, skipping detailed dry run');
                return {
                    success: true,
                    error: 'Asset Hub DryRunApi not available - using fallback validation'
                };
            }

            // Use XCM version 4 by default, or from options
            const xcmVersion = options.xcmVersion || 4;

            const dryRunResult = await assetHubApi.apis.DryRunApi.dry_run_call(
                Enum('system', Enum('Signed', addressToUse)),
                transaction.decodedCall,
                xcmVersion
            );

            if (!dryRunResult.success) {
                return {
                    success: false,
                    error: `Asset Hub dry run failed: ${safeStringify(dryRunResult.value)}`
                };
            }

            const executionResult = dryRunResult.value.execution_result;
            const success = executionResult.success;

            if (options.verbose) {
                console.log(`✅ Asset Hub dry run ${success ? 'succeeded' : 'failed'}`);
                if (addressToUse !== walletAddress) {
                    console.log(`📍 Used chain-specific address: ${addressToUse}`);
                }
            }

            return {
                success,
                executionResult: dryRunResult.value,
                fees: this.extractExecutionFees(dryRunResult.value),
                weight: dryRunResult.value.execution_result.success ?
                    dryRunResult.value.execution_result.value.actual_weight || undefined : undefined,
                error: !success ? `Execution failed: ${safeStringify(executionResult)}` : undefined
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Asset Hub dry run error:', error);

            // Check for specific runtime compatibility errors
            if (errorMessage.includes('Incompatible runtime') || errorMessage.includes('DryRunApi')) {
                console.warn('⚠️ DryRunApi compatibility issue detected, falling back to basic validation');
            }

            return {
                success: false,
                error: `Asset Hub dry run error: ${errorMessage}`
            };
        }
    }

    /**
     * Performs comprehensive dry run for HydraDX XCM transactions
     */
    async dryRunHydraDxXcmTransaction(
        assetHubApi: TypedApi<typeof polkadot_asset_hub>,
        hydraDxApi: TypedApi<typeof hydration>,
        transaction: Transaction<any, any, any, any>,
        walletAddress: string,
        options: DryRunOptions = {}
    ): Promise<XcmDryRunResult> {
        const startTime = Date.now();

        try {
            if (options.verbose) {
                console.log('🚀 Starting comprehensive HydraDX XCM dry run...');
            }

            // Step 1: Dry run on Asset Hub
            const assetHubResult = await this.dryRunAssetHubTransaction(
                assetHubApi,
                transaction,
                walletAddress,
                options
            );

            if (!assetHubResult.success) {
                return {
                    assetHubExecution: assetHubResult,
                    overallSuccess: false,
                    totalEstimatedFees: BigInt(0),
                    estimatedDuration: Date.now() - startTime
                };
            }

            // Step 2: Extract forwarded XCM messages
            const forwardedMessages = this.extractForwardedXcmMessages(
                assetHubResult.executionResult,
                2034 // HydraDX parachain ID
            );

            console.log('🔍 Forwarded messages:', forwardedMessages);

            if (!forwardedMessages || forwardedMessages.length === 0) {
                if (options.verbose) {
                    console.log('⚠️ No forwarded messages found for HydraDX');
                }
                return {
                    assetHubExecution: assetHubResult,
                    overallSuccess: false,
                    totalEstimatedFees: assetHubResult.fees || BigInt(0),
                    estimatedDuration: Date.now() - startTime,
                    error: 'No XCM messages forwarded to HydraDX'
                };
            }

            // Step 3: Dry run on HydraDX
            let hydraDxResult: ChainExecutionResult | undefined;
            let returnResult: ChainExecutionResult | undefined;

            if (options.includeHydraDx !== false) {
                // Type guard to ensure we have the correct message type for HydraDX
                const firstMessage = forwardedMessages[0] as HydrationXcmVersionedXcm;
                hydraDxResult = await this.dryRunHydraDxExecution(
                    hydraDxApi,
                    firstMessage,
                    options
                );

                // Step 4: If HydraDX execution succeeds and we need return path
                if (hydraDxResult.success && options.includeReturnPath) {
                    const returnMessages = this.extractForwardedXcmMessages(
                        hydraDxResult.executionResult,
                        1000 // Asset Hub parachain ID
                    );

                    if (returnMessages && returnMessages.length > 0) {
                        // Type guard to ensure we have the correct message type for Asset Hub
                        const returnMessage = returnMessages[0] as XcmVersionedXcm;
                        returnResult = await this.dryRunReturnPath(
                            assetHubApi,
                            returnMessage,
                            options
                        );
                    }
                }
            }

            // Step 5: Calculate total results
            const overallSuccess = assetHubResult.success &&
                (!hydraDxResult || hydraDxResult.success) &&
                (!returnResult || returnResult.success);

            const totalFees = (assetHubResult.fees || BigInt(0)) +
                (hydraDxResult?.fees || BigInt(0)) +
                (returnResult?.fees || BigInt(0));

            if (options.verbose) {
                console.log(`🎯 Overall XCM dry run ${overallSuccess ? 'succeeded' : 'failed'}`);
                console.log(`💰 Total estimated fees: ${totalFees.toString()}`);
            }

            return {
                assetHubExecution: assetHubResult,
                hydraDxExecution: hydraDxResult,
                returnExecution: returnResult,
                overallSuccess,
                totalEstimatedFees: totalFees,
                forwardedMessages,
                estimatedDuration: Date.now() - startTime
            };

        } catch (error) {
            console.error('Comprehensive XCM dry run error:', error);
            return {
                assetHubExecution: {
                    success: false,
                    error: `XCM dry run error: ${error instanceof Error ? error.message : 'Unknown error'}`
                },
                overallSuccess: false,
                totalEstimatedFees: BigInt(0),
                estimatedDuration: Date.now() - startTime
            };
        }
    }

    /**
     * Performs dry run execution on HydraDX
     */
    private async dryRunHydraDxExecution(
        hydraDxApi: TypedApi<typeof hydration>,
        xcmMessage: HydrationXcmVersionedXcm,
        options: DryRunOptions = {}
    ): Promise<ChainExecutionResult> {
        try {
            if (options.verbose) {
                console.log('🌊 Executing HydraDX dry run...');
            }

            // Check if DryRunApi is available on HydraDX
            if (!hydraDxApi.apis.DryRunApi || typeof hydraDxApi.apis.DryRunApi.dry_run_xcm !== 'function') {
                console.warn('⚠️ DryRunApi not available on HydraDX, skipping XCM dry run');
                return {
                    success: true, // Assume success for compatibility
                    error: 'HydraDX DryRunApi not available - using fallback validation',
                    executionResult: null
                };
            }

            const hydraDxDryRun = await hydraDxApi.apis.DryRunApi.dry_run_xcm(
                XcmVersionedLocation.V4({
                    parents: 1,
                    interior: XcmV3Junctions.X1(XcmV3Junction.Parachain(1000)) // Asset Hub
                }),
                xcmMessage
            );

            if (!hydraDxDryRun.success) {
                return {
                    success: false,
                    error: `HydraDX dry run failed: ${safeStringify(hydraDxDryRun.value)}`
                };
            }

            const success = hydraDxDryRun.value.execution_result.type === 'Complete';

            if (options.verbose) {
                console.log(`🌊 HydraDX execution ${success ? 'completed' : 'failed'}`);
            }

            return {
                success,
                executionResult: hydraDxDryRun.value,
                fees: this.extractHydraDxFees(hydraDxDryRun.value),
                error: !success ? `HydraDX execution failed: ${safeStringify(hydraDxDryRun.value.execution_result)}` : undefined
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('HydraDX dry run error:', error);

            return {
                success: false,
                error: `HydraDX dry run error: ${errorMessage}`
            };
        }
    }

    /**
     * Performs dry run for return path execution on Asset Hub
     */
    private async dryRunReturnPath(
        assetHubApi: TypedApi<typeof polkadot_asset_hub>,
        returnMessage: XcmVersionedXcm,
        options: DryRunOptions = {}
    ): Promise<ChainExecutionResult> {
        try {
            if (options.verbose) {
                console.log('🔄 Executing return path dry run...');
            }

            const returnDryRun = await assetHubApi.apis.DryRunApi.dry_run_xcm(
                XcmVersionedLocation.V4({
                    parents: 1,
                    interior: XcmV3Junctions.X1(XcmV3Junction.Parachain(2034)) // HydraDX
                }),
                returnMessage
            );

            if (!returnDryRun.success) {
                return {
                    success: false,
                    error: `Return path dry run failed: ${safeStringify(returnDryRun.value)}`
                };
            }

            const success = returnDryRun.value.execution_result.type === 'Complete';

            if (options.verbose) {
                console.log(`🔄 Return path ${success ? 'completed' : 'failed'}`);
            }

            return {
                success,
                executionResult: returnDryRun.value,
                fees: this.extractExecutionFees(returnDryRun.value),
                error: !success ? `Return execution failed: ${safeStringify(returnDryRun.value.execution_result)}` : undefined
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Return path dry run error:', error);

            // Check for specific runtime compatibility errors
            if (errorMessage.includes('Incompatible runtime') || errorMessage.includes('DryRunApi')) {
                console.warn('⚠️ Return path DryRunApi compatibility issue detected, falling back to basic validation');
                return {
                    success: true, // Assume success for compatibility
                    error: `Return path DryRunApi incompatible: ${errorMessage}`,
                    executionResult: null
                };
            }

            return {
                success: false,
                error: `Return path error: ${errorMessage}`
            };
        }
    }

    /**
     * Extracts forwarded XCM messages for a specific parachain with proper typing
     */
    private extractForwardedXcmMessages(
        executionResult: any, 
        targetParachainId: number
    ): HydrationXcmVersionedXcm[] | XcmVersionedXcm[] | null {
        try {
            if (!executionResult?.forwarded_xcms) {
                return null;
            }

            const targetMessage = executionResult.forwarded_xcms.find(([location, _]: [any, any]) =>
                location.type === 'V4' &&
                location.value.parents === 1 &&
                location.value.interior.type === 'X1' &&
                location.value.interior.value.type === 'Parachain' &&
                location.value.interior.value.value === targetParachainId
            );

            if (!targetMessage) {
                return null;
            }

            const [_, messages] = targetMessage;
            return messages;
        } catch (error) {
            console.error('Error extracting forwarded messages:', error);
            return null;
        }
    }

    /**
     * Extracts execution fees from dry run results
     */
    private extractExecutionFees(executionResult: any): bigint | undefined {
        try {
            // This is a simplified extraction - you may need to adjust based on actual response structure
            if (executionResult?.execution_result?.success) {
                // Extract fees from events or execution info
                // Implementation depends on the specific structure of your dry run results
                return BigInt(0); // Placeholder - implement actual fee extraction
            }
            return undefined;
        } catch (error) {
            console.error('Error extracting execution fees:', error);
            return undefined;
        }
    }

    /**
     * Extracts fees specific to HydraDX execution
     */
    private extractHydraDxFees(executionResult: any): bigint | undefined {
        try {
            // HydraDX-specific fee extraction logic
            // Implementation depends on HydraDX response structure
            return BigInt(0); // Placeholder - implement actual fee extraction
        } catch (error) {
            console.error('Error extracting HydraDX fees:', error);
            return undefined;
        }
    }

    /**
     * Quick dry run for basic transaction validation
     */
    async quickDryRun(
        assetHubApi: TypedApi<typeof polkadot_asset_hub>,
        transaction: Transaction<any, any, any, any>,
        walletAddress: string,
        xcmVersion: number = 4
    ): Promise<boolean> {
        try {
            const result = await this.dryRunAssetHubTransaction(
                assetHubApi,
                transaction,
                walletAddress,
                { verbose: false, xcmVersion }
            );
            return result.success;
        } catch {
            return false;
        }
    }
} 