import { Asset, AssetType, XcmV4Location } from '../assets/types';
import { BalanceRequest, BalanceResponse, RawBalanceResponse } from './types';
import { fetchCachedAssets, formatAmount } from '../assets/utils';
import { TypedApi } from 'polkadot-api';
import { polkadot_asset_hub } from '@polkadot-api/descriptors';
import { ConnectionManager } from '../network/ConnectionManager';


export class BalanceService {
    private static instance: BalanceService;
    private api: TypedApi<typeof polkadot_asset_hub> | null = null;

    private constructor() {
        // Connection is managed by ConnectionManager
    }

    public static getInstance(): BalanceService {
        if (!this.instance) {
            this.instance = new BalanceService();
        }
        return this.instance;
    }

    private async ensureConnection() {
        if (!this.api) {
            const connectionManager = ConnectionManager.getInstance();
            if (!connectionManager.isInitialized()) {
                await connectionManager.initialize();
            }
            this.api = connectionManager.getAssetHubApi();
            if (!this.api) {
                throw new Error('Asset Hub connection not available');
            }
        }
        return this.api;
    }

    public async getBalance({ address, assetId }: BalanceRequest): Promise<BalanceResponse> {
        const asset = await fetchCachedAssets(assetId.toString()) as Asset;

        if (!asset) {
            throw new Error(`Asset not found: ${assetId}`);
        }

        const rawBalance = await this.fetchBalanceByType(asset, address, Number(assetId));
        return this.formatBalanceResponse(rawBalance, asset);
    }

    private async fetchBalanceByType(asset: Asset, address: string, assetId: number): Promise<RawBalanceResponse> {
        const api = await this.ensureConnection();

        if (asset.assetType === AssetType.Native) {
            if (isNaN(assetId)) {
                throw new Error('Invalid asset ID');
            }
            const result = await api.query.Assets.Account.getValue(assetId, address);
            return result as RawBalanceResponse;
        } else if (asset.assetType === AssetType.Foreign) {
            const result = await api.query.ForeignAssets.Account.getValue(asset.xcmLocation, address);
            return result as RawBalanceResponse;
        }

        throw new Error(`Unsupported asset type: ${asset.assetType}`);
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
} 