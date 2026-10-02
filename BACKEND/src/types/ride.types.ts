export type RideStatus = 'REQUESTED' | 'MATCHED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';

export interface LocationCoordinate {
  latitude: number;
  longitude: number;
}

export interface RideRequestPayload {
  pickup: LocationCoordinate;
  dropoff: LocationCoordinate;
  pickupNodeId: number;
  dropoffNodeId: number;
}

export interface RideRecord {
  id: string;
  rider_id: string;
  driver_id: string | null;
  pickup_lat: number;
  pickup_lon: number;
  dropoff_lat: number;
  dropoff_lon: number;
  fare: string;
  status: RideStatus;
  created_at: Date;
  updated_at: Date;
}