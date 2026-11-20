/** host matches hostname and port; path matches the complete normalized path. */
export type WebsiteMatchMode = 'host' | 'path'

export interface ParsedMatchUrl {
  hostname: string
  port: number
  explicitPort: boolean
  protocol: 'http:' | 'https:' | 'unknown'
}

const DEFAULT_PORTS: Record<string, number> = { 'http:': 80, 'https:': 443 }

function isIpv4(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
}

export function parseUrlForMatch(raw: string): ParsedMatchUrl | null {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) return null
  if (trimmed.startsWith('*.')) return { hostname: trimmed, port: 443, explicitPort: false, protocol: 'https:' }

  const hostPortOnly = /^([^/:#]+):(\d+)$/.exec(trimmed)
  if (hostPortOnly && !/^https?:\/\//i.test(trimmed)) {
    return { hostname: hostPortOnly[1], port: Number(hostPortOnly[2]), explicitPort: true, protocol: 'http:' }
  }

  let urlString = trimmed
  if (!/^https?:\/\//i.test(trimmed)) {
    const hostPart = trimmed.split('/')[0]
    const scheme = isIpv4(hostPart.split(':')[0]) ? 'http' : 'https'
    urlString = `${scheme}://${trimmed}`
  }

  try {
    const url = new URL(urlString)
    const explicitPort = url.port !== ''
    return {
      hostname: url.hostname.toLowerCase(),
      port: explicitPort ? Number(url.port) : (DEFAULT_PORTS[url.protocol] ?? 80),
      explicitPort,
      protocol: url.protocol as 'http:' | 'https:'
    }
  } catch {
    const hostOnly = trimmed.replace(/^https?:\/\//, '').split('/')[0]
    const [host, portPart] = hostOnly.split(':')
    if (!host) return null
    if (portPart && /^\d+$/.test(portPart)) {
      return { hostname: host, port: Number(portPart), explicitPort: true, protocol: 'http:' }
    }
    return { hostname: host, port: 0, explicitPort: false, protocol: 'unknown' }
  }
}

function hostnamesMatch(entryHost: string, pageHost: string): boolean {
  if (entryHost.startsWith('*.')) {
    const base = entryHost.slice(2)
    return pageHost === base || pageHost.endsWith(`.${base}`)
  }
  return pageHost === entryHost || pageHost.endsWith(`.${entryHost}`)
}

function portsMatch(entry: ParsedMatchUrl, page: ParsedMatchUrl): boolean {
  if (entry.explicitPort) return entry.port === page.port
  const defaultPort = DEFAULT_PORTS[page.protocol] ?? 80
  return page.port === defaultPort
}

function normalizePathname(pathname: string): string {
  const path = pathname || '/'
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}

export function getPageWebsiteUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('*.')) return trimmed.toLowerCase()

  let urlString = trimmed
  if (!/^https?:\/\//i.test(trimmed)) {
    const hostPart = trimmed.split('/')[0]
    const scheme = isIpv4(hostPart.split(':')[0]) ? 'http' : 'https'
    urlString = `${scheme}://${trimmed}`
  }

  try {
    const url = new URL(urlString)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    const pathname = normalizePathname(url.pathname)
    return `${url.origin}${pathname === '/' ? '' : pathname}`.toLowerCase()
  } catch {
    return ''
  }
}

export function websiteMatchesPageByHost(website: string, pageUrl: string): boolean {
  const page = parseUrlForMatch(pageUrl)
  const entry = parseUrlForMatch(website)
  return !!page && !!entry && hostnamesMatch(entry.hostname, page.hostname) && portsMatch(entry, page)
}

export function websiteMatchesPageByPath(website: string, pageUrl: string): boolean {
  const pageCanonical = getPageWebsiteUrl(pageUrl)
  if (!pageCanonical) return false
  const trimmedEntry = website.trim()
  if (trimmedEntry.startsWith('*.')) return websiteMatchesPageByHost(trimmedEntry, pageUrl)
  const entryCanonical = getPageWebsiteUrl(trimmedEntry)
  return !!entryCanonical && entryCanonical === pageCanonical
}

export function websiteMatchesPage(website: string, pageUrl: string, mode: WebsiteMatchMode = 'host'): boolean {
  return mode === 'path' ? websiteMatchesPageByPath(website, pageUrl) : websiteMatchesPageByHost(website, pageUrl)
}

export function entryMatchesPage(websites: string[], pageUrl: string, mode: WebsiteMatchMode = 'host'): boolean {
  return websites.some((site) => websiteMatchesPage(site, pageUrl, mode))
}

export function getUrlSearchKeyword(pageUrl: string, mode: WebsiteMatchMode = 'host'): string {
  return mode === 'path' ? getPageWebsiteUrl(pageUrl) : getPageHostLabel(pageUrl)
}

export function getPageHostLabel(pageUrl: string): string {
  const parsed = parseUrlForMatch(pageUrl)
  if (!parsed) return ''
  const defaultPort = DEFAULT_PORTS[parsed.protocol] ?? 80
  return parsed.explicitPort || parsed.port !== defaultPort ? `${parsed.hostname}:${parsed.port}` : parsed.hostname
}

/** @deprecated Use getPageHostLabel. */
export function getPageHostname(pageUrl: string): string {
  return getPageHostLabel(pageUrl)
}
