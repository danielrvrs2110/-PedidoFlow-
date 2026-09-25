import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

import { cloudflare } from "@cloudflare/vite-plugin";
import { selectCloudflareRuntime } from './config/cloudflare-runtime.js'

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  plugins: [
    react(),
    tailwindcss(),
    cloudflare(selectCloudflareRuntime({ command, isPreview: Boolean(isPreview) })),
  ],
}))
