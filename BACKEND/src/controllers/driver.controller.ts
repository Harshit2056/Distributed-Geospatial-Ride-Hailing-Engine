import { Response } from 'express';
import { AuthRequest } from '../types/auth.types.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { GeoService } from '../services/geo.service.js';

export class DriverController {
  static updateLocation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const driverId = req.user?.userId;
    const { latitude, longitude } = req.body;

    if (!driverId) {
      throw new ApiError(401, 'Driver ID missing from authenticated user');
    }

    if (latitude === undefined || longitude === undefined) {
      throw new ApiError(400, 'latitude and longitude coordinates are required');
    }

    const lat = Number(latitude);
    const lon = Number(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      throw new ApiError(400, 'Coordinates must be valid numbers');
    }

    const cellIndex = await GeoService.updateDriverLocation(driverId, lat, lon);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          driverId,
          h3Index: cellIndex,
          coordinates: { latitude: lat, longitude: lon },
        },
        'Driver location updated in H3 Hexagon Grid'
      )
    );
  });

  static getNearbyDrivers = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { latitude, longitude, ringSize } = req.query;

    if (!latitude || !longitude) {
      throw new ApiError(400, 'latitude and longitude query parameters are required');
    }

    const lat = Number(latitude);
    const lon = Number(longitude);
    const rings = ringSize ? Number(ringSize) : 1; // Default 1 ring (center + 6 neighbors)

    if (isNaN(lat) || isNaN(lon) || isNaN(rings)) {
      throw new ApiError(400, 'Query parameters must be valid numbers');
    }

    const currentUserId = req.user?.userId;
    const drivers = await GeoService.findNearbyDrivers(lat, lon, rings);

    // Filter out the requesting user (agar same user driver pool me register ho)
    const filteredDrivers = drivers.filter((d) => d.driverId !== currentUserId);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          totalNearby: filteredDrivers.length,
          ringSizeUsed: rings,
          drivers: filteredDrivers,
        },
        'Nearby drivers fetched successfully via H3 grid'
      )
    );
  });
}