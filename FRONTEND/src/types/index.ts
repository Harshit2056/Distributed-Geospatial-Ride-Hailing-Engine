export type UserRole = 'RIDER' | 'DRIVER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at?: string;
}

export type RideStatus = 'REQUESTED' | 'MATCHED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';

export interface LocationCoordinate {
  latitude: number;
  longitude: number;
}

export interface RideRecord {
  id: string;
  rider_id: string;
  driver_id: string | null;
  driver_name?: string;
  driver_email?: string;
  rider_name?: string;
  rider_email?: string;
  pickup_lat: number;
  pickup_lon: number;
  dropoff_lat: number;
  dropoff_lon: number;
  fare: string | number;
  status: RideStatus;
  created_at: string;
  updated_at: string;
}

export interface NearbyDriver {
  driverId: string;
  cellIndex: string;
}

export interface AssignedRidePayload {
  rideId: string;
  riderId?: string;
  pickup: LocationCoordinate;
  dropoff: LocationCoordinate;
  fare: number;
  status?: RideStatus;
}

export interface AiSurgeInsights {
  predictedMultiplier: number;
  demandTrend: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendedDriverRelocationCount: number;
  reasoning: string;
}

export interface SurgeData {
  multiplier: number;
  h3Index: string;
  aiInsights?: AiSurgeInsights;
}
