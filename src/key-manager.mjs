class KeyManager {
  constructor() {
    this.keys = new Map(); // 存储key信息
    this.currentKeyIndex = 0;
  }

  // 添加新的API key
  addKey(key, rateLimit = 10) {
    this.keys.set(key, {
      key,
      rateLimit,  // 每分钟请求限制
      requestCount: 0,  // 当前分钟的请求数
      lastResetTime: Date.now(),  // 上次重置计数的时间
      isAvailable: true  // 当前key是否可用
    });
  }

  // 重置指定key的请求计数
  resetKeyCount(keyInfo) {
    const now = Date.now();
    if (now - keyInfo.lastResetTime >= 60000) { // 60秒 = 1分钟
      keyInfo.requestCount = 0;
      keyInfo.lastResetTime = now;
      keyInfo.isAvailable = true;
    }
  }

  // 获取下一个可用的key
  getNextAvailableKey() {
    const now = Date.now();

    // 检查所有key的状态
    for (let keyInfo of this.keys.values()) {
      this.resetKeyCount(keyInfo);
    }

    // 查找可用的key
    for (let keyInfo of this.keys.values()) {
      if (keyInfo.isAvailable && keyInfo.requestCount < keyInfo.rateLimit) {
        keyInfo.requestCount++;
        if (keyInfo.requestCount >= keyInfo.rateLimit) {
          keyInfo.isAvailable = false;
        }
        return keyInfo.key;
      }
    }

    // 如果没有可用的key，返回null或抛出错误
    throw new Error('No available API keys at the moment. Please try again later.');
  }

  // 初始化keys
  initializeKeys(keys) {
    if (!Array.isArray(keys)) {
      // 如果传入的是单个key，转换为数组
      keys = [{ key: keys, rateLimit: 10 }];
    }

    // 清除现有的keys
    this.keys.clear();

    // 添加新的keys
    keys.forEach(({ key, rateLimit }) => {
      this.addKey(key, rateLimit);
    });
  }
}

// 创建单例实例
const keyManager = new KeyManager();

export default keyManager; 