import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { AuthRequest } from '../types/auth.types.js';
import { RideService } from '../services/ride.service.js';
import { RideStatus } from '../types/ride.types.js';

export class RideController {
  static requestRide = asyncHandler(async (req: AuthRequest, res: Response) => {
    const riderId = req.user?.userId;
    if (!riderId) {
      throw new ApiError(401, 'Unauthorized rider');
    }

    const { pickup, dropoff, pickupNodeId, dropoffNodeId } = req.body;
    if (!pickup?.latitude || !pickup?.longitude || !dropoff?.latitude || !dropoff?.longitude) {
      throw new ApiError(400, 'Valid pickup and dropoff coordinates are required');
    }

    const ride = await RideService.requestAndMatchRide(riderId, {
      pickup,
      dropoff,
      pickupNodeId: Number(pickupNodeId || 1),
      dropoffNodeId: Number(dropoffNodeId || 5),
    });

    return res.status(201).json(
      new ApiResponse(201, ride, 'Ride requested and processed successfully')
    );
  });

  static updateStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const requesterId = req.user?.userId;
    const { rideId } = req.params;
    const { status } = req.body;

    if (!requesterId) {
      throw new ApiError(401, 'Unauthorized request');
    }

    if (!status) {
      throw new ApiError(400, 'Target status is required');
    }

    const updatedRide = await RideService.updateRideStatus(rideId, status as RideStatus, requesterId);

    return res.status(200).json(
      new ApiResponse(200, updatedRide, `Ride status updated to ${status}`)
    );
  });

  static getActiveRide = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!userId) {
      throw new ApiError(401, 'Unauthorized request: Missing user identity');
    }

    const activeRide = await RideService.getActiveRideForUser(userId, role || 'RIDER');

    return res.status(200).json(
      new ApiResponse(200, activeRide, 'Active ride fetched successfully')
    );
  });
}