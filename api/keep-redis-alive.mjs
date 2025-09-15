import { Redis } from '@upstash/redis';

export default async function handler(request, response) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
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
