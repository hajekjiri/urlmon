import dotenv = require('dotenv-safe');

describe('database', () => {
  describe('configuration', () => {
    it('should be stored in the .env file', () => {
      dotenv.config();
    });
  });
});
