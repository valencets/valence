export function camelCase (slug: string): string {
  const parts = slug.split(/[-_]/)
  return parts[0] + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('')
}

export function pascalCase (slug: string): string {
  return slug
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

export function singularize (slug: string): string {
  if (slug.endsWith('ies')) return slug.slice(0, -3) + 'y'
  if (slug.endsWith('ses')) return slug.slice(0, -2)
  if (slug.endsWith('s')) return slug.slice(0, -1)
  return slug
}
