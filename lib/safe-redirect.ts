/**
 * Validates that a redirect target is a relative path on this site.
 * Rejects absolute URLs, protocol-relative URLs ("//evil.com"), and the
 * backslash variant some browsers normalize to "//" ("/\evil.com"),
 * which is the standard bypass for a naive `startsWith('/')` check.
 */
export function isSafeRelativePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\')
}
