import { TypedApi } from 'polkadot-api';
import { polkadot_asset_hub } from '@polkadot-api/descriptors';
import { Asset, AssetType, XcmV4Location } from './types';
import { getForeignAssetId, getNativeAssetId, getXcmV3Multilocation, safeStringify} from './utils';
import { ConnectionManager } from '../network/ConnectionManager';
import { CACHE_KEYS } from '../constants';
import { NATIVE_DOT_ASSET } from './metadata';
import { TradeRouterService } from './router/TradeRouterService';
import { CacheService } from '../cache/CacheService';
import { TokenGraph } from './router/TokenGraph';
import { saveAssetsToFile } from '@/utils';

export class FetchAssetService {
    private static instance: FetchAssetService;
    private cacheService: CacheService;
    private connectionManager: ConnectionManager;
    private initialized: boolean = false;
    private forceRefresh: boolean = false;

    // Cache refresh intervals in milliseconds
    private static REFRESH_INTERVALS = {
        ASSETS: 30 * 60 * 1000  // 30 minutes
    };

    private constructor() {
        this.cacheService = CacheService.getInstance();
        this.connectionManager = ConnectionManager.getInstance();
    }

    public static getInstance(): FetchAssetService {
        if (!FetchAssetService.instance) {
            FetchAssetService.instance = new FetchAssetService();
        }
        return FetchAssetService.instance;
    }

    public isInitialized(): boolean {
        return this.initialized;
    }

    private async setupCacheRefresh(): Promise<void> {
        // Register cache refresh for assets
        this.cacheService.registerRefreshCallback(
            CACHE_KEYS.MERGED_ASSETS,
            async () => {
                const assets = await this.fetchAllAssetsPapi(this.connectionManager.getAssetHubApi()!);
                await this.cacheService.set(CACHE_KEYS.MERGED_ASSETS, assets);
            },
            FetchAssetService.REFRESH_INTERVALS.ASSETS
        );
    }

    public async initialize(): Promise<void> {
        if (this.initialized && !this.forceRefresh) return;

        try {
            // Initialize network connections first
            await this.connectionManager.initialize();

            // Setup cache refresh
            await this.setupCacheRefresh();

            // Initialize cache service
            await this.cacheService.initialize();

            this.initialized = true;
            console.log('AssetService initialized successfully');
        } catch (error) {
            console.error('Failed to initialize AssetService:', error);
            throw error;
        }
    }

    public async getAssets(forceRefresh = false): Promise<Map<string, Asset>> {
        if (!this.initialized) {
            throw new Error('AssetService not initialized. Call initialize() first');
        }

        if (forceRefresh) {
            this.forceRefresh = true;
            await this.initialize();
        }

        const cachedAssets = this.cacheService.get<Map<string, Asset>>(CACHE_KEYS.MERGED_ASSETS);
        if (!cachedAssets) {
            throw new Error('Assets cache not found. This should not happen as assets are cached during initialization');
        }

        console.log('Returning cached assets');
        return cachedAssets;
    }


    private createAssetDetails = (
        assetValue: any,
        metadata: any,
        assetType: AssetType,
        xcmLocation: any
    ): Asset => {
        
        return {
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
            assetType: assetType,
            // Store the serialized XCM location as a string
            xcmLocation: safeStringify(xcmLocation),
            // Store the original XCM location object
            rawXcmLocation: xcmLocation
        };
    };

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
            foreignMetadata.map(entry => [safeStringify(entry.keyArgs[0]), entry.value])
        );

        const nativeAssetsMap = new Map<string, Asset>();
        const foreignAssetsMap = new Map<string, Asset>();

        // Add native DOT token first - use the predefined constant from metadata.ts
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
            const assetId = safeStringify(foreignAsset.keyArgs[0]);
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
        const mergedAssets = await this.fetchPoolsPapi(api, nativeAssetsMap, foreignAssetsMap);
        return mergedAssets;
    }

    public async fetchPoolsPapi(
        api: TypedApi<typeof polkadot_asset_hub>,
        nativeAssetsInfo: Map<string, Asset>,
        foreignAssetsInfo: Map<string, Asset>
    ) {

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
                }
                else if (
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

                    const foreignAssetId = safeStringify(normalizedXcmLocation);
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
        const tokenGraph = new TokenGraph();

        // Initialize graph with pool assets
        for (const [assetId] of assetHubPoolAssets) {
            tokenGraph.addNode(assetId);
        }

        // Add pools using the stored pairs
        for (const pairStr of poolAssetPairs) {
            const [assetOneId, assetTwoId] = pairStr.split('-');
            tokenGraph.addEdge(
                assetOneId,
                assetTwoId,
                'assetHub'
            );
        }

        // Cache router and graph
        this.cacheService.set(CACHE_KEYS.TOKEN_GRAPH, tokenGraph);
        //saveAssetsToFile(assetHubPoolAssets, 'assetHubPoolAssets.json');
        // Get HydraDX assets and merge them
        const mergedAssets = await this.enrichWithHydraDxData(assetHubPoolAssets, nativeAssetsInfo,
            foreignAssetsInfo);
        //saveAssetsToFile(mergedAssets, 'mergedAssets.json');

        // // Ensure all assets have serialized XCM locations before caching
        // const serializedAssets = new Map<string, Asset>();
        // for (const [key, asset] of mergedAssets.entries()) {
        //     serializedAssets.set(key, ensureSerializedXcmLocation(asset));
        // }

        //set cache for mergedAssets
        this.cacheService.set(CACHE_KEYS.MERGED_ASSETS, mergedAssets);
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
