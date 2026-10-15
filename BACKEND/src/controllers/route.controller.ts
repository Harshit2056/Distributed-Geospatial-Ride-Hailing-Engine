import { Response } from 'express';
import { AuthRequest } from '../types/auth.types.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { RoutingService } from '../services/routing.service.js';

export class RouteController {
  static getOptimalRoute = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { pickup, dropoff, startNode, endNode } = req.body;

    let routeData;

    if (pickup?.latitude && pickup?.longitude && dropoff?.latitude && dropoff?.longitude) {
      // Coordinate-based Dijkstra pathfinding on Delhi NCR road graph
      routeData = await RoutingService.calculateRouteBetweenPoints(pickup, dropoff);
    } else if (startNode !== undefined && endNode !== undefined) {
      const start = Number(startNode);
      const end = Number(endNode);

      if (isNaN(start) || isNaN(end)) {
        throw new ApiError(400, 'startNode and endNode must be valid numbers');
      }

      routeData = await RoutingService.calculateShortestPath(start, end);
    } else {
      throw new ApiError(400, 'Either pickup & dropoff coordinates or startNode & endNode must be provided');
    }

    if (routeData.distance === -1) {
      throw new ApiError(404, 'No reachable route found between specified points');
    }

    return res.status(200).json(
      new ApiResponse(200, routeData, 'Optimal path and road coordinates calculated successfully via Worker Thread Dijkstra')
    );
  });
}