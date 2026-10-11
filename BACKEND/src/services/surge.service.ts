import { redis} from '../config/redis.js';
import { latLngToCell, gridDisk } from 'h3-js';
import { aiDemandService, surgePredictionResult } from './aiDemand.service.js';

export class SurgeService {
  private static readonly H3_RESOLUTION = 8;
  private static readonly SURGE_EXPIRY_SECONDS = 300; // 5 minute window

  // 1. Ride request aane par demand counter increment karna
  static async recordRideDemand(lat: number, lon: number): Promise<string> {
    const h3Index = latLngToCell(lat, lon, this.H3_RESOLUTION);
    const demandKey = `surge:demand:${h3Index}`;

    // Demand counter badhayein aur 5 min TTL lagayein
    await redis.incr(demandKey);
    await redis.expire(demandKey, this.SURGE_EXPIRY_SECONDS);

    return h3Index;
  }

  // 2. Multiplier calculate karna
  static async getSurgeMultiplier(lat: number, lon: number): Promise<{ multiplier: number; h3Index: string; aiInsights?:surgePredictionResult }> {
    const h3Index = latLngToCell(lat, lon, this.H3_RESOLUTION);
    const neighborCells = gridDisk(h3Index, 1);

    // Step A: Active drivers (Supply) count karein
    let totalAvailableDrivers = 0;
    for (const cell of neighborCells) {
      const driverCount = await redis.scard(`h3:cell:${cell}`);
      totalAvailableDrivers += driverCount;
    }

    // Step B: Cell ke andar recent demand count karein
    const demandCountRaw = await redis.get(`surge:demand:${h3Index}`);
    const demandCount = demandCountRaw ? parseInt(demandCountRaw, 10) : 1;

    // ai predective surge evaluation

    const aiPrediction = await aiDemandService.predictSurge({
      h3Index,
      currentSupply: totalAvailableDrivers,
      currentDemand: demandCount,
    })

    return {
      multiplier: aiPrediction.predictedMultiplier,
      h3Index,
      aiInsights: aiPrediction,
    };
  }
}