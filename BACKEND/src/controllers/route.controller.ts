import { Response } from 'express';
import { AuthRequest } from '../types/auth.types.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { RoutingService } from '../services/routing.service.js';
import { RoadNetworkGraph } from '../types/routing.types.js';

// Pre-defined road intersections graph (City Model)
const CITY_ROAD_NETWORK: RoadNetworkGraph = {
  1: [{ node: 2, weight: 10 }, { node: 3, weight: 30 }],
  2: [{ node: 3, weight: 12 }, { node: 4, weight: 45 }],
  3: [{ node: 4, weight: 15 }, { node: 5, weight: 60 }],
  4: [{ node: 5, weight: 20 }],
  5: [],
};

export class RouteController {
  static getOptimalRoute = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { startNode, endNode } = req.body;

    if (startNode === undefined || endNode === undefined) {
      throw new ApiError(400, 'startNode and endNode are required');
    }

    const start = Number(startNode);
    const end = Number(endNode);

    if (isNaN(start) || isNaN(end)) {
      throw new ApiError(400, 'startNode and endNode must be numbers');
    }

    const routeData = await RoutingService.runDijkstra(CITY_ROAD_NETWORK, start, end);

    if (routeData.distance === -1) {
      throw new ApiError(404, `No reachable route found between node ${start} and node ${end}`);
    }

    return res.status(200).json(
      new ApiResponse(200, routeData, 'Optimal path and ETA calculated successfully via Worker Thread')
    );
  });
}