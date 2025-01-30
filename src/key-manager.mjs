class KeyManager {
  constructor() {
    this.keys = new Map(); // 存储key信息
    this.RATE_LIMIT = 10;  // 默认每分钟10次请求
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
        keyInfo.totalRequests++;

        this.addLog(keyInfo.key, 'key_used', {
          currentMinuteRequests: keyInfo.requestCount,
          totalRequests: keyInfo.totalRequests,
          remainingQuota: this.RATE_LIMIT - keyInfo.requestCount
        });

        if (keyInfo.requestCount >= this.RATE_LIMIT) {
          keyInfo.isAvailable = false;
          this.addLog(keyInfo.key, 'key_quota_exceeded', {
            totalRequests: keyInfo.totalRequests
          });
        }

        return keyInfo.key;
      }
    }

    // 如果没有可用的key，记录错误并抛出
    this.addLog('all', 'no_keys_available', {
      totalKeys: this.keys.size,
      keysStatus: Array.from(this.keys.values()).map(k => ({
        key: this.maskKey(k.key),
        requestCount: k.requestCount,
        isAvailable: k.isAvailable,
        totalRequests: k.totalRequests
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

  // 初始化keys
  initializeKeys(keys) {
    // 如果传入的是单个key，转换为数组
    const keyArray = keys.includes(',') ? keys.split(',') : [keys];

    this.addLog('system', 'keys_initialization', {
      keyCount: keyArray.length
    });

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