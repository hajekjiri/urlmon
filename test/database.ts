import dotenv from 'dotenv-safe';
import { initDbConnection, getDbPool } from '../utils/database';

describe('database', () => {
  describe('configuration', () => {
    it('should be stored in the .env file', () => {
      dotenv.config();
    });
  });
  describe('connection', () => {
    it('should be established', async () => {
      dotenv.config();
      await initDbConnection();
      const pool = getDbPool();
      pool.end();
    });
  });
});
