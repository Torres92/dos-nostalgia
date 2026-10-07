import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function coverSrc(coverPath: string | null, coverUrl: string | null): string | null {
  if (coverPath) {
    return `localmedia://cover/?path=${encodeURIComponent(coverPath)}`
  }
  return coverUrl
}
