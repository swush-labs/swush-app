import { Asset, AssetType } from '@/services/assets/types';
import { TypedApi } from 'polkadot-api';
import { polkadot_asset_hub } from '@polkadot-api/descriptors';
import { FrontendConnectionManager, PapiConnection } from '../FrontendConnectionManager';
import { BalanceRequest, BalanceResponse, RawBalanceResponse, SystemAccountData } from './types';
import { fetchAssetInfo, formatAmount } from './utils';
import { NETWORKS_SUPPORTED } from '../constants';

export class BalanceService {
    private static instance: BalanceService;
    private connectionManager: FrontendConnectionManager;
    private assetsCache: Map<string, Asset> = new Map();

    private constructor() {
        this.connectionManager = FrontendConnectionManager.getInstance();
    }

    public static getInstance(): BalanceService {
        if (!this.instance) {
            this.instance = new BalanceService();
        }
        return this.instance;
    }

    /**
     * Clear the asset cache
     * This is now just for API compatibility - no actual caching of balance values
     */
    public clearCache(txHash?: string): void {
        // We won't cache balances anymore, but keep the method for compatibility
    }

    private async getApiForAsset(asset: Asset): Promise<TypedApi<typeof polkadot_asset_hub>> {
        // Currently only supporting Asset Hub
        const connection = await this.connectionManager.getConnection(NETWORKS_SUPPORTED.ASSET_HUB);
        return connection.api as TypedApi<typeof polkadot_asset_hub>;
    }

    public async getBalance({ address, assetId }: BalanceRequest): Promise<BalanceResponse> {
        const assetKey = assetId.toString();
        
        // Get asset info from cache first
        let asset = this.assetsCache.get(assetKey);
        
        // If not in cache, fetch it
        if (!asset) {
            const fetchedAsset = await fetchAssetInfo(assetKey);
            
            if (fetchedAsset) {
                asset = fetchedAsset;
                this.assetsCache.set(assetKey, asset);
            } else {
                const error = new Error(`Asset not found: ${assetId}`);
                console.error(error);
                throw error;
            }
        }

        try {
            const rawBalance = await this.fetchBalanceByType(asset, address, assetId);
            const formattedBalance = this.formatBalanceResponse(rawBalance, asset);
            
            return formattedBalance;
        } catch (error) {
            console.error(`Error fetching balance for ${address} / ${assetId}:`, error);
            // Re-throw to allow proper error handling upstream
            throw error;
        }
    }

    private async fetchBalanceByType(asset: Asset, address: string, assetId: number | string): Promise<RawBalanceResponse> {
        const api = await this.getApiForAsset(asset);

        try {
            if (asset.assetType === AssetType.Native) {
                if (assetId === "DOT") {
                    // Handle DOT balance using System.Account
                    const accountData = await api.query.System.Account.getValue(address) as SystemAccountData;
                    
                    // Convert System.Account data to RawBalanceResponse format
                    return {
                        balance: accountData.data.free - accountData.data.frozen,
                        status: accountData.data.frozen > BigInt(0) ? { Frozen: undefined } : { Liquid: undefined },
                        reason: {
                            Sufficient: undefined
                        }
                    } as RawBalanceResponse;
                } else {
                    if (isNaN(Number(assetId))) {
                        throw new Error('Invalid asset ID');
                    }
                    const result = await api.query.Assets.Account.getValue(Number(assetId), address);
                    return result as RawBalanceResponse;
                }
            } else if (asset.assetType === AssetType.Foreign) {
                const result = await api.query.ForeignAssets.Account.getValue(asset.rawXcmLocation, address);
                return result as RawBalanceResponse;
            }

            throw new Error(`Unsupported asset type: ${asset.assetType}`);
        } catch (error) {
            console.error(`Error in fetchBalanceByType for ${address} / ${assetId}:`, error);
            throw error;
        }
    }

    private formatBalanceResponse(rawBalance: RawBalanceResponse, asset: Asset): BalanceResponse {
        if (!rawBalance) {
            return {
                balance: 0,
                status: 'Liquid',
                reason: 'Sufficient',
                extra: null
            };
        }

        const formatted = formatAmount(rawBalance.balance, asset.metadata.decimals);
        
        // Determine status
        let status: BalanceResponse['status'] = 'Liquid';
        if (rawBalance.status.Frozen) status = 'Frozen';
        if (rawBalance.status.Blocked) status = 'Blocked';

        // Determine reason
        let reason: BalanceResponse['reason'] = 'Sufficient';
        if (rawBalance.reason.Consumer) reason = 'Consumer';
        if (rawBalance.reason.DepositHeld) reason = 'DepositHeld';
        if (rawBalance.reason.DepositFrom) reason = 'DepositFrom';
        if (rawBalance.reason.DepositRefunded) reason = 'DepositRefunded';

        return {
            balance: Number(formatted.decimal),
            status,
            reason,
            extra: null
        };
    }

    public async getBalances(requests: BalanceRequest[]): Promise<{[key: string]: BalanceResponse}> {
        const results: {[key: string]: BalanceResponse} = {};
        
        // Process requests in parallel with retries
        const promises = requests.map(async (request) => {
            const key = `${request.address}-${request.assetId}`;
            let retries = 2;
            
            while (retries >= 0) {
                try {
                    const balance = await this.getBalance(request);
                    results[key] = balance;
                    return;
                } catch (error) {
                    if (retries === 0) {
                        console.error(`Failed to fetch balance after retries for ${request.address} / ${request.assetId}:`, error);
                        // Add failed result with zero balance
                        results[key] = {
                            balance: 0,
                            status: 'Liquid',
                            reason: 'Sufficient',
                            extra: error instanceof Error ? { error: error.message } : null
                        };
                    } else {
                        console.warn(`Retrying balance fetch for ${request.address} / ${request.assetId}`);
                        retries--;
                        // Short delay before retry
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            }
        });
        
        await Promise.all(promises);
        return results;
    }
} 