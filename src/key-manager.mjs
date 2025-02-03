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

  getNextAvailableKey() {
    const currentKey = this.keys[this.currentKeyIndex];
    const now = Date.now();

    // 确保当前 key 在 Map 中有一个数组
    if (!this.requestTimestamps.has(currentKey)) {
      this.requestTimestamps.set(currentKey, []);
    }

    // 获取当前存储的时间戳
    let timestamps = this.requestTimestamps.get(currentKey);

    // 清理60秒前的请求记录并立即更新存储
    timestamps = timestamps.filter(ts => now - ts < 60000);
    this.requestTimestamps.set(currentKey, timestamps);

    // 先记录新的请求时间戳，再进行判断
    timestamps.push(now);

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      type: 'keyandtime',
      validTimestamps: timestamps,
      currentKey,
      requestCount: timestamps.length
    }, null, 2));

    // 如果最近一分钟内的请求达到10次，切换到下一个key
    if (timestamps.length > 10) {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
      // 移除刚才添加的时间戳，因为这个key已经超限了
      timestamps.pop();
      return this.getNextAvailableKey();
    }

    return currentKey;
  }
}

const keyManager = new KeyManager();

export default keyManager; 