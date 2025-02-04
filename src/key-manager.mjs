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

    // 添加已检查key的集合
    const checkedIndices = new Set();
    let earliestExpiry = Infinity;

    // 循环检查所有key直到找到可用的或者所有key都检查过
    while (checkedIndices.size < this.keys.length) {
      const currentKey = this.keys[this.currentKeyIndex];
      const now = Date.now();
      const redisKey = `api-requests:${currentKey}`;

      try {
        await this.redis.zremrangebyscore(redisKey, '-inf', now - 60000);
        const validTimestamps = await this.redis.zrange(redisKey, 0, -1, {
          withScores: true
        });

        if (validTimestamps.length < 10) {
          // 找到可用的key
          const member = `req:${now}`;
          await this.redis.zadd(redisKey, {
            score: now,
            member: member
          });

          console.log({
            timestamp: new Date().toISOString(),
            key: currentKey,
            requestCount: validTimestamps.length + 1,
            latestRequest: member
          });

          return currentKey;
        }

        // 记录这个key的最早过期时间
        if (validTimestamps.length > 0) {
          const oldestTimestamp = validTimestamps[0].score;
          const expiryTime = oldestTimestamp + 60000; // 60秒后过期
          earliestExpiry = Math.min(earliestExpiry, expiryTime);
        }

        // 标记当前key已检查
        checkedIndices.add(this.currentKeyIndex);
        // 移动到下一个key
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
      } catch (error) {
        console.error('Redis 操作错误:', error);
        return currentKey;
      }
    }

    // 如果所有key都超限了，等待最早的过期时间
    if (earliestExpiry !== Infinity) {
      const waitTime = earliestExpiry - Date.now();
      console.log(`所有key都已达到限制，等待 ${Math.ceil(waitTime / 1000)} 秒后重试`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.getNextAvailableKey();
    }

    console.error('所有key都不可用，且没有找到有效的过期时间');
    return null;
  }

  // 添加清理方法
  async cleanup() {
    // Upstash Redis 客户端不需要显式关闭连接
    console.log('Cleanup completed');
  }
}

const keyManager = new KeyManager();

export default keyManager; 