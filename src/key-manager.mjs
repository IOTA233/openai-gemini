import { Redis } from '@upstash/redis'

// 常量定义
const PRESET_KEY = 'IOTA-CUSTOM-KEY';

export class KeyManager {
  constructor(keys) {
    this.keys = keys;
    this.currentKeyIndex = 0;
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-encryption-key';
    this.algorithm = { name: 'AES-GCM', length: 256 };

    // 使用 Redis 作为唯一的计数存储
    this.redis = new Redis({
      url: 'https://dominant-porpoise-20738.upstash.io',
      token: 'AVECAAIncDExNWRmNGI0ODllZDU0ZmE5ODZkZDcyMTU1YTQ2NWRlYXAxMjA3Mzg',
    })
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
    console.log('开始解密过程');
    console.log('加密文本长度:', encryptedText.length);
    console.log('加密文本前 20 个字符:', encryptedText.substring(0, 20));

    try {
      const decoder = new TextDecoder();
      console.log('尝试 base64 解码');
      const encryptedData = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
      console.log('base64 解码成功，数据长度:', encryptedData.length);

      const salt = encryptedData.slice(0, 16);
      const iv = encryptedData.slice(16, 28);
      const data = encryptedData.slice(28);
      console.log('数据分割完成 - salt:', salt.length, 'iv:', iv.length, 'data:', data.length);

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(this.encryptionKey),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );
      console.log('密钥材料导入成功');

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
      console.log('密钥派生成功');

      const decryptedContent = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv
        },
        key,
        data
      );
      console.log('解密成功');

      return decoder.decode(decryptedContent);
    } catch (error) {
      console.error('解密过程中出错:', error);
      console.error('错误堆栈:', error.stack);
      throw error;
    }
  }

  // 存储加密的 API key
  async storeEncryptedKey(apiKey) {
    try {
      console.log('开始加密 API key');
      // 将 API key 按逗号分割成数组
      const apiKeys = apiKey.split(',').map(key => key.trim());
      console.log(`共 ${apiKeys.length} 个 API key 需要加密`);

      // 分别加密每个 key
      const encryptedKeys = await Promise.all(
        apiKeys.map(async (key, index) => {
          console.log(`正在加密第 ${index + 1} 个 key`);
          const encrypted = await this.encrypt(key);
          return encrypted;
        })
      );

      console.log('所有 key 加密完成，开始存储到 Redis');
      // 将加密后的 key 数组存储到 Redis
      await this.redis.set('encrypted_api_keys', JSON.stringify(encryptedKeys));
      console.log('API key 存储成功');
      return true;
    } catch (error) {
      console.error('存储加密 key 时发生错误:', error);
      console.error('错误堆栈:', error.stack);
      return false;
    }
  }

  // 验证密码并获取 API key
  async verifyAndGetKey(password) {
    console.log('开始验证密码:', password);
    // 如果不是预设 key，直接返回输入的 key
    if (password !== PRESET_KEY) {
      console.log('使用非预设 key，直接返回');
      return password;
    }

    try {
      console.log('开始获取加密的 API key');
      let encryptedKeys = await this.redis.get('encrypted_api_keys');
      console.log('从 Redis 获取到的原始数据:', encryptedKeys);

      if (!encryptedKeys) {
        console.log('Redis 中没有找到加密的 API key');
        throw new Error('No API key found');
      }

      if (!Array.isArray(encryptedKeys)) {
        encryptedKeys = [encryptedKeys];
      }

      console.log(`找到 ${encryptedKeys.length} 个加密的 API key`);

      // 解密所有 key
      const decryptedKeys = await Promise.all(
        encryptedKeys.map(async (encryptedKey, index) => {
          console.log(`正在解密第 ${index + 1} 个 key`);
          if (typeof encryptedKey !== 'string') {
            console.error(`第 ${index + 1} 个 key 不是字符串类型`);
            return null;
          }
          console.log('加密 key 长度:', encryptedKey.length);
          console.log('加密 key 前 20 个字符:', encryptedKey.substring(0, 20));
          try {
            const decrypted = await this.decrypt(encryptedKey);
            console.log(`第 ${index + 1} 个 key 解密成功`);
            return decrypted;
          } catch (error) {
            console.error(`解密第 ${index + 1} 个 key 时出错:`, error);
            console.error('错误堆栈:', error.stack);
            return null;
          }
        })
      );

      // 过滤掉解密失败的 key
      const validKeys = decryptedKeys.filter(key => key !== null);
      console.log('解密成功的 key 数量:', validKeys.length);

      if (validKeys.length === 0) {
        console.log('没有找到有效的 API key');
        throw new Error('No valid API keys found after decryption');
      }

      console.log('所有 key 解密完成');
      // 返回解密后的 key
      return validKeys.join(',');
    } catch (error) {
      console.error('验证 key 时发生错误:', error);
      console.error('错误堆栈:', error.stack);
      return null;
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
