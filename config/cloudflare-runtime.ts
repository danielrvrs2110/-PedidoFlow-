import path from 'node:path'

type RuntimeSelectionInput = {
  command: 'build' | 'serve'
  isPreview: boolean
  environment?: NodeJS.ProcessEnv
}

export function selectCloudflareRuntime({
  command,
  isPreview,
  environment = process.env,
}: RuntimeSelectionInput) {
  if (command !== 'serve' || isPreview) return { configPath: './wrangler.jsonc' }

  const defaultConfig = path.resolve('config/local/wrangler.jsonc')
  const defaultState = path.resolve('.wrangler/pf017-local')
  const smokeRootPrefix = path.resolve('.wrangler/pf021-smoke-')
  const configPath = path.resolve(environment.PEDIDOFLOW_LOCAL_CONFIG_PATH ?? defaultConfig)
  const persistPath = path.resolve(environment.PEDIDOFLOW_LOCAL_PERSIST_PATH ?? defaultState)
  const isSmokeConfig = configPath.startsWith(smokeRootPrefix) && configPath.endsWith('/config/wrangler.smoke.jsonc')
  const isSmokeState = persistPath.startsWith(smokeRootPrefix) && persistPath.endsWith('/persist')

  if (configPath !== defaultConfig && !isSmokeConfig) {
    throw new Error('PEDIDOFLOW_LOCAL_CONFIG_PATH must be the managed development or isolated smoke config')
  }
  if (persistPath !== defaultState && !isSmokeState) {
    throw new Error('PEDIDOFLOW_LOCAL_PERSIST_PATH must be the managed development or isolated smoke path')
  }
  if ((configPath === defaultConfig) !== (persistPath === defaultState)) {
    throw new Error('Local config and persistence must both select development or the same isolated smoke runtime')
  }
  if (isSmokeConfig && path.dirname(path.dirname(configPath)) !== path.dirname(persistPath)) {
    throw new Error('Smoke config and persistence must share one isolated runtime root')
  }

  return {
    configPath,
    persistState: { path: persistPath },
    remoteBindings: false,
  }
}
