import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // The API server reads the same .env; follow it if HTTPS is turned on there.
  const env = loadEnv(mode, process.cwd(), '');
  const api = (env.HTTPS_CERT && env.HTTPS_KEY ? 'https' : 'http') + '://127.0.0.1:' + (env.PORT || 3000);
  return {
    plugins: [react()],
    // secure: false because a local certificate is made for the Mac's name, not 127.0.0.1.
    server: { port: 5173, proxy: { '/api': { target: api, secure: false } } },
    test: { include: ['tests/**/*.test.{js,ts}'] }
  };
});
