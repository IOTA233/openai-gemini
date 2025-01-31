class KeyManager {
  constructor() {
    this.keys = new Map(); // 存储key信息
    this.RATE_LIMIT = 10;  // 默认每分钟10次请求
    this.currentIndex = 0; // 添加一个索引来追踪当前使用的key
    this.keyArray = [];    // 保存key的数组，用于轮换
    this.logs = []; // 存储日志
    this.MAX_LOGS = 1000; // 最多保存1000条日志
  }

  // 添加日志
  addLog(key, action, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      key: this.maskKey(key), // 隐藏完整key
      action,
      ...details
    };

    this.logs.unshift(logEntry); // 在开头添加新日志

    // 保持日志数量在限制内
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.pop(); // 删除最老的日志
    }

    // 在控制台打印日志
    console.log(JSON.stringify(logEntry));
  }

  // 获取所有日志
  getLogs() {
    return this.logs;
  }

  // 隐藏key的中间部分
  maskKey(key) {
    if (key.length <= 8) return key;
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }

  // 添加新的API key
  addKey(key) {
    this.keys.set(key, {
      key,
      requestCount: 0,  // 当前分钟的请求数
      lastResetTime: Date.now(),  // 上次重置计数的时间
      isAvailable: true,  // 当前key是否可用
      totalRequests: 0    // 总请求次数
    });

    this.addLog(key, 'key_added');
  }

  // 重置指定key的请求计数
  resetKeyCount(keyInfo) {
    const now = Date.now();
    if (now - keyInfo.lastResetTime >= 60000) { // 60秒 = 1分钟
      this.addLog(keyInfo.key, 'counter_reset', {
        previousCount: keyInfo.requestCount,
        totalRequests: keyInfo.totalRequests
      });

      keyInfo.requestCount = 0;
      keyInfo.lastResetTime = now;
      keyInfo.isAvailable = true;
    }
  }

  // 初始化keys
  initializeKeys(keys) {
    // 如果传入的是单个key，转换为数组
    this.keyArray = keys.includes(',') ? keys.split(',').map(k => k.trim()) : [keys];

    this.addLog('system', 'keys_initialization', {
      keyCount: this.keyArray.length,
      keys: this.keyArray.map(k => this.maskKey(k))
    });

    // 清除现有的keys
    this.keys.clear();
    this.currentIndex = 0;

    // 添加新的keys
    this.keyArray.forEach(key => {
      this.addKey(key.trim());
    });
  }

  // 获取下一个可用的key
  getNextAvailableKey() {
    const startIndex = this.currentIndex;
    let attempts = 0;

    // 检查所有key的状态
    for (let keyInfo of this.keys.values()) {
      this.resetKeyCount(keyInfo);
    }

    // 尝试所有key直到找到一个可用的
    while (attempts < this.keyArray.length) {
      const currentKey = this.keyArray[this.currentIndex];
      const keyInfo = this.keys.get(currentKey);

      if (keyInfo.isAvailable && keyInfo.requestCount < this.RATE_LIMIT) {
        keyInfo.requestCount++;
        keyInfo.totalRequests++;

        this.addLog(currentKey, 'key_used', {
          keyIndex: this.currentIndex,
          currentMinuteRequests: keyInfo.requestCount,
          totalRequests: keyInfo.totalRequests,
          remainingQuota: this.RATE_LIMIT - keyInfo.requestCount
        });

        if (keyInfo.requestCount >= this.RATE_LIMIT) {
          keyInfo.isAvailable = false;
          this.addLog(currentKey, 'key_quota_exceeded', {
            totalRequests: keyInfo.totalRequests
          });
        }

        // 移动到下一个key，实现轮换
        this.currentIndex = (this.currentIndex + 1) % this.keyArray.length;

        return currentKey;
      }

      // 移动到下一个key
      this.currentIndex = (this.currentIndex + 1) % this.keyArray.length;
      attempts++;
    }

    // 如果没有可用的key，记录错误并抛出
    this.addLog('all', 'no_keys_available', {
      totalKeys: this.keys.size,
      keysStatus: Array.from(this.keys.values()).map(k => ({
        key: this.maskKey(k.key),
        requestCount: k.requestCount,
        isAvailable: k.isAvailable,
        totalRequests: k.totalRequests,
        currentIndex: this.currentIndex
      }))
    });

    throw new Error('所有API密钥已达到速率限制，请稍后再试');
  }

  // 获取所有key的状态
  getKeysStatus() {
    return Array.from(this.keys.values()).map(k => ({
      key: this.maskKey(k.key),
      requestCount: k.requestCount,
      isAvailable: k.isAvailable,
      totalRequests: k.totalRequests,
      lastResetTime: new Date(k.lastResetTime).toISOString()
    }));
  }
}

// 创建单例实例
const keyManager = new KeyManager();

export default keyManager; 