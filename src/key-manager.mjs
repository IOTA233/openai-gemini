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
    const currentKey = this.keys[this.currentKeyIndex];
    const now = Date.now();
    const redisKey = `api-requests:${currentKey}`;

    try {
      // 打印当前 Redis 中的原始数据
      console.log('===== Redis 原始数据 =====');
      const allData = await this.redis.zrange(redisKey, 0, -1, 'WITHSCORES');
      console.log('Redis key:', redisKey);
      console.log('Raw data:', allData);

      // 打印格式化后的数据
      console.log('\n===== 格式化数据 =====');
      const formattedData = [];
      for (let i = 0; i < allData.length; i += 2) {
        formattedData.push({
          timestamp: new Date(parseInt(allData[i])).toISOString(),
          score: parseInt(allData[i + 1]),
          age: `${Math.round((now - parseInt(allData[i])) / 1000)}秒前`
        });
      }
      console.log(JSON.stringify(formattedData, null, 2));
      console.log('总请求数:', allData.length / 2);
      console.log('========================\n');

      // 原有的清理逻辑
      await this.redis.zremrangebyscore(redisKey, '-inf', now - 60000);

      // 2. 获取当前有效的请求记录
      const validTimestamps = await this.redis.zrange(redisKey, 0, -1, 'WITHSCORES');

      // 格式化时间戳以便更好地查看
      const formattedTimestamps = [];
      for (let i = 0; i < validTimestamps.length; i += 2) {
        formattedTimestamps.push({
          timestamp: new Date(parseInt(validTimestamps[i])).toISOString(),
          score: parseInt(validTimestamps[i + 1])
        });
      }

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        type: 'keyandtime',
        validTimestamps: formattedTimestamps,
        currentKey,
        requestCount: validTimestamps.length / 2
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