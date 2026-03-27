/**
 * Normalize an IPv4 address by stripping leading zeros from each octet.
 * e.g. "192.168.001.001" → "192.168.1.1"
 *
 * Always validate with isValidIpv4() before calling this function.
 * Returns the input unchanged if it cannot be parsed as a 4-octet IPv4.
 */
export function normalizeIpv4(ip: string): string {
  const parts = ip.split('.')
  if (parts.length !== 4) return ip
  const octets = parts.map(p => parseInt(p, 10))
  if (octets.some(n => isNaN(n))) return ip
  return octets.join('.')
}

/**
 * Returns true if the string is a valid IPv4 address.
 * Does not accept CIDR notation (e.g. "192.168.1.0/24").
 *
 * Call isValidIpv4() first, then normalizeIpv4() to get the canonical form.
 */
export function isValidIpv4(ip: string): boolean {
  if (ip.includes('/')) return false
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  return parts.every(p => {
    if (!/^\d{1,3}$/.test(p)) return false
    const n = parseInt(p, 10)
    return n >= 0 && n <= 255
  })
}
