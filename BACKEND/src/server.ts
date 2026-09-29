import dotenv from 'dotenv';
import { pool } from './config/db.js';
import { app } from './app.js';

dotenv.config();

const PORT = process.env.PORT || 8080;

// Test DB Connection on Startup
pool.query('SELECT 1')
  .then(() => console.log(' PostgreSQL Database connected successfully!'))
  .catch((err) => console.error('❌ PostgreSQL connection failed:', err));



// Start the server
app.listen(PORT, () => {
  console.log(` Server is running on http://localhost:${PORT}`);
});
