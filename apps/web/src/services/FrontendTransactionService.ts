import { PolkadotSigner } from 'polkadot-api';
import { TransactionStatus, TransactionCallbacks, TxOptions } from './types';

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
            console.error('Error estimating fees:', error);
            throw new Error(`Failed to estimate fees: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
            console.error('Error signing transaction:', error);
            throw new Error(`Failed to sign transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    static async signSubmitAndWatch(
        transaction: any,
        signer: Signer,
        callbacks?: TransactionCallbacks,
        options?: TxOptions
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const subscription = transaction.signSubmitAndWatch(signer, options).subscribe({
                    next: (event: any) => {
                        console.log('Transaction event received:', event);
                        
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

                                    if (!event.ok) {
                                        const error = this.parseDispatchError(event.dispatchError);
                                        status.error = error.message;
                                        callbacks?.onError?.(error);
                                    }

                                    callbacks?.onStatusChange?.(status);
                                }
                                break;

                            case 'finalized':
                                const finalStatus: TransactionStatus = {
                                    ...baseStatus,
                                    blockNumber: event.block?.number,
                                    blockHash: event.blockHash,
                                    success: event.ok,
                                    events: event.events
                                };

                                callbacks?.onStatusChange?.(finalStatus);

                                if (event.ok) {
                                    callbacks?.onSuccess?.(finalStatus);
                                    resolve();
                                } else {
                                    const error = this.parseDispatchError(event.dispatchError);
                                    finalStatus.error = error.message;
                                    callbacks?.onError?.(error);
                                    reject(error);
                                }
                                break;

                            default:
                                // Handle any future or unknown event types
                                callbacks?.onStatusChange?.({
                                    ...baseStatus,
                                    success: undefined,
                                });
                        }
                    },
                    error: (error: Error) => {
                        console.error('Transaction subscription error:', error);
                        
                        // Enhance error handling for specific error types
                        let enhancedError = error;
                        if (error.message?.includes('1010')) {
                            enhancedError = new Error('Invalid transaction: The transaction is invalid');
                        } else if (error.message?.includes('Cancelled')) {
                            enhancedError = new Error('Transaction was cancelled by the user');
                        }

                        callbacks?.onError?.(enhancedError);
                        reject(enhancedError);
                    },
                    complete: () => {
                        console.log('Transaction subscription completed');
                    }
                });

                // Return the subscription for cleanup if needed
                return subscription;
            } catch (error) {
                console.error('Error creating transaction subscription:', error);
                const wrappedError = error instanceof Error ? error : new Error('Unknown error occurred');
                callbacks?.onError?.(wrappedError);
                reject(wrappedError);
            }
        });
    }

    private static parseDispatchError(error: any): Error {
        try {
            if (!error) return new Error('Unknown dispatch error');

            switch (error.type) {
                case 'Module':
                    return new Error(`Module Error: ${error.value.type} - ${error.value.message}`);
                case 'BadOrigin':
                    return new Error('Bad Origin');
                case 'CannotLookup':
                    return new Error('Cannot Lookup');
                case 'Other':
                    return new Error(`Other Error: ${error.value}`);
                default:
                    return new Error(`Unknown Error Type: ${error.type}`);
            }
        } catch (e) {
            return new Error('Failed to parse dispatch error');
        }
    }
}