class KeyManager {
  constructor() {
    this.keys = new Map(); // 存储key信息
    this.RATE_LIMIT = 10;  // 默认每分钟10次请求
  }

  // 添加新的API key
  addKey(key) {
    this.keys.set(key, {
      key,
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
    // 检查所有key的状态
    for (let keyInfo of this.keys.values()) {
      this.resetKeyCount(keyInfo);
    }

    // 查找可用的key
    for (let keyInfo of this.keys.values()) {
      if (keyInfo.isAvailable && keyInfo.requestCount < this.RATE_LIMIT) {
        keyInfo.requestCount++;
        if (keyInfo.requestCount >= this.RATE_LIMIT) {
          keyInfo.isAvailable = false;
        }
        return keyInfo.key;
      }
    }

    // 如果没有可用的key，抛出错误
    throw new Error('所有API密钥已达到速率限制，请稍后再试');
  }

  // 初始化keys
  initializeKeys(keys) {
    // 如果传入的是单个key，转换为数组
    const keyArray = keys.includes(',') ? keys.split(',') : [keys];

    // 清除现有的keys
    this.keys.clear();

    // 添加新的keys
    keyArray.forEach(key => {
      this.addKey(key.trim());
    });
  }
}

// 创建单例实例
const keyManager = new KeyManager();

export default keyManager; 