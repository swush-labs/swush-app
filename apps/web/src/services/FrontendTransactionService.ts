import { PolkadotSigner } from 'polkadot-api';
import { TransactionStatus, TransactionCallbacks, TxOptions } from './types';
import { TransactionErrorService, EnhancedError } from './TransactionErrorService';

// Use PolkadotSigner type directly instead of our custom interface
type Signer = PolkadotSigner;

export class FrontendTransactionService {

    static async estimateFees(
        transaction: any,
        address: string,
        options?: TxOptions
    ): Promise<bigint> {
        try {
            return await transaction.getEstimatedFees(address, options);
        } catch (error) {
            throw TransactionErrorService.handleTransactionError(error);
        }
    }

    static async signAndSubmit(
        transaction: any,
        signer: Signer,
        options?: TxOptions
    ): Promise<string> {
        try {
            return await transaction.sign(signer, options);
        } catch (error) {
            throw TransactionErrorService.handleTransactionError(error);
        }
    }

    static async signSubmitAndWatch(
        transaction: any,
        signer: Signer,
        callbacks?: TransactionCallbacks,
        options?: TxOptions
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            // Track if error has been handled to prevent duplicates
            let errorHandled = false;
            
            try {
                const subscription = transaction.signSubmitAndWatch(signer, options).subscribe({
                    next: (event: any) => {
                        // Base status object that will be enhanced based on event type
                        const baseStatus: TransactionStatus = {
                            type: event.type,
                            txHash: event.txHash,
                        };

                        switch (event.type) {
                            case 'signed':
                                callbacks?.onStatusChange?.({
                                    ...baseStatus,
                                    success: true,
                                });
                                break;

                            case 'broadcasted':
                                callbacks?.onStatusChange?.({
                                    ...baseStatus,
                                    success: true,
                                });
                                break;

                            case 'txBestBlocksState':
                                if (event.found) {
                                    const status: TransactionStatus = {
                                        ...baseStatus,
                                        blockNumber: event.block.number,
                                        blockHash: event.block.hash,
                                        success: event.ok,
                                    };

                                    if (!event.ok && event.dispatchError) {
                                        const errorInfo = TransactionErrorService.parseDispatchError(event.dispatchError);
                                        status.error = errorInfo.message;
                                        
                                        if (!errorHandled) {
                                            errorHandled = true;
                                            const error = TransactionErrorService.createErrorFromDispatchInfo(errorInfo);
                                            callbacks?.onError?.(error);
                                        }
                                    }

                                    callbacks?.onStatusChange?.(status);
                                }
                                break;

                            case 'finalized':
                                const finalStatus: TransactionStatus = {
                                    ...baseStatus,
                                    blockNumber: event.block?.number,
                                    blockHash: event.block?.hash,
                                    success: event.ok,
                                    events: event.events
                                };

                                callbacks?.onStatusChange?.(finalStatus);

                                if (event.ok) {
                                    callbacks?.onSuccess?.(finalStatus);
                                    resolve();
                                } else {
                                    const errorInfo = TransactionErrorService.parseDispatchError(event.dispatchError);
                                    finalStatus.error = errorInfo.message;
                                    
                                    if (!errorHandled) {
                                        errorHandled = true;
                                        const error = TransactionErrorService.createErrorFromDispatchInfo(errorInfo);
                                        callbacks?.onError?.(error);
                                        reject(error);
                                    }
                                }
                                break;

                            default:
                                callbacks?.onStatusChange?.({
                                    ...baseStatus,
                                    success: undefined,
                                });
                        }
                    },
                    error: (error: Error) => {
                        if (!errorHandled) {
                            errorHandled = true;
                            const enhancedError = TransactionErrorService.handleTransactionError(error);
                            callbacks?.onError?.(enhancedError);
                            reject(enhancedError);
                        }
                    },
                    complete: () => {
                        console.log('Transaction subscription completed');
                    }
                });

                // Return the subscription for cleanup if needed
                return subscription;
            } catch (error) {
                if (!errorHandled) {
                    errorHandled = true;
                    const enhancedError = TransactionErrorService.handleTransactionError(error);
                    callbacks?.onError?.(enhancedError);
                    reject(enhancedError);
                }
            }
        });
    }
}