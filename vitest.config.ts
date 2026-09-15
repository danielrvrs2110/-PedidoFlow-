import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Tests run in Node; the database suite manages its own ephemeral D1 runtime.
// Keep the Cloudflare application plugin out of Vitest's environment setup.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    fileParallelism: false,
  },
})
