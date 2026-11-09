export function getEditorWebsites(websites: unknown): string[] {
  if (!Array.isArray(websites)) return []
  return websites.filter((website): website is string => typeof website === 'string')
}

export function getEditorWebsiteText(websites: unknown): string {
  return getEditorWebsites(websites).join(', ')
}
