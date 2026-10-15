import { latLngToCell } from 'h3-js';
import { redis } from '../config/redis.js';
import { pool } from '../config/db.js';

import bcrypt from 'bcrypt';

async function seedDrivers() {
  const baseLat = 28.6315;
  const baseLon = 77.2167;
  const passwordHash = await bcrypt.hash('password123', 10);

  console.log('Seeding 10 dummy drivers...');

  for (let i = 1; i <= 10; i++) {
    const email = `driver_${i}@test.com`;
    const name = `Test Driver ${i}`;
    
    // Create driver in Postgres
    const res = await pool.query(
      `INSERT INTO users (name, email, password_hash, role) 
       VALUES ($1, $2, $3, 'DRIVER') 
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
       RETURNING id;`,
      [name, email, passwordHash]
    );

    const driverId = res.rows[0].id;

    // Slight coordinate variance (~500m radius)
    const lat = baseLat + (Math.random() - 0.5) * 0.02;
    const lon = baseLon + (Math.random() - 0.5) * 0.02;
    const h3Index = latLngToCell(lat, lon, 8);

    // Add driver to Redis H3 cell & cell tracking key
    await redis.sadd(`h3:cell:${h3Index}`, driverId);
    await redis.set(`driver:cell:${driverId}`, h3Index);
    console.log(`Added ${name} (${driverId}) -> Cell: ${h3Index}`);
  }

  console.log('Dummy drivers successfully seeded!');
  process.exit(0);
}

seedDrivers().catch(console.error);