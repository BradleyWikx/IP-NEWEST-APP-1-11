import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Fix voor __dirname in ESM modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, path.resolve('.'), '');
    return {
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.API_KEY),
      },
      resolve: {
        alias: {
          // Map @ to current directory (root)
          '@': path.resolve(__dirname, './'),
        }
      }
    };
});