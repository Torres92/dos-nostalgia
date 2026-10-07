import type { InputHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/utils'

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input({ className, type, ...props }: InputProps): React.JSX.Element {
  return <input type={type} className={cn('dos-field', className)} {...props} />
}
