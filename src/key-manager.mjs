import { Redis } from '@upstash/redis'

export class KeyManager {
  constructor(keys) {
    this.keys = keys;
    this.currentKeyIndex = 0;
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-encryption-key';
    this.algorithm = { name: 'AES-GCM', length: 256 };

    // 使用 Redis 作为唯一的计数存储
    this.redis = new Redis({
      url: 'https://cunning-gull-10062.upstash.io',
      token: 'ASdOAAIjcDE3Yzk1NjY1MmRlM2I0Y2FhYmI4ZDNkZjkyODQ0MGVkNXAxMA',
    });
  }

  // 加密函数
  async encrypt(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.encryptionKey),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      this.algorithm,
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedContent = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      data
    );

    const encryptedArray = new Uint8Array(encryptedContent);
    const result = new Uint8Array(salt.length + iv.length + encryptedArray.length);
    result.set(salt);
    result.set(iv, salt.length);
    result.set(encryptedArray, salt.length + iv.length);

    return btoa(String.fromCharCode(...result));
  }

  // 解密函数
  async decrypt(encryptedText) {
    const decoder = new TextDecoder();
    const encryptedData = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));

    const salt = encryptedData.slice(0, 16);
    const iv = encryptedData.slice(16, 28);
    const data = encryptedData.slice(28);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.encryptionKey),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      this.algorithm,
      false,
      ['decrypt']
    );

    const decryptedContent = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      data
    );

    return decoder.decode(decryptedContent);
  }

  // 验证密码并获取 API key
  async verifyAndGetKey(password) {
    if (password !== 'mycustomkey') {
      throw new Error('Invalid password');
    }

    try {
      // 从 Redis 获取加密的 API key
      const encryptedKey = await this.redis.get('encrypted_api_key');
      if (!encryptedKey) {
        throw new Error('No API key found');
      }

      // 解密 API key
      const decryptedKey = await this.decrypt(encryptedKey);
      this.initializeKeys(decryptedKey);
      return true;
    } catch (error) {
      console.error('Error verifying key:', error);
      return false;
    }
  }

  // 存储加密的 API key
  async storeEncryptedKey(apiKey) {
    try {
      const encryptedKey = await this.encrypt(apiKey);
      await this.redis.set('encrypted_api_key', encryptedKey);
      return true;
    } catch (error) {
      console.error('Error storing encrypted key:', error);
      return false;
    }
  }

  async getNextAvailableKey() {
    if (!this.keys || this.keys.length === 0) {
      console.error('No API keys available');
      return null;
    }

    const now = Date.now();
    let checkedKeysCount = 0;

    while (checkedKeysCount < this.keys.length) {
      const currentKey = this.keys[this.currentKeyIndex];
      const redisKey = `api-requests:${currentKey}`;

      try {
        // 记录当前使用的 key
        console.log(`[${new Date().toISOString()}] 尝试使用 key: ${currentKey.substring(0, 12)}...`);

        // 使用 Redis 的原子操作来处理计数
        // 1. 移除过期的请求
        // 2. 添加新请求
        // 3. 获取当前有效请求数
        // 使用 Lua 脚本确保操作的原子性
        const luaScript = `
          local key = KEYS[1]
          local now = tonumber(ARGV[1])
          local cutoff = now - 60000

          -- 清理过期数据
          redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)

          -- 获取当前请求数
          local count = redis.call('ZCARD', key)

          -- 如果请求数小于10，添加新请求
          if count < 10 then
            redis.call('ZADD', key, now, 'req:' .. now)
            return 1
          end

          return 0
        `;

        const result = await this.redis.eval(
          luaScript,
          [redisKey],
          [now.toString()]
        );

        if (result === 1) {
          console.log(`[${new Date().toISOString()}] 成功使用 key: ${currentKey.substring(0, 12)}...`);
          return currentKey;
        }

        // 尝试下一个key
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
        checkedKeysCount++;

      } catch (error) {
        console.error(`[${new Date().toISOString()}] Redis 操作错误: `, error);

        if (error.message?.includes('max daily request limit exceeded')) {
          console.error('[${new Date().toISOString()}] 已达到 Redis 每日请求限制');
          return null;
        }

        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
        checkedKeysCount++;
      }
    }

    console.log(`[${new Date().toISOString()}] 所有 API keys 都已达到速率限制`);
    return null;
  }

  initializeKeys(apiKeys) {
    if (!apiKeys) {
      console.log('No API keys provided');
      return;
    }
    this.keys = apiKeys.split(',').map(key => key.trim());
    console.log('Initialized keys:', this.keys);
  }

  async cleanup() {
    console.log('Cleanup completed');
  }
}

const keyManager = new KeyManager();
export default keyManager;
