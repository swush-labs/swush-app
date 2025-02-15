import { TypedApi } from 'polkadot-api';
import { polkadot_asset_hub } from '@polkadot-api/descriptors';
import { PoolService, TradeRouter } from '@galacticcouncil/sdk';
import CacheManager from '../cache/CacheManager';
import { Asset, AssetType, XcmV4Location } from './types';
import { getXcmV3Multilocation, serializeKey } from './utils';
import { base, degen } from './external';
import { ConnectionManager } from '../network/ConnectionManager';
import { AssetHubRouter } from './AssetHubRouter';
import { CACHE_KEYS } from '../constants';
import { NATIVE_DOT_ASSET } from './metadata';
import { TradeRouterService } from '@/network/TradeRouterService';

export class AssetService {
    private static instance: AssetService;
    private cacheManager: CacheManager;
    private connectionManager: ConnectionManager;

    private constructor() {
        this.cacheManager = CacheManager.getInstance();
        this.connectionManager = ConnectionManager.getInstance();
    }

    public static getInstance(): AssetService {
        if (!AssetService.instance) {
            AssetService.instance = new AssetService();
        }
        return AssetService.instance;
    }

    public async getAssets(forceRefresh = false): Promise<Map<string, Asset>> {
        const cachedAssets = this.cacheManager.get(CACHE_KEYS.MERGED_ASSETS);
        if (!forceRefresh && cachedAssets) {
            console.log('Returning cached assets');
            return cachedAssets;
        }
        console.log('Fetching assets from API');

        const api = this.connectionManager.getAssetHubApi();
        if (!api) throw new Error('Asset Hub API not initialized');
        
        const allAssets = await this.fetchAllAssetsPapi(api);
        return allAssets;
    }

        
    private createAssetDetails = (
        assetValue: any,
        metadata: any,
        assetType: AssetType,
        xcmLocation: any
    ): Asset => ({
        asset: {
            owner: assetValue.owner,
            issuer: assetValue.issuer,
            admin: assetValue.admin,
            freezer: assetValue.freezer,
            supply: assetValue.supply,
            deposit: assetValue.deposit,
            min_balance: assetValue.min_balance,
            is_sufficient: assetValue.is_sufficient,
            accounts: assetValue.accounts,
            sufficients: assetValue.sufficients,
            approvals: assetValue.approvals,
        },
        metadata: {
            deposit: metadata.deposit,
            name: metadata.name.asText(),
            symbol: metadata.symbol.asText(),
            decimals: metadata.decimals,
            is_frozen: metadata.is_frozen
        },
        type: assetType,
        xcmLocation
    });

    public async fetchAllAssetsPapi(api: TypedApi<typeof polkadot_asset_hub>): Promise<Map<string, Asset>> {
    
        // Get all entries in parallel using PAPI
        const [nativeAssets, nativeMetadata, foreignAssets, foreignMetadata] = await Promise.all([
            api.query.Assets.Asset.getEntries(),
            api.query.Assets.Metadata.getEntries(),
            api.query.ForeignAssets.Asset.getEntries(),
            api.query.ForeignAssets.Metadata.getEntries()
        ]);
    
        // Create metadata maps with string keys
        const nativeMetadataMap = new Map(
            nativeMetadata.map(entry => [entry.keyArgs[0].toString(), entry.value])
        );
    
        const foreignMetadataMap = new Map(
            foreignMetadata.map(entry => [serializeKey(entry.keyArgs[0]), entry.value])
        );
    
        const nativeAssetsMap = new Map<string, Asset>();
        const foreignAssetsMap = new Map<string, Asset>();

        // Add native DOT token first
        nativeAssetsMap.set('DOT', NATIVE_DOT_ASSET);

        // Process native assets with string keys
        for (const nativeAsset of nativeAssets) {
            const assetId = nativeAsset.keyArgs[0].toString();
            const metadata = nativeMetadataMap.get(assetId);
    
            if (metadata) {
                const assetDetails = this.createAssetDetails(
                    nativeAsset.value,
                    metadata,
                    AssetType.Native,
                    getXcmV3Multilocation(BigInt(assetId))
                );
                nativeAssetsMap.set(assetId, assetDetails);
            }
        }
    
        // Process foreign assets
        for (const foreignAsset of foreignAssets) {
            const assetId = serializeKey(foreignAsset.keyArgs[0]);
            const metadata = foreignMetadataMap.get(assetId);
    
            if (metadata) {
                const assetDetails = this.createAssetDetails(
                    foreignAsset.value,
                    metadata,
                    AssetType.Foreign,
                    foreignAsset.keyArgs[0]
                );
                foreignAssetsMap.set(assetId, assetDetails);
            }
        }

        console.log('All assets and metadata fetched and cached');
        const mergedAssets = await this.fetchPoolsPapi(nativeAssetsMap, foreignAssetsMap);
        return mergedAssets;
    }
    
    public async fetchPoolsPapi(
        nativeAssetsInfo: Map<string, Asset>,
        foreignAssetsInfo: Map<string, Asset>
    ) {
        const api = this.connectionManager.getAssetHubApi();
        if (!api) throw new Error('API not initialized');
    
        // Get assets from Asset Hub pools
        const pools = await api.query.AssetConversion.Pools.getEntries();

        const assetHubPoolAssets = new Map<string, Asset>();
        const poolAssetPairs = new Set<string>();

        // First pass: collect all assets that are actually in pools
        for (const pool of pools) {
            const poolPairs = pool.keyArgs[0] as [XcmV4Location, XcmV4Location];
            const [assetOne, assetTwo] = poolPairs;
            const assetsToProcess = [assetOne, assetTwo];

            let assetOneId: string | null = null;
            let assetTwoId: string | null = null;

            for (const asset of assetsToProcess) {
                const { parents, interior } = asset;
                // Special case for native DOT
                if (parents === 1 && interior?.type === 'Here') {
                    assetHubPoolAssets.set('DOT', NATIVE_DOT_ASSET);
                    if (!assetOneId) assetOneId = 'DOT';
                    else assetTwoId = 'DOT';
                    continue;
                }

                if (
                    parents === 0 &&
                    interior?.type === 'X2' &&
                    interior.value.some((e) => e.type === "PalletInstance" && e.value === 50)
                ) {
                    // Handle native assets
                    for (const entry of interior.value)
                        if (entry.type === "GeneralIndex") {
                            const assetId = entry.value.toString();
                            const nativeAssetInfo = nativeAssetsInfo.get(assetId);
                            if (nativeAssetInfo) {
                                assetHubPoolAssets.set(assetId, nativeAssetInfo);
                                if (!assetOneId) assetOneId = assetId;
                                else assetTwoId = assetId;
                            }
                        }
                } else {
                    // Handle foreign assets
                    const normalizedXcmLocation = {
                        parents: asset.parents,
                        interior: asset.interior
                    };
    
                    const foreignAssetId = serializeKey(normalizedXcmLocation);
                    const foreignAssetInfo = foreignAssetsInfo.get(foreignAssetId);
                    if (foreignAssetInfo) {
                        assetHubPoolAssets.set(foreignAssetId, foreignAssetInfo);
                        if (!assetOneId) assetOneId = foreignAssetId;
                        else assetTwoId = foreignAssetId;
                    }
                }
            }

            // Store valid pool pairs
            if (assetOneId && assetTwoId) {
                poolAssetPairs.add(`${assetOneId}-${assetTwoId}`);
            }
        }

        // Initialize router only with assets that are in pools
        const assetHubRouter = new AssetHubRouter(api, assetHubPoolAssets);

        // Add pools using the stored pairs
        for (const pairStr of poolAssetPairs) {
            const [assetOneId, assetTwoId] = pairStr.split('-');
            assetHubRouter.addPool(assetOneId, assetTwoId);
        }
        //saveAssetsToFile(assetHubPoolAssets, 'assetHubAssets.json');


        // Store the router instance for later use
        this.cacheManager.set('asset_hub_router', assetHubRouter);

    
        // Get HydraDX assets and merge them
        const mergedAssets = await this.enrichWithHydraDxData(assetHubPoolAssets, nativeAssetsInfo, foreignAssetsInfo);
        //saveAssetsToFile(mergedAssets, 'mergedAssets.json');

        //set cache for mergedAssets
        this.cacheManager.set(CACHE_KEYS.MERGED_ASSETS, mergedAssets);
        this.cacheManager.set(CACHE_KEYS.TOKEN_GRAPH, assetHubRouter.getTokenGraph());
        return mergedAssets;
    }
    

    public async enrichWithHydraDxData(
        assetHubAssets: Map<string, Asset>,
        nativeAssetsInfo: Map<string, Asset>,
        foreignAssetsInfo: Map<string, Asset>

    ): Promise<Map<string, Asset>> {
        const hydraApi = this.connectionManager.getHydradxApi();
        if (!hydraApi) throw new Error('HydraDX API not initialized');

        const mergedAssets = new Map<string, Asset>(assetHubAssets);
    
        // Helper function to check native asset match and extract assetId
        const getNativeAssetId = (location: any): string | null => {
            if (!location?.interior?.x3) return null;
            const interior = location.interior.x3;
            
            if (!interior.some(j => j.palletInstance === 50) || 
                !interior.some(j => j.parachain === 1000)) {
                return null;
            }
    
            const generalIndexEntry = interior.find(j => j.generalIndex !== undefined);
            return generalIndexEntry ? generalIndexEntry.generalIndex.toString() : null;
        };
    
        // Helper function to check foreign asset match
        const getForeignAssetId = (location: any): string | null => {
            try {
                // Check if location and required properties exist
                if (!location || typeof location.parents === 'undefined' || !location.interior) {
                    return null;
                }

                const normalizedLocation = {
                    parents: location.parents,
                    interior: location.interior
                };
                return serializeKey(normalizedLocation);
            } catch (error) {
                console.error('Error matching foreign asset:', error);
                return null;
            }
        };
    
        try {
            const tradeRouter = TradeRouterService.getInstance().getTradeRouter();
            const hydradxPools = await tradeRouter.getPools();
    
            console.log('First HydraDX Pool:', JSON.stringify(hydradxPools[0], null, 2));
    
            // Process all HydraDX pools
            for (const pool of hydradxPools) {
                for (const token of pool.tokens) {
                    const hydradxInfo = {
                        assetId: token.id,
                        location: token.location,
                        poolAddress: pool.address,
                        poolType: pool.type,
                        balance: token.balance,
                        existentialDeposit: token.existentialDeposit
                    };
    
                    // Try to match native asset first
                    const nativeAssetId = getNativeAssetId(token.location);
                    if (nativeAssetId !== null) {
                        const nativeAsset = nativeAssetsInfo.get(nativeAssetId);
                        if (nativeAsset) {
                            const existingAsset = mergedAssets.get(nativeAssetId);
                            
                            if (existingAsset) {
                                existingAsset.hydradx = hydradxInfo;
                                console.log('Updated existing Asset Hub asset with HydraDX info:', nativeAssetId);
                            } else {
                                const newAsset = { ...nativeAsset, hydradx: hydradxInfo };
                                mergedAssets.set(nativeAssetId, newAsset);
                                console.log('Added new native asset from HydraDX:', nativeAssetId);
                            }
                            continue;
                        }
                    }
    
                    // Try to match foreign asset
                    const foreignId = getForeignAssetId(token.location);
                    if (foreignId !== null) {
                        const foreignAsset = foreignAssetsInfo.get(foreignId);
                        if (foreignAsset) {
                            const existingAsset = mergedAssets.get(foreignId);
                            if (existingAsset) {
                                existingAsset.hydradx = hydradxInfo;
                                console.log('Updated existing foreign Asset Hub asset with HydraDX info:', foreignId);
                            } else {
                                const newAsset = { ...foreignAsset, hydradx: hydradxInfo };
                                mergedAssets.set(foreignId, newAsset);
                                console.log('Added new foreign asset from HydraDX:', foreignId);
                            }
                        }
                    }
                }
            }
    
            return mergedAssets;
        } catch (error) {
            console.error('Error enriching with HydraDX data:', error);
            throw error;
        }
    }
}    
    // async function main() {
    //     try {
    //         const { api, client } = await connectPapi(RPC_URL, "asset-hub");
    
    //         await fetchAllAssetsPapi(api);
    //         client.destroy();
    //     } catch (error) {
    //         console.error("Error:", error);
    //     }
    // }
    
    // main();
