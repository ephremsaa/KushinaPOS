import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Detect if this is a native app build
  const isTauri = !!process.env.TAURI_ENV_PLATFORM || !!env.TAURI_ENV_PLATFORM || process.env.npm_lifecycle_event === 'tauri:build';
  const isCapacitor = process.env.npm_lifecycle_event === 'build:cap';
  const isNativeBuild = isTauri || isCapacitor;

  if (command === 'build') {
    const leakedServiceKey = Object.keys(env).find(k => k.startsWith('VITE_') && k.includes('SERVICE'));
    if (leakedServiceKey) {
      console.error(`\n❌ FATAL: Potential secret leak! Found variable: ${leakedServiceKey}`);
      console.error('Never embed service role keys or backend secrets in the frontend build.\n');
      process.exit(1);
    }
  }

  if (command === 'build' && isNativeBuild) {
    if (!env.VITE_API_URL) {
      console.error('\n❌ FATAL: VITE_API_URL is missing!');
      console.error('Native builds (Android/Desktop) require a fully qualified VITE_API_URL');
      console.error('Otherwise the app will try to call localhost/api or file:///api which will fail.\n');
      process.exit(1);
    }
  }

  return {
    plugins: [react()],
    server: {
      host: true,
      proxy: {
        // Proxy all /api/* and /uploads/* requests to Express backend
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
