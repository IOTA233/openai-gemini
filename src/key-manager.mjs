class KeyManager {
  constructor() {
    this.keys = new Map(); // 存储key信息
    this.RATE_LIMIT = 10;  // 默认每分钟10次请求
    this.currentIndex = 0; // 添加一个索引来追踪当前使用的key
    this.keyArray = [];    // 保存key的数组，用于轮换
    this.initialized = false; // 添加初始化标志
  }

  // 初始化keys
  initializeKeys(keys) {
    // 如果已经初始化过，且keys没有变化，则不重新初始化
    const newKeyArray = keys.includes(',') ? keys.split(',').map(k => k.trim()) : [keys];
    const currentKeys = this.keyArray.join(',');
    const newKeys = newKeyArray.join(',');

    if (this.initialized && currentKeys === newKeys) {
      console.log(JSON.stringify({
        action: 'keys_already_initialized',
        ...this.getKeyStatusSummary()
      }, null, 2));
      return;
    }

    this.keyArray = newKeyArray;
    this.keys.clear();
    this.currentIndex = 0;
    this.initialized = true;

    // 添加新的keys
    this.keyArray.forEach(key => this.addKey(key.trim()));

    // 输出初始状态
    console.log(JSON.stringify({
      action: 'keys_initialized',
      ...this.getKeyStatusSummary()
    }, null, 2));
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
  }

  // 获取key状态的简要信息
  getKeyStatusSummary() {
    const now = Date.now();
    return {
      timestamp: new Date().toISOString(),
      currentKey: this.maskKey(this.keyArray[this.currentIndex]),
      keys: Array.from(this.keys.values()).map(k => ({
        key: this.maskKey(k.key),
        requestCount: k.requestCount,
        timeUntilReset: Math.max(0, 60 - Math.floor((now - k.lastResetTime) / 1000)),
        isAvailable: k.isAvailable,
        totalRequests: k.totalRequests
      }))
    };
  }

  // 隐藏key的中间部分
  maskKey(key) {
    if (key.length <= 8) return key;
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }

  // 重置指定key的请求计数
  resetKeyCount(keyInfo) {
    const now = Date.now();
    if (now - keyInfo.lastResetTime >= 60000) {
      console.log(JSON.stringify({
        action: 'reset_counter',
        key: this.maskKey(keyInfo.key),
        old_count: keyInfo.requestCount,
        reset_time: new Date(keyInfo.lastResetTime).toISOString(),
        current_time: new Date(now).toISOString()
      }));

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

    // 打印当前状态
    console.log(JSON.stringify({
      action: 'before_key_selection',
      ...this.getKeyStatusSummary()
    }, null, 2));

    const startIndex = this.currentIndex;
    let attempts = 0;

    // 尝试所有key直到找到一个可用的
    while (attempts < this.keyArray.length) {
      const currentKey = this.keyArray[this.currentIndex];
      const keyInfo = this.keys.get(currentKey);

      console.log(JSON.stringify({
        action: 'checking_key',
        key: this.maskKey(currentKey),
        requestCount: keyInfo.requestCount,
        isAvailable: keyInfo.isAvailable,
        timeUntilReset: Math.max(0, 60 - Math.floor((Date.now() - keyInfo.lastResetTime) / 1000))
      }));

      if (keyInfo.isAvailable && keyInfo.requestCount < this.RATE_LIMIT) {
        keyInfo.requestCount++;
        keyInfo.totalRequests++;

        // 记录key使用情况
        console.log(JSON.stringify({
          action: 'key_selected',
          key: this.maskKey(currentKey),
          newRequestCount: keyInfo.requestCount,
          totalRequests: keyInfo.totalRequests,
          timeUntilReset: Math.max(0, 60 - Math.floor((Date.now() - keyInfo.lastResetTime) / 1000))
        }));

        if (keyInfo.requestCount >= this.RATE_LIMIT) {
          keyInfo.isAvailable = false;
        }

        // 移动到下一个key
        this.currentIndex = (this.currentIndex + 1) % this.keyArray.length;

        // 打印最终状态
        console.log(JSON.stringify({
          action: 'after_key_selection',
          ...this.getKeyStatusSummary()
        }, null, 2));

        return currentKey;
      }

      // 移动到下一个key
      this.currentIndex = (this.currentIndex + 1) % this.keyArray.length;
      attempts++;
    }

    // 如果没有可用的key，输出状态并抛出错误
    const status = this.getKeyStatusSummary();
    console.log(JSON.stringify({
      error: '所有API密钥已达到速率限制',
      ...status
    }, null, 2));

    throw new Error('所有API密钥已达到速率限制，请稍后再试');
  }
}

// 创建单例实例
const keyManager = new KeyManager();

export default keyManager; 