import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: { alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) } }
});
