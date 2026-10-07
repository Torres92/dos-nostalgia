import { resolve, sep } from 'path'

/** True if `childPath` is `parentPath` or a file/folder inside it. */
export function isPathInside(parentPath: string, childPath: string): boolean {
  const resolvedParent = resolve(parentPath) + sep
  const resolvedChild = resolve(childPath)
  return resolvedChild === resolve(parentPath) || resolvedChild.startsWith(resolvedParent)
}
