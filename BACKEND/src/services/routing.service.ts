import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  RouteCalculationInput,
  RouteCalculationOutput,
  RoadNetworkGraph,
  RoadNodeInfo,
} from '../types/routing.types.js';
import { ApiError } from '../utils/ApiError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Comprehensive Delhi NCR Road Network Intersections (40 Key Hubs)
export const DELHI_NCR_ROAD_NODES: Record<number, RoadNodeInfo> = {
  // Central & Old Delhi
  1: { id: 1, name: 'Connaught Place Central', latitude: 28.6315, longitude: 77.2167 },
  2: { id: 2, name: 'Mandi House Circle', latitude: 28.6258, longitude: 77.2343 },
  3: { id: 3, name: 'ITO / Vikas Marg', latitude: 28.6304, longitude: 77.2435 },
  7: { id: 7, name: 'India Gate / Kartavya Path', latitude: 28.6129, longitude: 77.2295 },
  14: { id: 14, name: 'Chandni Chowk / Red Fort', latitude: 28.6562, longitude: 77.2410 },
  15: { id: 15, name: 'Kashmere Gate ISBT', latitude: 28.6675, longitude: 77.2285 },

  // North Delhi
  16: { id: 16, name: 'Delhi University (North Campus)', latitude: 28.6890, longitude: 77.2100 },
  17: { id: 17, name: 'Model Town / GT Karnal Rd', latitude: 28.7020, longitude: 77.1930 },
  18: { id: 18, name: 'Rohini Sector 10', latitude: 28.7140, longitude: 77.1150 },
  19: { id: 19, name: 'Pitampura TV Tower', latitude: 28.6980, longitude: 77.1420 },

  // West Delhi
  13: { id: 13, name: 'Karol Bagh Metro', latitude: 28.6514, longitude: 77.1907 },
  20: { id: 20, name: 'Rajouri Garden', latitude: 28.6490, longitude: 77.1230 },
  21: { id: 21, name: 'Janakpuri West District Centre', latitude: 28.6290, longitude: 77.0780 },
  22: { id: 22, name: 'Dwarka Mor / Sector 21', latitude: 28.5920, longitude: 77.0380 },
  23: { id: 23, name: 'Punjabi Bagh Ring Road', latitude: 28.6670, longitude: 77.1350 },

  // South Delhi
  8: { id: 8, name: 'Lajpat Nagar (Ring Road)', latitude: 28.5700, longitude: 77.2373 },
  9: { id: 9, name: 'AIIMS / South Extension', latitude: 28.5672, longitude: 77.2100 },
  10: { id: 10, name: 'Dhaula Kuan Interchange', latitude: 28.5921, longitude: 77.1610 },
  24: { id: 24, name: 'Nehru Place IT Hub', latitude: 28.5490, longitude: 77.2530 },
  25: { id: 25, name: 'Saket / Select Citywalk', latitude: 28.5280, longitude: 77.2190 },
  26: { id: 26, name: 'Hauz Khas / IIT Delhi', latitude: 28.5460, longitude: 77.1940 },
  27: { id: 27, name: 'Vasant Kunj Mall Road', latitude: 28.5390, longitude: 77.1550 },
  28: { id: 28, name: 'Kalkaji / Okhla Phase 3', latitude: 28.5370, longitude: 77.2720 },

  // Airport & Gurgaon (Gurugram)
  11: { id: 11, name: 'IGI Airport Terminal 3', latitude: 28.5562, longitude: 77.1000 },
  12: { id: 12, name: 'Cyber Hub Gurgaon', latitude: 28.4952, longitude: 77.0891 },
  29: { id: 29, name: 'IFFCO Chowk Gurgaon', latitude: 28.4720, longitude: 77.0710 },
  30: { id: 30, name: 'Golf Course Road Gurgaon', latitude: 28.4590, longitude: 77.0980 },
  31: { id: 31, name: 'Sohna Road Subhash Chowk', latitude: 28.4280, longitude: 77.0390 },

  // East Delhi, Noida & Greater Noida
  4: { id: 4, name: 'Akshardham Flyover (NH9)', latitude: 28.6127, longitude: 77.2773 },
  5: { id: 5, name: 'Mayur Vihar Phase 1', latitude: 28.6015, longitude: 77.2985 },
  6: { id: 6, name: 'Noida Sector 18 (Atta Market)', latitude: 28.5708, longitude: 77.3260 },
  32: { id: 32, name: 'Anand Vihar ISBT', latitude: 28.6460, longitude: 77.3160 },
  33: { id: 33, name: 'Noida Sector 62 (Electronic City)', latitude: 28.6200, longitude: 77.3630 },
  34: { id: 34, name: 'Botanical Garden Noida', latitude: 28.5640, longitude: 77.3340 },
  35: { id: 35, name: 'Noida Sector 137 Expressway', latitude: 28.5080, longitude: 77.4040 },
  36: { id: 36, name: 'Pari Chowk Greater Noida', latitude: 28.4680, longitude: 77.5090 },

  // Ghaziabad & Faridabad
  37: { id: 37, name: 'Kaushambi / Vaishali Ghaziabad', latitude: 28.6430, longitude: 77.3400 },
  38: { id: 38, name: 'Indirapuram Shipra Mall', latitude: 28.6360, longitude: 77.3710 },
  39: { id: 39, name: 'Badarpur Border', latitude: 28.4980, longitude: 77.3020 },
  40: { id: 40, name: 'Faridabad Old Chowk', latitude: 28.4110, longitude: 77.3130 },
};

// Connected graph with realistic road travel distances (km)
export const DELHI_NCR_ROAD_GRAPH: RoadNetworkGraph = {
  1: [{ node: 2, weight: 1.8 }, { node: 7, weight: 2.4 }, { node: 9, weight: 6.5 }, { node: 13, weight: 3.8 }, { node: 14, weight: 3.2 }],
  2: [{ node: 1, weight: 1.8 }, { node: 3, weight: 1.2 }, { node: 7, weight: 1.5 }],
  3: [{ node: 2, weight: 1.2 }, { node: 4, weight: 4.1 }, { node: 14, weight: 2.9 }, { node: 32, weight: 7.2 }],
  4: [{ node: 3, weight: 4.1 }, { node: 5, weight: 2.5 }, { node: 32, weight: 4.5 }, { node: 33, weight: 6.8 }],
  5: [{ node: 4, weight: 2.5 }, { node: 6, weight: 4.2 }, { node: 34, weight: 4.5 }],
  6: [{ node: 5, weight: 4.2 }, { node: 8, weight: 7.5 }, { node: 33, weight: 6.5 }, { node: 34, weight: 1.5 }, { node: 35, weight: 8.2 }],
  7: [{ node: 1, weight: 2.4 }, { node: 2, weight: 1.5 }, { node: 8, weight: 4.8 }, { node: 9, weight: 4.2 }],
  8: [{ node: 6, weight: 7.5 }, { node: 7, weight: 4.8 }, { node: 9, weight: 2.8 }, { node: 24, weight: 2.2 }],
  9: [{ node: 1, weight: 6.5 }, { node: 7, weight: 4.2 }, { node: 8, weight: 2.8 }, { node: 10, weight: 6.2 }, { node: 26, weight: 2.5 }],
  10: [{ node: 9, weight: 6.2 }, { node: 11, weight: 7.8 }, { node: 12, weight: 14.5 }, { node: 22, weight: 11.0 }, { node: 23, weight: 8.5 }, { node: 27, weight: 6.5 }],
  11: [{ node: 10, weight: 7.8 }, { node: 12, weight: 9.2 }, { node: 22, weight: 6.8 }, { node: 27, weight: 5.5 }],
  12: [{ node: 10, weight: 14.5 }, { node: 11, weight: 9.2 }, { node: 29, weight: 3.2 }, { node: 30, weight: 4.5 }],
  13: [{ node: 1, weight: 3.8 }, { node: 15, weight: 4.5 }, { node: 20, weight: 6.5 }, { node: 23, weight: 4.8 }],
  14: [{ node: 1, weight: 3.2 }, { node: 3, weight: 2.9 }, { node: 15, weight: 2.1 }],
  15: [{ node: 13, weight: 4.5 }, { node: 14, weight: 2.1 }, { node: 16, weight: 2.8 }, { node: 32, weight: 8.5 }],
  16: [{ node: 15, weight: 2.8 }, { node: 17, weight: 2.2 }, { node: 19, weight: 6.5 }],
  17: [{ node: 16, weight: 2.2 }, { node: 18, weight: 7.5 }, { node: 19, weight: 4.8 }],
  18: [{ node: 17, weight: 7.5 }, { node: 19, weight: 3.2 }, { node: 23, weight: 8.0 }],
  19: [{ node: 16, weight: 6.5 }, { node: 17, weight: 4.8 }, { node: 18, weight: 3.2 }, { node: 23, weight: 3.8 }],
  20: [{ node: 13, weight: 6.5 }, { node: 21, weight: 3.5 }, { node: 23, weight: 2.5 }],
  21: [{ node: 20, weight: 3.5 }, { node: 22, weight: 4.5 }, { node: 23, weight: 5.2 }],
  22: [{ node: 10, weight: 11.0 }, { node: 11, weight: 6.8 }, { node: 21, weight: 4.5 }],
  23: [{ node: 10, weight: 8.5 }, { node: 13, weight: 4.8 }, { node: 18, weight: 8.0 }, { node: 19, weight: 3.8 }, { node: 20, weight: 2.5 }, { node: 21, weight: 5.2 }],
  24: [{ node: 8, weight: 2.2 }, { node: 25, weight: 3.8 }, { node: 26, weight: 4.5 }, { node: 28, weight: 2.1 }],
  25: [{ node: 24, weight: 3.8 }, { node: 26, weight: 2.8 }, { node: 27, weight: 5.5 }],
  26: [{ node: 9, weight: 2.5 }, { node: 24, weight: 4.5 }, { node: 25, weight: 2.8 }, { node: 27, weight: 4.2 }],
  27: [{ node: 10, weight: 6.5 }, { node: 11, weight: 5.5 }, { node: 25, weight: 5.5 }, { node: 26, weight: 4.2 }],
  28: [{ node: 24, weight: 2.1 }, { node: 34, weight: 6.5 }, { node: 39, weight: 5.8 }],
  29: [{ node: 12, weight: 3.2 }, { node: 30, weight: 2.8 }, { node: 31, weight: 5.2 }],
  30: [{ node: 12, weight: 4.5 }, { node: 29, weight: 2.8 }, { node: 31, weight: 6.5 }],
  31: [{ node: 29, weight: 5.2 }, { node: 30, weight: 6.5 }],
  32: [{ node: 3, weight: 7.2 }, { node: 4, weight: 4.5 }, { node: 15, weight: 8.5 }, { node: 37, weight: 2.5 }, { node: 38, weight: 5.5 }],
  33: [{ node: 4, weight: 6.8 }, { node: 6, weight: 6.5 }, { node: 37, weight: 4.5 }, { node: 38, weight: 2.2 }],
  34: [{ node: 5, weight: 4.5 }, { node: 6, weight: 1.5 }, { node: 28, weight: 6.5 }, { node: 35, weight: 7.5 }],
  35: [{ node: 6, weight: 8.2 }, { node: 34, weight: 7.5 }, { node: 36, weight: 12.5 }],
  36: [{ node: 35, weight: 12.5 }],
  37: [{ node: 32, weight: 2.5 }, { node: 33, weight: 4.5 }, { node: 38, weight: 3.5 }],
  38: [{ node: 32, weight: 5.5 }, { node: 33, weight: 2.2 }, { node: 37, weight: 3.5 }],
  39: [{ node: 28, weight: 5.8 }, { node: 40, weight: 9.5 }],
  40: [{ node: 39, weight: 9.5 }],
};

export class RoutingService {
  /**
   * Finds the nearest road node in the graph for any GPS coordinate
   */
  static findNearestNode(lat: number, lon: number): number {
    let nearestNode = 1;
    let minDistance = Infinity;

    for (const [key, node] of Object.entries(DELHI_NCR_ROAD_NODES)) {
      const d = Math.hypot(lat - node.latitude, lon - node.longitude);
      if (d < minDistance) {
        minDistance = d;
        nearestNode = Number(key);
      }
    }
    return nearestNode;
  }

  /**
   * Calculate shortest path dynamically via Worker Thread Dijkstra
   */
  static async calculateShortestPath(startNode: number, endNode: number): Promise<RouteCalculationOutput> {
    const rawResult = await this.runDijkstra(DELHI_NCR_ROAD_GRAPH, startNode, endNode);
    return this.enrichRouteResult(rawResult);
  }

  /**
   * End-to-end Dijkstra computation given GPS coordinates
   */
  static async calculateRouteBetweenPoints(
    pickup: { latitude: number; longitude: number },
    dropoff: { latitude: number; longitude: number }
  ): Promise<RouteCalculationOutput> {
    const startNode = this.findNearestNode(pickup.latitude, pickup.longitude);
    const endNode = this.findNearestNode(dropoff.latitude, dropoff.longitude);

    let routeOutput: RouteCalculationOutput;

    if (startNode === endNode) {
      // Local trip within the same node catchment area
      const directDist = Number((Math.hypot(pickup.latitude - dropoff.latitude, pickup.longitude - dropoff.longitude) * 111).toFixed(2));
      routeOutput = {
        path: [startNode],
        distance: Math.max(1.5, directDist),
        etaSeconds: Math.round(directDist * 120),
        coordinates: [
          [pickup.latitude, pickup.longitude],
          [DELHI_NCR_ROAD_NODES[startNode].latitude, DELHI_NCR_ROAD_NODES[startNode].longitude],
          [dropoff.latitude, dropoff.longitude],
        ],
        waypoints: [DELHI_NCR_ROAD_NODES[startNode]],
      };
    } else {
      const rawResult = await this.runDijkstra(DELHI_NCR_ROAD_GRAPH, startNode, endNode);
      const enriched = this.enrichRouteResult(rawResult);

      // Prepend exact pickup and append exact dropoff coordinate to form a continuous road polyline
      const fullCoordinates: [number, number][] = [
        [pickup.latitude, pickup.longitude],
        ...(enriched.coordinates || []),
        [dropoff.latitude, dropoff.longitude],
      ];

      routeOutput = {
        ...enriched,
        coordinates: fullCoordinates,
      };
    }

    return routeOutput;
  }

  /**
   * Helper to attach road junction GPS coordinates and waypoint names to the Dijkstra path
   */
  private static enrichRouteResult(rawResult: RouteCalculationOutput): RouteCalculationOutput {
    if (rawResult.distance === -1 || rawResult.path.length === 0) {
      return rawResult;
    }

    const coordinates: [number, number][] = rawResult.path.map((nodeId) => {
      const info = DELHI_NCR_ROAD_NODES[nodeId];
      return [info.latitude, info.longitude];
    });

    const waypoints: RoadNodeInfo[] = rawResult.path.map((nodeId) => DELHI_NCR_ROAD_NODES[nodeId]);

    return {
      ...rawResult,
      coordinates,
      waypoints,
    };
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
      const isTypeScript = __filename.endsWith('.ts');
      const workerFilePath = isTypeScript
        ? path.resolve(__dirname, '../workers/dijkstra.worker.ts')
        : path.resolve(__dirname, '../workers/dijkstra.worker.js');

      const workerData: RouteCalculationInput = { graph, startNode, endNode };

      const worker = new Worker(workerFilePath, {
        workerData,
        execArgv: isTypeScript ? ['--import', 'tsx'] : undefined,
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