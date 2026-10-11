import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Sandbox-only: the preview proxy reaches the dev server via a rotating
    // *.${BASE44_SANDBOX_HOST_DOMAIN} host. Allowlist that wildcard when the
    // platform preview flag is on; unset/other values keep default behavior.
    ...(process.env.BASE44_PREVIEW_MODE === '1' && process.env.BASE44_SANDBOX_HOST_DOMAIN
      ? { allowedHosts: [`.${process.env.BASE44_SANDBOX_HOST_DOMAIN}`] }
      : {}),
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:4000',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_API_URL || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
