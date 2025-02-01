class KeyManager {
  constructor() {
    this.keys = [];
    this.currentKeyIndex = 0;
    this.requestCounts = new Map(); // 记录每个key的请求次数
    this.pendingRequests = new Map(); // 记录每个key的待处理请求数
  }

  initializeKeys(apiKeys) {
    if (!apiKeys) return;
    this.keys = apiKeys.split(',').map(key => key.trim());
    // 初始化每个key的计数器
    this.keys.forEach(key => {
      if (!this.requestCounts.has(key)) {
        this.requestCounts.set(key, 0);
        this.pendingRequests.set(key, 0);
      }
    });
  }

  async getNextAvailableKey() {
    if (this.keys.length === 0) {
      throw new Error("No API keys available");
    }

    const currentKey = this.keys[this.currentKeyIndex];
    const currentCount = this.requestCounts.get(currentKey);
    const pendingCount = this.pendingRequests.get(currentKey);
    const totalRequests = currentCount + pendingCount;

    // 如果当前key的总请求数（已完成+待处理）达到10次，切换到下一个key
    if (totalRequests >= 10) {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
      // 重置新key的计数
      const newKey = this.keys[this.currentKeyIndex];
      this.requestCounts.set(newKey, 0);
      this.pendingRequests.set(newKey, 0);

      // 记录key切换日志
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        type: 'key_switch',
        previousKey: `...${currentKey.slice(-4)}`,
        newKey: `...${newKey.slice(-4)}`,
        reason: 'Request limit reached'
      }));

      return this.getNextAvailableKey();
    }

    // 增加待处理请求计数
    this.pendingRequests.set(currentKey, pendingCount + 1);

    // 异步处理请求完成后的计数更新
    setTimeout(() => {
      this.pendingRequests.set(currentKey, this.pendingRequests.get(currentKey) - 1);
      this.requestCounts.set(currentKey, this.requestCounts.get(currentKey) + 1);

      // 记录请求计数日志
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        type: 'key_usage',
        key: `...${currentKey.slice(-4)}`,
        completedRequests: this.requestCounts.get(currentKey),
        pendingRequests: this.pendingRequests.get(currentKey)
      }));
    }, 0);

    return currentKey;
  }

  // 用于重置计数器（每分钟调用一次）
  resetCounters() {
    this.keys.forEach(key => {
      this.requestCounts.set(key, 0);
      this.pendingRequests.set(key, 0);
    });
    this.currentKeyIndex = 0;

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      type: 'counters_reset',
      message: 'All key counters have been reset'
    }));
  }
}

const keyManager = new KeyManager();

// 设置每分钟重置计数器
setInterval(() => {
  keyManager.resetCounters();
}, 60 * 1000);

export default keyManager; 