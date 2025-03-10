import { TokenGraph } from '../TokenGraph';

describe('TokenGraph', () => {
    let graph: TokenGraph;

    beforeEach(() => {
        graph = new TokenGraph();
    });

    describe('Node operations', () => {
        test('should add a node successfully', () => {
            graph.addNode('1');
            expect(graph.getNode('1')).toEqual({ assetId: '1' });
        });

        test('should return undefined for non-existent node', () => {
            expect(graph.getNode('999')).toBeUndefined();
        });
    });

    describe('Edge operations', () => {
        beforeEach(() => {
            graph.addNode('1');
            graph.addNode('2');
        });

        test('should add bidirectional edges successfully', () => {
            graph.addEdge('1', '2', 'assetHub');
            
            const edge1To2 = graph.getEdge('1', '2');
            const edge2To1 = graph.getEdge('2', '1');

            expect(edge1To2).toEqual({ from: '1', to: '2', dex: 'assetHub' });
            expect(edge2To1).toEqual({ from: '2', to: '1', dex: 'assetHub' });
        });

        test('should throw error when adding edge with non-existent nodes', () => {
            expect(() => graph.addEdge('1', '999', 'assetHub')).toThrow();
            expect(() => graph.addEdge('999', '1', 'assetHub')).toThrow();
        });

        test('should return undefined for non-existent edge', () => {
            expect(graph.getEdge('1', '999')).toBeUndefined();
        });
    });

    describe('Path finding', () => {
        beforeEach(() => {
            // Create a test graph
            ['A', 'B', 'C', 'D'].forEach(node => graph.addNode(node));
            graph.addEdge('A', 'B', 'assetHub');
            graph.addEdge('B', 'C', 'hydraDx');
            graph.addEdge('C', 'D', 'assetHub');
            graph.addEdge('A', 'D', 'hydraDx');
        });

        test('should find direct path', () => {
            const paths = graph.findAllPaths('A', 'B');
            expect(paths).toContainEqual(['A', 'B']);
        });

        test('should find multiple paths', () => {
            const paths = graph.findAllPaths('A', 'D');
            expect(paths).toContainEqual(['A', 'D']); // Direct path
            expect(paths).toContainEqual(['A', 'B', 'C', 'D']); // Long path
        });

        test('should respect maxHops parameter', () => {
            const paths = graph.findAllPaths('A', 'D', 1);
            expect(paths).toHaveLength(1); // Only direct path
            expect(paths).toContainEqual(['A', 'D']);
        });

        test('should respect preferredDex parameter', () => {
            const paths = graph.findAllPaths('A', 'D', 3, 'assetHub');
            // Should only include paths that use assetHub after first hop
            const validPaths = paths.every(path => {
                if (path.length <= 2) return true; // Direct paths are allowed
                // Check if subsequent hops use assetHub
                for (let i = 1; i < path.length - 1; i++) {
                    const edge = graph.getEdge(path[i], path[i + 1]);
                    if (edge?.dex !== 'assetHub') return false;
                }
                return true;
            });
            expect(validPaths).toBe(true);
        });

        test('should throw error for invalid start/end assets', () => {
            expect(() => graph.findAllPaths('X', 'D')).toThrow();
            expect(() => graph.findAllPaths('A', 'X')).toThrow();
        });
    });
}); 