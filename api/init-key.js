let KeyManager;
let keyManager;

export default async function handler(req, res) {
  console.log('收到初始化请求');

  if (req.method !== 'POST') {
    console.log('方法不允许:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!KeyManager) {
      const module = await import('../src/key-manager.mjs');
      KeyManager = module.KeyManager;
      keyManager = new KeyManager();
    }

    const { password, apiKey } = req.body;
    console.log('请求参数:', { password: password ? '已提供' : '未提供', apiKey: apiKey ? '已提供' : '未提供' });

    if (!password || !apiKey) {
      console.log('缺少必要参数');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (password !== 'mycustomkey') {
      console.log('密码错误');
      return res.status(401).json({ error: 'Invalid password' });
    }

    console.log('开始存储 API key');
    const success = await keyManager.storeEncryptedKey(apiKey);

    if (success) {
      console.log('API key 存储成功');
      return res.status(200).json({ message: 'API key stored successfully' });
    } else {
      console.log('API key 存储失败');
      return res.status(500).json({ error: 'Failed to store API key' });
    }
  } catch (error) {
    console.error('处理请求时发生错误:', error);
    console.error('错误堆栈:', error.stack);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
