import { XcmV4Location } from "services";
import { ConnectionManager } from "../network/ConnectionManager";
import { safeStringify, safeParse, serializeKey } from "./utils";
import { NATIVE_DOT_ASSET } from "./metadata";

async function main() {
    try {
        console.log("Initializing connection manager...");
        const connectionManager = ConnectionManager.getInstance();
        await connectionManager.initialize();

        console.log("Getting Asset Hub API...");
        const api = connectionManager.getAssetHubApi();

        if (!api) {
            throw new Error("Failed to get Asset Hub API");
        }

        console.log("Fetching all foreign assets metadata...");
        const foreignMetadata = await api.query.ForeignAssets.Metadata.getEntries();

        console.log(`Found ${foreignMetadata.length} foreign assets metadata entries`);

        // Find WETH by looking for 'WETH' symbol
        let wethFound = false;
        for (const entry of foreignMetadata) {
            const metadata = entry.value;
            const key = entry.keyArgs[0];

            // Check if the symbol is WETH
            if (metadata.symbol.asText() === 'WETH') {
                wethFound = true;

                console.log("\n=== WETH XCM LOCATION (RAW) ===");
                console.log(serializeKey(key));

                const xcmLocation = safeStringify(key);
                console.log("xcmLocation", xcmLocation);

                const xcmKey = safeParse<XcmV4Location>(xcmLocation);
                console.log("xcmKey", xcmKey);
                // call asset API
                const asset = await api.query.ForeignAssets.Asset.getValue(xcmKey);
                console.log("asset", asset);
                //read from metadata.ts
                const nativeAsset = NATIVE_DOT_ASSET.rawXcmLocation;
                const assetInfo = await api.query.Assets.Asset.getValue(nativeAsset);
                console.log("assetInfo", assetInfo);

                const quote = await api.apis.AssetConversionApi.quote_price_exact_tokens_for_tokens(
                    nativeAsset,
                    xcmKey,
                    BigInt(12350000000000n),
                    true
                );
                console.log("quote", quote);
                break;
            }
        }

       
        if (!wethFound) {
            console.log("WETH metadata not found in foreign assets");
        }

    } catch (error) {
        console.error("Error in test:", error);
    } finally {
        // Ensure we exit the process
        process.exit(0);
    }
}

// Run the test
main();
