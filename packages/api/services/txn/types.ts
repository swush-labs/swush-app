export interface TransactionRequest {
    section: string;
    method: string;
    args: any[];
    network?: string;
    address?: string;
}

export interface TransactionStatus {
    type: string;
    txHash?: string;
    blockNumber?: number;
    blockHash?: string;
    success?: boolean;
    error?: string;
    events?: any[];
}

export interface TransactionCallbacks {
    onStatusChange?: (status: TransactionStatus) => void;
    onSuccess?: (status: TransactionStatus) => void;
    onError?: (error: Error) => void;
}

export interface TxOptions {
    tip?: bigint;
    nonce?: number;
    storageDepositLimit?: bigint;
    validityPeriod?: number;
}