/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const allowedHosts = env.VITE_ALLOWED_HOSTS
    ?.split(',')
    .map(host => host.trim())
    .filter(Boolean)
  const defaultLocalHosts = ['localhost', '127.0.0.1', '[::1]']
  const combinedHosts = allowedHosts && allowedHosts.length > 0
    ? Array.from(new Set([...defaultLocalHosts, ...allowedHosts]))
    : undefined

  return {
    plugins: [react()],
    server: {
      ...(combinedHosts ? { allowedHosts: combinedHosts } : {}),
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
  }
})
