import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          name: 'copy-worker',
          writeBundle() {
            const fs = require('fs');
            const path = require('path');
            fs.copyFileSync(
              path.resolve(__dirname, '_worker.js'),
              path.resolve(__dirname, 'dist/_worker.js')
            );
          }
        }
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      build: {
        outDir: 'dist',
        assetsDir: 'assets'
      }
    };
});
