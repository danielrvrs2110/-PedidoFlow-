export interface BootstrapInput {
  email: string
  organizationName: string
  slug: string
  password: string
}

export function normalizeBootstrapInput(input: BootstrapInput): BootstrapInput
export function runLocalOwnerBootstrap(): Promise<{
  outcome: 'created' | 'no_op'
  email: string
  organizationName: string
  slug: string
  organizationId: string
  userId: string
}>
