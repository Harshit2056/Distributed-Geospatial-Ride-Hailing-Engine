import { pool } from '../config/db.js';
import { redis } from '../config/redis.js';
import { GeoService } from './geo.service.js';
import { RoutingService } from './routing.service.js';
import { ApiError } from '../utils/ApiError.js';
import { RideRecord, RideRequestPayload, RideStatus } from '../types/ride.types.js';
import { getIO } from '../socket/index.js';
import { SurgeService } from './surge.service.js';
import { PaymentService } from './payment.service.js';

export class RideService {
  // Finite State Machine Allowed Transitions
  private static readonly ALLOWED_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
    REQUESTED: ['MATCHED', 'CANCELLED'],
    MATCHED: ['IN_TRANSIT', 'CANCELLED'],
    IN_TRANSIT: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: [],
  };

  static async requestAndMatchRide(riderId: string, payload: RideRequestPayload): Promise<RideRecord> {
    const { pickup, dropoff } = payload;

    // 1. Demand record karein (Surge metric window)
    await SurgeService.recordRideDemand(pickup.latitude, pickup.longitude);

    // 2. Dijkstra shortest path distance nikaalein (Delhi NCR Road Graph)
    const routeResult = await RoutingService.calculateRouteBetweenPoints(pickup, dropoff);
    const baseFare = 50.0;
    const perUnitDistanceRate = 12.5;
    const rawFare = baseFare + routeResult.distance * perUnitDistanceRate;

    // 3. Dynamic Surge Multiplier calculate karein
    const { multiplier } = await SurgeService.getSurgeMultiplier(pickup.latitude, pickup.longitude);
    const totalFare = Number((rawFare * multiplier).toFixed(2));

    console.log(`Base Fare: ₹${rawFare} | Surge: ${multiplier}x | Final Fare: ₹${totalFare}`);

    // 4. Pickup location ke aas-paas H3 grid se available drivers dhoondhein
    const nearbyDrivers = await GeoService.findNearbyDrivers(pickup.latitude, pickup.longitude, 1);
    
    // Rider khud ko driver assign na kare
    const eligibleDrivers = nearbyDrivers.filter((d) => d.driverId !== riderId);

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      let matchedDriverId: string | null = null;

      // 5. Pehle available driver par Redis atomic lock try karein (Double-booking Mutex)
      for (const driver of eligibleDrivers) {
        const lockKey = `lock:driver:${driver.driverId}`;
        const acquired = await redis.set(lockKey, 'BUSY', 'EX', 600, 'NX');

        if (acquired === 'OK') {
          matchedDriverId = driver.driverId;
          break;
        }
      }

      const initialStatus: RideStatus = matchedDriverId ? 'MATCHED' : 'REQUESTED';

      // 6. Ride record insert karein
      const insertQuery = `
        INSERT INTO rides (rider_id, driver_id, pickup_lat, pickup_lon, dropoff_lat, dropoff_lon, fare, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
      `;
      const values = [
        riderId,
        matchedDriverId,
        pickup.latitude,
        pickup.longitude,
        dropoff.latitude,
        dropoff.longitude,
        totalFare,
        initialStatus,
      ];

      const result = await client.query(insertQuery, values);
      await client.query('COMMIT');

      const createdRide: RideRecord = result.rows[0];

      // 7. Post-commit: driver ko active available pool se remove karein aur socket alert bhejein
      if (matchedDriverId) {
        await GeoService.removeDriverLocation(matchedDriverId);

        // Fetch driver info for rider UI clarity
        try {
          const driverRes = await pool.query('SELECT name, email FROM users WHERE id = $1;', [matchedDriverId]);
          if (driverRes.rows.length > 0) {
            (createdRide as any).driver_name = driverRes.rows[0].name;
            (createdRide as any).driver_email = driverRes.rows[0].email;
          }
        } catch (e) {
          console.warn('Could not fetch driver profile for ride:', e);
        }

        try {
          const io = getIO();
          // Matched driver ke private room me alert bhejein
          io.to(`user:${matchedDriverId}`).emit('new_ride_assigned', {
            rideId: createdRide.id,
            riderId: createdRide.rider_id,
            pickup,
            dropoff,
            fare: totalFare,
            status: createdRide.status,
          });
        } catch (err) {
          console.warn('Socket alert failed:', err);
        }
      }

      return createdRide;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Fetch the active ride for either RIDER or DRIVER to restore state on login/refresh
   */
  static async getActiveRideForUser(userId: string, role: string): Promise<any | null> {
    let query: string;
    let values: any[];

    if (role === 'DRIVER') {
      query = `
        SELECT r.*, u.name as rider_name, u.email as rider_email
        FROM rides r
        JOIN users u ON r.rider_id = u.id
        WHERE r.driver_id = $1 AND r.status IN ('MATCHED', 'IN_TRANSIT')
        ORDER BY r.created_at DESC
        LIMIT 1;
      `;
      values = [userId];
    } else {
      query = `
        SELECT r.*, d.name as driver_name, d.email as driver_email
        FROM rides r
        LEFT JOIN users d ON r.driver_id = d.id
        WHERE r.rider_id = $1 AND r.status IN ('REQUESTED', 'MATCHED', 'IN_TRANSIT')
        ORDER BY r.created_at DESC
        LIMIT 1;
      `;
      values = [userId];
    }

    const result = await pool.query(query, values);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  static async updateRideStatus(rideId: string, newStatus: RideStatus, _requesterId: string): Promise<RideRecord> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Row-level lock: rides row ko lock karein taaki concurrent update race condition na bane
      const selectQuery = 'SELECT * FROM rides WHERE id = $1 FOR UPDATE;';
      const selectResult = await client.query(selectQuery, [rideId]);

      if (selectResult.rows.length === 0) {
        throw new ApiError(404, 'Ride not found');
      }

      const currentRide: RideRecord = selectResult.rows[0];

      // FSM Validation: Transition valid hai ya nahi
      const allowedNextStates = this.ALLOWED_TRANSITIONS[currentRide.status];
      if (!allowedNextStates.includes(newStatus)) {
        throw new ApiError(
          400,
          `Invalid state transition: Cannot change status from ${currentRide.status} to ${newStatus}`
        );
      }

      // Update query
      const updateQuery = `
        UPDATE rides 
        SET status = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2 
        RETURNING *;
      `;
      const updateResult = await client.query(updateQuery, [newStatus, rideId]);

      await client.query('COMMIT');

      const updatedRide: RideRecord = updateResult.rows[0];

      // Driver lock release on completion/cancellation
      if (newStatus === 'COMPLETED' && currentRide.driver_id) {
        // 1. Redis Mutex release
        await redis.del(`lock:driver:${currentRide.driver_id}`);

        // 2. Trigger Payment Settlement
        await PaymentService.processRidePayment(
          rideId,
          currentRide.rider_id,
          currentRide.driver_id,
          Number(currentRide.fare)
        );
      }

      // Real-time notification: Room aur dono users ko state transition broadcast karein
      try {
        const io = getIO();
        io.to(`ride:${rideId}`).emit('ride_status_updated', {
          rideId,
          status: newStatus,
          updatedAt: updatedRide.updated_at,
        });
      } catch (err) {
        console.warn('Failed to broadcast status update via socket:', err);
      }

      return updatedRide;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}