import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { selectCloudflareRuntime } from './cloudflare-runtime.js'

describe('Cloudflare Vite runtime selection', () => {
  it('uses the local-only config only for the development server', () => {
    expect(selectCloudflareRuntime({ command: 'serve', isPreview: false })).toEqual({
      configPath: path.resolve('config/local/wrangler.jsonc'),
      persistState: { path: path.resolve('.wrangler/pf017-local') },
      remoteBindings: false,
    })
  })

  it.each([
    { command: 'build' as const, isPreview: false },
    { command: 'serve' as const, isPreview: true },
  ])('uses the principal config for $command preview=$isPreview', input => {
    expect(selectCloudflareRuntime({
      ...input,
      environment: {
        PEDIDOFLOW_LOCAL_CONFIG_PATH: '/tmp/should-not-be-used.jsonc',
        PEDIDOFLOW_LOCAL_PERSIST_PATH: '/tmp/should-not-be-used',
      },
    })).toEqual({ configPath: './wrangler.jsonc' })
  })

  it('accepts only a matched isolated smoke config and persistence pair', () => {
    const root = path.resolve('.wrangler/pf021-smoke-test')
    expect(selectCloudflareRuntime({
      command: 'serve',
      isPreview: false,
      environment: {
        PEDIDOFLOW_LOCAL_CONFIG_PATH: path.join(root, 'config/wrangler.smoke.jsonc'),
        PEDIDOFLOW_LOCAL_PERSIST_PATH: path.join(root, 'persist'),
      },
    })).toMatchObject({ remoteBindings: false })
    expect(() => selectCloudflareRuntime({
      command: 'serve',
      isPreview: false,
      environment: { PEDIDOFLOW_LOCAL_CONFIG_PATH: '/tmp/foreign.jsonc' },
    })).toThrow('managed development or isolated smoke config')
  })
})
