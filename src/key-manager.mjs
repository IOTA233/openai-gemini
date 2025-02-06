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
    if (!this.keys || this.keys.length === 0) {
      console.error('No API keys available');
      return null;
    }

    const now = Date.now();
    let checkedKeysCount = 0;
    let earliestExpiry = Infinity;
    const startIndex = this.currentKeyIndex;

    while (checkedKeysCount < this.keys.length) {
      const currentKey = this.keys[this.currentKeyIndex];
      const redisKey = `api-requests:${currentKey}`;

      try {
        // 添加调试日志
        console.log(`检查 key: ${currentKey.substring(0, 8)}...`);

        // 获取清理前的数据量
        const beforeCount = await this.redis.zcard(redisKey);
        console.log(`清理前的请求数: ${beforeCount}`);

        // 清理过期数据
        const removedCount = await this.redis.zremrangebyscore(redisKey, '-inf', now - 60000);
        console.log(`已清理 ${removedCount} 条过期数据`);

        // 获取清理后的有效请求记录
        const validTimestamps = await this.redis.zrange(redisKey, 0, -1, 'WITHSCORES');
        console.log(`当前有效请求数: ${validTimestamps.length / 2}`);

        const recentRequests = [];
        for (let i = 0; i < validTimestamps.length; i += 2) {
          recentRequests.push([validTimestamps[i], parseInt(validTimestamps[i + 1])]);
        }

        // 如果60秒内的请求少于10个，使用当前key
        if (recentRequests.length < 10) {
          const member = `req:${now}`;
          await this.redis.zadd(redisKey, {
            score: now,
            member: member
          });

          console.log(`使用 API key: ${currentKey.substring(0, 8)}...，当前请求数: ${recentRequests.length + 1}`);
          return currentKey;
        }

        // 计算当前key的最早可用时间
        if (recentRequests.length > 0) {
          const oldestTimestamp = recentRequests[0][1];
          const expiryTime = oldestTimestamp + 60000;
          earliestExpiry = Math.min(earliestExpiry, expiryTime);
        }

        // 尝试下一个key
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
        checkedKeysCount++;

      } catch (error) {
        console.error(`Redis 操作详细错误:`, error);
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
        checkedKeysCount++;
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