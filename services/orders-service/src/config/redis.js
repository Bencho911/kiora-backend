const Redis = require('ioredis');

const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'kiora-redis',
  port: Number(process.env.REDIS_PORT) || 6379,
});

module.exports = redisClient;
