export interface DriverLocationUpdate {
  driverId: string;
  latitude: number;
  longitude: number;
}

export interface NearbyDriverResult {
  driverId: string;
  cellIndex: string;
}