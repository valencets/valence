export function parseCookie (cookieHeader: string, name: string): string | null {
  const match = cookieHeader.split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(`${name}=`))
  if (!match) return null
  return match.slice(name.length + 1)
}
