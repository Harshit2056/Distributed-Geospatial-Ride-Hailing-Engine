import { pool } from '../config/db.js';
import crypto from 'crypto';

export class PaymentService {
  static async processRidePayment(rideId: string, riderId: string, driverId: string, amount: number) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const mockTxnId = `TXN_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      const query = `
        INSERT INTO payments (ride_id, rider_id, driver_id, amount, status, transaction_id)
        VALUES ($1, $2, $3, $4, 'SUCCESS', $5)
        RETURNING *;
      `;
      const result = await client.query(query, [rideId, riderId, driverId, amount, mockTxnId]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}