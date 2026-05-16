import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const isProd = mode === 'production';

    return {
      base: '/',
      build: {
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html')
          }
        }
      },
      envPrefix: 'VITE_',
      define: {
        'import.meta.env.VITE_PROXY_URL': env.VITE_PROXY_URL
          ? JSON.stringify(env.VITE_PROXY_URL)
          : isProd
            ? JSON.stringify('https://mistralapicaller.yusufsamodien12.workers.dev/v1/chat/completions')
            : 'undefined'
      },
      server: {
        port: 4000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:3001',
            changeOrigin: true,
          }
        }
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
