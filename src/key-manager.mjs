import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: 'https://redis.ivresse.de',
  token: '1111122222',
  retry: {
    retries: 3,
    backoff: (retryCount) => Math.min(retryCount * 100, 3000)
  }
});

export class KeyManager {
  constructor(keys) {
    this.keys = keys;
    this.currentKeyIndex = 0;
    this.redis = redis;
  }

  async getNextAvailableKey() {
    if (!this.keys || this.keys.length === 0) {
      console.error('No API keys available');
      return null;
    }

    const now = Date.now();
    let checkedKeysCount = 0;

    while (checkedKeysCount < this.keys.length) {
      const currentKey = this.keys[this.currentKeyIndex];
      const redisKey = `api-requests:${currentKey}`;

      try {
        // 使用 Redis 的原子操作来处理计数
        // 1. 移除过期的请求
        // 2. 添加新请求
        // 3. 获取当前有效请求数
        // 使用 Lua 脚本确保操作的原子性
        const luaScript = `
          local key = KEYS[1]
          local now = tonumber(ARGV[1])
          local cutoff = now - 60000
          
          -- 清理过期数据
          redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)
          
          -- 获取当前请求数
          local count = redis.call('ZCARD', key)
          
          -- 如果请求数小于10，添加新请求
          if count < 10 then
            redis.call('ZADD', key, now, 'req:' .. now)
            return 1
          end
          
          return 0
        `;

        const result = await this.redis.eval(
          luaScript,
          [redisKey],
          [now.toString()]
        );

        if (result === 1) {
          console.log(`使用 key: ${currentKey.substring(0, 12)}...`);
          return currentKey;
        }

        // 尝试下一个key
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
        checkedKeysCount++;

      } catch (error) {
        console.error(`Redis 操作错误: `, error);

        if (error.message?.includes('max daily request limit exceeded')) {
          console.error('已达到 Redis 每日请求限制');
          return null;
        }

        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
        checkedKeysCount++;
      }
    }

    console.log('所有 API keys 都已达到速率限制');
    return null;
  }

  initializeKeys(apiKeys) {
    if (!apiKeys) {
      console.log('No API keys provided');
      return;
    }
    this.keys = apiKeys.split(',').map(key => key.trim());
    console.log('Initialized keys:', this.keys);
  }

  async cleanup() {
    console.log('Cleanup completed');
  }
}

const keyManager = new KeyManager();
export default keyManager; 