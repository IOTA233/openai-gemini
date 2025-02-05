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
    console.log('getNextAvailableKey');
    // 确保 keys 存在
    if (!this.keys || this.keys.length === 0) {
      console.error('No API keys available');
      return null;
    }

    // 记录已检查的key数量
    let checkedKeysCount = 0;
    let earliestExpiry = Infinity;
    const startIndex = this.currentKeyIndex;

    while (checkedKeysCount < this.keys.length) {
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

        // 3. 如果当前key未达到限制，直接使用
        if (validTimestamps.length < 10) {
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
        }

        // 记录最早的过期时间
        if (validTimestamps.length > 0) {
          const oldestTimestamp = parseInt(validTimestamps[0][1]);
          const expiryTime = oldestTimestamp + 60000;
          earliestExpiry = Math.min(earliestExpiry, expiryTime);
        }

        // 移动到下一个key
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
        checkedKeysCount++;

      } catch (error) {
        console.error('Redis 操作错误:', error);
        checkedKeysCount++;
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
        continue;
      }
    }

    // 如果所有key都检查完且都超限了
    if (earliestExpiry !== Infinity) {
      const now = Date.now();
      const waitTime = Math.max(0, earliestExpiry - now);
      console.log(`所有key都已达到限制，等待 ${Math.ceil(waitTime / 1000)} 秒后重试`);
      console.log('调试信息:', { earliestExpiry, now, waitTime });
      await new Promise(resolve => setTimeout(resolve, waitTime));

      // 重置索引到起始位置
      this.currentKeyIndex = startIndex;
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