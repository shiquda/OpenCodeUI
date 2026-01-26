export function getInitials(name: string): string {
  const clean = name.replace(/[-_]/g, ' ')
  const parts = clean.split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
