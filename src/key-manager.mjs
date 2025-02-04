import { Redis } from '@upstash/redis'

export class KeyManager {
  constructor(keys) {
    this.keys = keys;
    this.currentKeyIndex = 0;

    // 使用 @upstash/redis 替代 ioredis
    this.redis = new Redis({
      url: 'https://cunning-gull-10062.upstash.io',
      token: 'ASdOAAIjcDE3Yzk1NjY1MmRlM2I0Y2FhYmI4ZDNkZjkyODQ0MGVkNXAxMA',
    })

    // 不再需要事件监听器，因为 @upstash/redis 使用 REST API
    console.log('Initialized Redis connection');
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
    // 确保 keys 存在
    if (!this.keys || this.keys.length === 0) {
      console.error('No API keys available');
      return null;
    }

    const currentKey = this.keys[this.currentKeyIndex];
    const now = Date.now();
    const redisKey = `api-requests:${currentKey}`;

    try {
      // 1. 清理过期数据（60秒前的数据）
      await this.redis.zremrangebyscore(redisKey, '-inf', now - 60000);

      // 2. 获取当前有效的请求记录
      const validTimestamps = await this.redis.zrange(redisKey, 0, -1, {
        withScores: true
      });

      // 3. 检查是否需要切换到下一个 key
      if (validTimestamps.length >= 10) {
        console.log(`Key ${currentKey} has reached limit, switching to next key`);
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
        return this.getNextAvailableKey(); // 递归调用获取下一个可用的 key
      }

      // 4. 记录新的请求
      const member = `req:${now}`;
      await this.redis.zadd(redisKey, {
        score: now,
        member: member
      });

      // 5. 打印调试信息
      console.log({
        timestamp: new Date().toISOString(),
        key: currentKey,
        requestCount: validTimestamps.length + 1,
        latestRequest: member
      });

      return currentKey;
    } catch (error) {
      console.error('Redis 操作错误:', error);
      return currentKey; // 发生错误时返回当前 key
    }
  }

  // 添加清理方法
  async cleanup() {
    // Upstash Redis 客户端不需要显式关闭连接
    console.log('Cleanup completed');
  }
}

const keyManager = new KeyManager();

export default keyManager; 