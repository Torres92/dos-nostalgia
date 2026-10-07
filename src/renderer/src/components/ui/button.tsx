import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'ghost' | 'outline' | 'yellow'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonProps): React.JSX.Element {
  return (
    <button
      className={cn(
        'dos-btn',
        (variant === 'ghost' || variant === 'secondary' || variant === 'outline') &&
          'dos-btn--ghost',
        variant === 'yellow' && 'dos-btn--yellow',
        size === 'sm' && 'px-2 py-0.5 text-[18px]',
        size === 'lg' && 'px-4 py-2',
        size === 'icon' && 'h-8 w-8 px-0',
        className
      )}
      {...props}
    />
  )
}
