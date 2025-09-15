import { Redis } from '@upstash/redis';

export default async function handler(request, response) {
  const redis = new Redis({
    url: process.env.REDIS_KV_URL || 'https://dominant-porpoise-20738.upstash.io',
    token: process.env.REDIS_KV_REST_API_TOKEN || 'AVECAAIncDExNWRmNGI0ODllZDU0ZmE5ODZkZDcyMTU1YTQ2NWRlYXAxMjA3Mzg',
  });

  try {
    await redis.set('last_keep_alive_timestamp', new Date().toISOString());
    console.log('Successfully pinged Redis to keep it alive.');
    return response.status(200).json({ message: 'Redis keep-alive ping successful.' });
  } catch (error) {
    console.error('Error pinging Redis:', error);
    return response.status(500).json({ message: 'Error pinging Redis.', error: error.message });
  }
}
