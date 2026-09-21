import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { ProxyOptions } from 'vite'

// OpenAI calls are proxied through the dev server so the API key stays
// server-side; the browser bundle never sees it.
const openaiProxy: Record<string, ProxyOptions> = {
  '/openai': {
    target: 'https://api.openai.com',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/openai/, ''),
    headers: process.env.OPENAI_API_KEY
      ? { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
      : {},
  },
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: openaiProxy,
  },
})
