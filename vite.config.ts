import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  server: {
    proxy: {
      '/api/openchargemap': {
        target: 'https://api.openchargemap.io/v3',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openchargemap/, ''),
      },
    },
  },
  define: {
    'process.env': {},
  },
})
