
export interface Node {
    assetId: string;      // Using assetId as unique identifier
}

export interface Edge {
    from: string;         // assetId of from token
    to: string;          // assetId of to token
    dex: 'assetHub' | 'hydraDx';
}

export interface HopInfo {
    from: string;
    to: string;
    amountIn: bigint;
    amountOut: bigint;
    fee: number;
    liquidity: bigint;
    poolId: string;
    dex: string;
}

export class TokenGraph {
    private nodes: Map<string, Node> = new Map();
    private adjacencyList: Map<string, Edge[]> = new Map();

    addNode(assetId: string) {
        this.nodes.set(assetId, {
            assetId,
        });
        if (!this.adjacencyList.has(assetId)) {
            this.adjacencyList.set(assetId, []);
        }
    }

    addEdge(
        fromAssetId: string,
        toAssetId: string,
        dex: 'assetHub' | 'hydraDx',
    ) {
        if (!this.nodes.has(fromAssetId) || !this.nodes.has(toAssetId)) {
            throw new Error(`One or both assets not found: ${fromAssetId}, ${toAssetId}`);
        }

        // Create bidirectional edges for the pool
        const edge: Edge = { 
            from: fromAssetId, 
            to: toAssetId, 
            dex
        };
        this.adjacencyList.get(fromAssetId)?.push(edge);
        
        const reverseEdge: Edge = { 
            ...edge, 
            from: toAssetId, 
            to: fromAssetId 
        };
        this.adjacencyList.get(toAssetId)?.push(reverseEdge);
    }

    getNode(assetId: string): Node | undefined {
        return this.nodes.get(assetId);
    }

    getEdge(fromAssetId: string, toAssetId: string): Edge | undefined {
        return this.adjacencyList.get(fromAssetId)?.find(edge => edge.to === toAssetId);
    }

    findAllPaths(
        startAssetId: string,
        endAssetId: string,
        maxHops: number = 3,
        preferredDex?: string
    ): string[][] {
        if (!this.nodes.has(startAssetId) || !this.nodes.has(endAssetId)) {
            throw new Error(`Invalid start or end asset: ${startAssetId}, ${endAssetId}`);
        }

        const visited = new Set<string>();
        const paths: string[][] = [];

        const dfs = (
            current: string,
            target: string,
            path: string[],
            hopCount: number,
            currentDex?: string
        ) => {
            path.push(current);
            visited.add(current);

            if (current === target && path.length <= maxHops + 1) {
                paths.push([...path]);
            } else if (hopCount < maxHops) {
                const edges = this.adjacencyList.get(current) || [];
                for (const edge of edges) {
                    if (!visited.has(edge.to)) {
                        // If preferred DEX is specified, only follow edges from that DEX
                        // or allow first hop to be from any DEX
                        if (!preferredDex || 
                            edge.dex === preferredDex || 
                            !currentDex) {
                            dfs(edge.to, target, path, hopCount + 1, edge.dex);
                        }
                    }
                }
            }

            path.pop();
            visited.delete(current);
        };

        dfs(startAssetId, endAssetId, [], 0);
        return paths;
    }

}
