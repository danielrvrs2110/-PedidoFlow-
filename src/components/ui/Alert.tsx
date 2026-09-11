import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type AlertTone = 'info' | 'success' | 'warning' | 'danger'

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  title: string
  tone?: AlertTone
}

const toneClasses: Record<AlertTone, string> = {
  info: 'border-info-border bg-info-bg text-info-fg',
  success: 'border-success-border bg-success-bg text-success-fg',
  warning: 'border-warning-border bg-warning-bg text-warning-fg',
  danger: 'border-danger-border bg-danger-bg text-danger-fg',
}

export function Alert({
  children,
  className,
  title,
  tone = 'info',
  ...props
}: AlertProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-panel border p-4 text-sm', toneClasses[tone], className)}
      {...props}
    >
      <p className="font-semibold">{title}</p>
      <div className="mt-1 leading-5">{children}</div>
    </div>
  )
}
