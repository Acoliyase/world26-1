import express from 'express';
import cors from 'cors';
import { Mistral } from '@mistralai/mistralai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEMORY_FILE = path.join(__dirname, 'memory.json');

async function startServer() {
  const app = express();
  const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Memory GET endpoint
app.get('/api/state', (req, res) => {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const data = fs.readFileSync(MEMORY_FILE, 'utf8');
      return res.json({ state: JSON.parse(data) });
    }
    res.json({ state: null });
  } catch (err) {
    res.status(500).json({ error: 'Disk read fault' });
  }
});

// Memory POST endpoint
app.post('/api/state', (req, res) => {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(req.body.state, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Disk write fault' });
  }
});

  const mistralApiKey = process.env.MISTRAL_API_KEY;

  if (!mistralApiKey) {
    console.warn('⚠️ MISTRAL_API_KEY not set in environment. Clients may need to provide their own.');
  }

  app.post('/api/mistral/chat', async (req, res) => {
    console.log('[Mistral Proxy] Received request from client');
    // Priority: Header > Body > Environment
    const userApiKey = req.headers['x-mistral-api-key'] || req.body.apiKey || mistralApiKey;

    if (!userApiKey) {
      return res.status(401).json({ error: 'API key not configured. Provide it in settings or set MISTRAL_API_KEY environment variable.' });
    }
    
    try {
      const { systemInstruction, prompt, model = 'mistral-large-latest' } = req.body;
      console.log(`[Mistral Proxy] API Request: model=${model}, promptLen=${prompt?.length}`);
      
      const client = new Mistral({ apiKey: userApiKey });

      const messages = [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt }
      ];

      const chatResponse = await client.chat.complete({
        model: model,
        messages: messages,
        temperature: 0.7,
        maxTokens: 2000
      });

    const responseText = chatResponse.choices?.[0]?.message?.content || '{}';
    console.log(`[Mistral Proxy] API Response received, length: ${responseText.length}`);
    
    // Log the first 200 chars and last 200 chars for debugging
    if (responseText.length > 400) {
        console.log(`[Mistral Proxy] Snippet: ${responseText.substring(0, 200)}...${responseText.substring(responseText.length - 200)}`);
    } else {
        console.log(`[Mistral Proxy] Response: ${responseText}`);
    }

    res.json({ 
      text: responseText,
      success: true 
    });
  } catch (error) {
    console.error('Mistral API Error:', error);
    res.status(500).json({ 
      error: 'Failed to communicate with Mistral API',
      details: error.message 
    });
  }
});

// 3DAI Studio Wallet Proxy
app.get('/api/3daistudio/wallet', async (req, res) => {
  const apiKey = process.env.STUDIO_3DAI_API_KEY || '2DGRPYswzp0AbNhoUgdk2ywFR8tQPKGzDU0l';
  
  try {
    const response = await fetch('https://api.3daistudio.com/account/user/wallet/', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`3DAI Studio API responded with status: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[3DAI Studio Proxy] Error:', error);
    res.status(500).json({ error: 'Failed to fetch wallet data', message: error.message });
  }
});

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'mistral-proxy' });
  });

  // Force development mode if not production
  const isProd = process.env.NODE_ENV === 'production';
  console.log(`Mode: ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}`);

  if (!isProd) {
    console.log('Starting Vite in middleware mode...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    console.log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Unified Back-end running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
