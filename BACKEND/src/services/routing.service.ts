import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { RouteCalculationInput, RouteCalculationOutput, RoadNetworkGraph } from '../types/routing.types.js';
import { ApiError } from '../utils/ApiError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class RoutingService {
  /**
   * Wrapper for calculating shortest path dynamically
   */
  static async calculateShortestPath(startNode: number, endNode: number): Promise<RouteCalculationOutput> {
    // For now we create a dummy graph to satisfy the worker requirements
    const dummyGraph: RoadNetworkGraph = {};
    return this.runDijkstra(dummyGraph, startNode, endNode);
  }

  /**
   * Worker thread me Dijkstra algorithm run karta hai
   */
  static runDijkstra(
    graph: RoadNetworkGraph,
    startNode: number,
    endNode: number
  ): Promise<RouteCalculationOutput> {
    return new Promise((resolve, reject) => {
      // Development me TS files tsx se run hoti hain, dist me JS files
      const isTypeScript = __filename.endsWith('.ts');
      const workerFilePath = isTypeScript
        ? path.resolve(__dirname, '../workers/dijkstra.worker.ts')
        : path.resolve(__dirname, '../workers/dijkstra.worker.js');

      const workerData: RouteCalculationInput = { graph, startNode, endNode };

      const worker = new Worker(workerFilePath, {
        workerData,
        // TypeScript execution ke liye execArgv agar tsx active hai
        execArgv: isTypeScript ? ['--loader', 'tsx'] : undefined,
      });

      worker.on('message', (result: RouteCalculationOutput) => {
        resolve(result);
      });

      worker.on('error', (err) => {
        reject(new ApiError(500, `Worker Thread Execution Error: ${err.message}`));
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new ApiError(500, `Worker Thread stopped with non-zero exit code: ${code}`));
        }
      });
    });
  }
}