import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

import { cloudflare } from "@cloudflare/vite-plugin";

const defaultLocalState = path.resolve('.wrangler/pf017-local')
const requestedLocalState = path.resolve(process.env.PEDIDOFLOW_LOCAL_PERSIST_PATH ?? defaultLocalState)
const smokeStateRoot = `${path.resolve('.wrangler/pf021-smoke-')}`

if (requestedLocalState !== defaultLocalState && !requestedLocalState.startsWith(smokeStateRoot)) {
  throw new Error('PEDIDOFLOW_LOCAL_PERSIST_PATH must be the managed development or isolated smoke path')
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    cloudflare(command === 'serve'
      ? {
          configPath: './config/local/wrangler.jsonc',
          persistState: { path: requestedLocalState },
          remoteBindings: false,
        }
      : { configPath: './wrangler.jsonc' }),
  ],
}))
