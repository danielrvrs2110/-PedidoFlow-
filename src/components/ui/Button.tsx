import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  loading?: boolean
  size?: ButtonSize
  variant?: ButtonVariant
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border-brand-600 bg-brand-600 text-white hover:border-brand-700 hover:bg-brand-700',
  secondary:
    'border-neutral-300 bg-neutral-0 text-neutral-900 hover:bg-neutral-100',
  ghost:
    'border-transparent bg-transparent text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900',
  danger:
    'border-danger-fg bg-danger-fg text-white hover:border-red-800 hover:bg-red-800',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm',
}

export function Button({
  children,
  className,
  disabled,
  loading = false,
  size = 'md',
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-control border font-medium transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? 'Procesando…' : children}
    </button>
  )
}
