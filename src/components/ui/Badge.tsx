import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
  showDot?: boolean
  tone?: BadgeTone
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'border-neutral-200 bg-neutral-100 text-neutral-700',
  info: 'border-info-border bg-info-bg text-info-fg',
  success: 'border-success-border bg-success-bg text-success-fg',
  warning: 'border-warning-border bg-warning-bg text-warning-fg',
  danger: 'border-danger-border bg-danger-bg text-danger-fg',
}

const dotClasses: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-500',
  info: 'bg-info-fg',
  success: 'bg-success-fg',
  warning: 'bg-warning-fg',
  danger: 'bg-danger-fg',
}

export function Badge({
  children,
  className,
  showDot = false,
  tone = 'neutral',
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center gap-1.5 rounded-badge border px-2 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {showDot ? (
        <span className={cn('size-1.5 rounded-full', dotClasses[tone])} aria-hidden="true" />
      ) : null}
      {children}
    </span>
  )
}
