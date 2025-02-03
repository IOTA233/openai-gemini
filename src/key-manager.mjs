class KeyManager {
  constructor() {
    this.keys = [];
    this.currentKeyIndex = 0;
    this.requestTimestamps = new Map(); // 只需要保留这一个计数器
  }

  initializeKeys(apiKeys) {
    if (!apiKeys) return;
    this.keys = apiKeys.split(',').map(key => key.trim());
  }

  async getNextAvailableKey() {
    const currentKey = this.keys[this.currentKeyIndex];
    const timestamps = this.requestTimestamps.get(currentKey) || [];
    const now = Date.now();

    // 清理60秒前的请求记录
    const validTimestamps = timestamps.filter(ts => now - ts < 60000);
    
    // 直接使用传入的 activeKey
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      type: 'keyandtime',
      validTimestamps,
      currentKey
    }, null, 2));
    // 如果最近一分钟内的请求达到10次，切换到下一个key
    if (validTimestamps.length >= 10) {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
      return this.getNextAvailableKey();
    }

    // 记录新的请求时间戳
    this.requestTimestamps.set(currentKey, [...validTimestamps, now]);

    return currentKey;
  }
}

const keyManager = new KeyManager();

export default keyManager; 