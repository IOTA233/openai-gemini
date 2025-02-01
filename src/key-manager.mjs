class KeyManager {
  constructor() {
    this.keys = new Map(); // 存储key信息
    this.RATE_LIMIT = 10;  // 默认每分钟10次请求
    this.currentIndex = 0; // 添加一个索引来追踪当前使用的key
    this.keyArray = [];    // 保存key的数组，用于轮换
    this.initialized = false; // 添加初始化标志
    this.mutex = Promise.resolve(); // 添加互斥锁
  }

  // 初始化keys
  initializeKeys(keys) {
    // 如果已经初始化过，且keys没有变化，则不重新初始化
    const newKeyArray = keys.includes(',') ? keys.split(',').map(k => k.trim()) : [keys];
    const currentKeys = this.keyArray.join(',');
    const newKeys = newKeyArray.join(',');

    if (this.initialized && currentKeys === newKeys) {
      return;
    }

    this.keyArray = newKeyArray;
    this.keys.clear();
    this.currentIndex = 0;
    this.initialized = true;

    // 添加新的keys
    this.keyArray.forEach(key => this.addKey(key.trim()));
  }

  // 添加新的API key
  addKey(key) {
    this.keys.set(key, {
      key,
      requestCount: 0,  // 当前分钟的请求数
      lastResetTime: Date.now(),  // 上次重置计数的时间
      isAvailable: true,  // 当前key是否可用
      totalRequests: 0,    // 总请求次数
      lastMinute: Math.floor(Date.now() / 60000) // 添加lastMinute属性
    });
  }

  // 重置指定key的请求计数
  resetKeyCount(keyInfo) {
    const currentMinute = Math.floor(Date.now() / 60000);
    if (keyInfo.lastMinute !== currentMinute) {
      keyInfo.requestCount = 0;
      keyInfo.lastMinute = currentMinute;
      keyInfo.isAvailable = true;
    }
  }

  // 获取下一个可用的key
  async getNextAvailableKey() {
    // 使用互斥锁确保同一时间只有一个请求能获取 key
    const release = await this.acquireMutex();
    try {
      // 检查所有key的状态
      for (let keyInfo of this.keys.values()) {
        this.resetKeyCount(keyInfo);
      }

      let attempts = 0;
      while (attempts < this.keyArray.length) {
        const currentKey = this.keyArray[this.currentIndex];
        const keyInfo = this.keys.get(currentKey);

        if (keyInfo.isAvailable && keyInfo.requestCount < this.RATE_LIMIT) {
          keyInfo.requestCount++;
          keyInfo.totalRequests++;

          if (keyInfo.requestCount >= this.RATE_LIMIT) {
            keyInfo.isAvailable = false;
          }

          this.currentIndex = (this.currentIndex + 1) % this.keyArray.length;
          return currentKey;
        }

        this.currentIndex = (this.currentIndex + 1) % this.keyArray.length;
        attempts++;
      }

      throw new Error('所有API密钥已达到速率限制，请稍后再试');
    } finally {
      release(); // 释放锁
    }
  }

  // 获取互斥锁
  async acquireMutex() {
    let release;
    const newMutex = new Promise(resolve => {
      release = resolve;
    });

    const oldMutex = this.mutex;
    this.mutex = newMutex;

    await oldMutex;
    return release;
  }

  // 隐藏key的中间部分
  maskKey(key) {
    if (key.length <= 8) return key;
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }
}

// 创建单例实例
const keyManager = new KeyManager();

export default keyManager; 