import { latLngToCell, gridDisk } from 'h3-js';
import { redis } from '../config/redis.js';
import { ApiError } from '../utils/ApiError.js';
import { NearbyDriverResult } from '../types/geo.types.js';

export class GeoService {
  // Resolution 8: City-level pickup radius ke liye perfect (~460m hex edge)
  private static readonly RESOLUTION = 8;

  /**
   * Driver ki live location update karta hai:
   * Coordinates ko H3 index mein convert karta hai aur Redis Sets update karta hai.
   */
  static async updateDriverLocation(
    driverId: string,
    latitude: number,
    longitude: number
  ): Promise<string> {
    try {
      const newCellIndex = latLngToCell(latitude, longitude, this.RESOLUTION);
      const trackingKey = `driver:cell:${driverId}`;

      // Purani cell check karein
      const currentCell = await redis.get(trackingKey);

      // Agar driver move hokar naye hexagon mein chala gaya hai
      if (currentCell && currentCell !== newCellIndex) {
        await redis.srem(`h3:cell:${currentCell}`, driverId);
      }

      // Nayi cell mein driver add karein aur current location track karein
      const pipeline = redis.pipeline();
      pipeline.sadd(`h3:cell:${newCellIndex}`, driverId);
      pipeline.set(trackingKey, newCellIndex);
      // Optional: 2 ghante ka TTL laga sakte hain taaki inactive drivers auto-clear ho jayein
      pipeline.expire(trackingKey, 7200);
      await pipeline.exec();

      return newCellIndex;
    } catch (error: any) {
      throw new ApiError(500, `H3/Redis error updating location: ${error.message}`);
    }
  }

  /**
   * Rider ke pickup location ke hexagon aur uske surrounding rings (gridDisk) se drivers fetch karta hai.
   * ringSize = 1 ka matlab center cell + 6 immediate neighbor hexagons (total 7 cells).
   * ringSize = 2 ka matlab total 19 hexagons.
   */
  static async findNearbyDrivers(
    latitude: number,
    longitude: number,
    ringSize: number = 1
  ): Promise<NearbyDriverResult[]> {
    try {
      const originCell = latLngToCell(latitude, longitude, this.RESOLUTION);
      
      // Pickup cell ke aas-paas ke sabhi hexagon cells generate karein
      const targetCells = gridDisk(originCell, ringSize);

      if (targetCells.length === 0) return [];

      // Har cell ke drivers fetch karne ke liye keys create karein
      const cellKeys = targetCells.map((cell) => `h3:cell:${cell}`);
      
      // Redis SUNION se bina duplicate ke sabhi cells ke drivers nikal lein
      const driverIds = await redis.sunion(...cellKeys);

      return driverIds.map((driverId) => ({
        driverId,
        cellIndex: originCell,
      }));
    } catch (error: any) {
      throw new ApiError(500, `H3/Redis error fetching nearby drivers: ${error.message}`);
    }
  }

  /**
   * Driver offline jaane par ya ride match hone par availability pool se remove karna
   */
  static async removeDriverLocation(driverId: string): Promise<void> {
    try {
      const trackingKey = `driver:cell:${driverId}`;
      const cell = await redis.get(trackingKey);

      if (cell) {
        const pipeline = redis.pipeline();
        pipeline.srem(`h3:cell:${cell}`, driverId);
        pipeline.del(trackingKey);
        await pipeline.exec();
      }
    } catch (error: any) {
      throw new ApiError(500, `H3/Redis error removing driver: ${error.message}`);
    }
  }
}