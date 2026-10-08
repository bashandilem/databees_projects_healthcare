import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
 plugins: [react()],
 build: { rollupOptions: { output: { manualChunks(id) {
  if (id.includes('node_modules')) {
   if (/recharts|d3-|victory|decimal|es-toolkit|eventemitter|immer|redux|reselect/.test(id)) return 'telemetry';
   return 'vendor';
  }
 } } } },
});
