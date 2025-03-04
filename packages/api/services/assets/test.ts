import { ConnectionManager } from "@/network/ConnectionManager";

async function main() {
    console.log("Initializing connection manager...");
    const connectionManager = ConnectionManager.getInstance();
    await connectionManager.initialize();

    console.log("Getting Asset Hub API...");
    const api = connectionManager.getAssetHubApi();

    if (!api) {
        throw new Error("Failed to get Asset Hub API");
    }
}

main();
