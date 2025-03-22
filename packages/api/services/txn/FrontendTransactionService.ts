/* import { Binary, TypedApi } from 'polkadot-api';
import { polkadot_asset_hub } from '@polkadot-api/descriptors';
import { FrontendConnectionManager, PapiConnection } from '../../../../apps/web/src/services/FrontendConnectionManager';
import { NETWORKS_SUPPORTED } from '../constants';
import { TransactionRequest, TransactionStatus, TransactionCallbacks, TxOptions } from './types';

// Generic signer interface that matches what PAPI expects
interface Signer {
    publicKey: Uint8Array;
    signTx: (data: Uint8Array) => Promise<Uint8Array>;
    signBytes: (data: Uint8Array) => Promise<Uint8Array>;
}

type Transaction = Awaited<ReturnType<PapiConnection['api']['tx']['System']['remark']>>;
type TxFunction = (...args: any[]) => Promise<Transaction>;

export class FrontendTransactionService {
    private static connectionManager = FrontendConnectionManager.getInstance();

    static async prepareTransaction(request: TransactionRequest): Promise<{
        connection: PapiConnection;
        transaction: Transaction;
    }> {
        const connection = await this.connectionManager.getConnection(request.network);
        const api = connection.api;

        try {
            // Get the transaction module (capitalized first letter for PAPI convention)
            const section = request.section.charAt(0).toUpperCase() + request.section.slice(1);
            const txModule = api.tx[section as keyof typeof api.tx];
            
            if (!txModule) {
                throw new Error(`Transaction section not found: ${section}`);
            }

            const method = request.method as keyof typeof txModule;
            const txCall = txModule[method] as unknown as TxFunction;
            
            if (typeof txCall !== 'function') {
                throw new Error(`Method ${request.method} not found in section ${section}`);
            }

            // Process args (including special handling for remark)
            let processedArgs = request.args;
            if (section === 'System' && method === 'remark') {
                processedArgs = [Binary.fromText(request.args[0])];
            }

            const transaction = await txCall(...processedArgs);

            return {
                connection,
                transaction
            };
        } catch (error) {
            console.error('Error preparing transaction:', error);
            throw new Error(`Failed to prepare transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    static async estimateFees(
        connection: PapiConnection,
        transaction: Transaction,
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
        transaction: Transaction,
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

    static async submitAndWatch(
        transaction: Transaction,
        signer: Signer,
        callbacks?: TransactionCallbacks,
        options?: TxOptions
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            transaction.signSubmitAndWatch(signer, options).subscribe({
                next: (event: any) => {
                    const status: TransactionStatus = {
                        type: event.type,
                        blockHash: event.blockHash,
                        txHash: event.txHash,
                        blockNumber: event.block?.number,
                        success: event.ok
                    };

                    callbacks?.onStatusChange?.(status);
                    
                    if (event.type === 'finalized') {
                        if (event.ok) {
                            callbacks?.onSuccess?.({
                                ...status,
                                events: event.events
                            });
                            resolve();
                        } else {
                            const error = this.parseDispatchError(event.dispatchError);
                            callbacks?.onError?.(error);
                            reject(error);
                        }
                    }
                },
                error: (error: Error) => {
                    console.error('Transaction error:', error);
                    callbacks?.onError?.(error);
                    reject(error);
                }
            });
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
} */