import { kv } from '@vercel/kv'

export class KeyManager {
  constructor(keys) {
    this.keys = keys;
    this.currentKeyIndex = 0;
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
        // 清理过期数据并获取当前请求数
        const requests = await kv.zrange(redisKey, 0, -1, { withScores: true });
        const cutoff = now - 60000;

        // 过滤出未过期的请求
        const validRequests = requests.filter(([_, timestamp]) => timestamp > cutoff);

        if (validRequests.length < 10) {
          // 清除所有旧数据
          await kv.del(redisKey);

          // 添加所有有效请求
          if (validRequests.length > 0) {
            await kv.zadd(redisKey, ...validRequests.flat());
          }

          // 添加新请求
          await kv.zadd(redisKey, { [`req:${now}`]: now });

          console.log(`使用 key: ${currentKey.substring(0, 12)}...`);
          return currentKey;
        }

        // 尝试下一个key
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
        checkedKeysCount++;

      } catch (error) {
        console.error(`Vercel KV 操作错误: `, error);
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