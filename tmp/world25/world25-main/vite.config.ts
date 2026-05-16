import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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
      define: {},
      plugins: [react(), tailwindcss()],
      resolve: {
        dedupe: ['three', 'react', 'react-dom'],
        alias: {
          '@': path.resolve(__dirname, '.'),
          'react': path.resolve(__dirname, 'node_modules/react'),
          'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
          'three': path.resolve(__dirname, 'node_modules/three'),
        }
      },
      ssr: {
        noExternal: []
      }
    };
});
