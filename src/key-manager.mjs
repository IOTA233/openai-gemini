import { Redis } from 'ioredis';

class KeyManager {
  constructor() {
    this.keys = [];
    this.currentKeyIndex = 0;
    console.log('REDIS_KV_URL:', process.env.REDIS_KV_URL);
    this.redis = new Redis({
      url: 'https://cunning-gull-10062.upstash.io',
      token: 'ASdOAAIjcDE3Yzk1NjY1MmRlM2I0Y2FhYmI4ZDNkZjkyODQ0MGVkNXAxMA',
    })
  }

  initializeKeys(apiKeys) {
    if (!apiKeys) {
      console.log('No API keys provided');
      return;
    }
    this.keys = apiKeys.split(',').map(key => key.trim());
    console.log('Initialized keys:', this.keys);
  }

  async getNextAvailableKey() {
    const currentKey = this.keys[this.currentKeyIndex];
    const now = Date.now();
    const redisKey = `api-requests:${currentKey}`;

    try {
      // 使用 Redis 的 Sorted Set 存储时间戳
      // 1. 清理60秒前的请求记录
      await this.redis.zremrangebyscore(redisKey, '-inf', now - 60000);

      // 2. 获取当前有效的请求记录
      const validTimestamps = await this.redis.zrange(redisKey, 0, -1, 'WITHSCORES');

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        type: 'keyandtime',
        validTimestamps: validTimestamps,
        currentKey,
        requestCount: validTimestamps.length / 2  // WITHSCORES 会返回成对的值
      }, null, 2));

      // 3. 检查是否需要切换到下一个 key
      if (validTimestamps.length / 2 >= 10) {
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
        return this.getNextAvailableKey();
      }

      // 4. 添加新的请求记录
      await this.redis.zadd(redisKey, now, now.toString());

      return currentKey;
    } catch (error) {
      console.error('Redis 操作错误:', error);
      // 发生错误时返回当前 key，避免服务中断
      return currentKey;
    }
  }

  // 可选：添加清理方法
  async cleanup() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

const keyManager = new KeyManager();

export default keyManager; 