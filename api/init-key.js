import { KeyManager } from '../src/key-manager.mjs';

const keyManager = new KeyManager();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password, apiKey } = req.body;

  if (!password || !apiKey) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (password !== 'mycustomkey') {
    return res.status(401).json({ error: 'Invalid password' });
  }

  try {
    const success = await keyManager.storeEncryptedKey(apiKey);
    if (success) {
      return res.status(200).json({ message: 'API key stored successfully' });
    } else {
      return res.status(500).json({ error: 'Failed to store API key' });
    }
  } catch (error) {
    console.error('Error storing API key:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
