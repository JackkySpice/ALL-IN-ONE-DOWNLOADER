import { BRAND_GRADIENT, tokens } from './tokens'

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase()
}

function visit(entry: unknown, path: string[], set: (key: string, value: string) => void) {
  if (entry == null) return
  if (typeof entry === 'string' || typeof entry === 'number') {
    const cssVar = ['--aoi', ...path.map(toKebabCase)].join('-')
    set(cssVar, String(entry))
    return
  }
  if (typeof entry === 'boolean') {
    const cssVar = ['--aoi', ...path.map(toKebabCase)].join('-')
    set(cssVar, entry ? '1' : '0')
    return
  }
  if (typeof entry === 'object') {
    for (const [key, value] of Object.entries(entry)) {
      visit(value, [...path, key], set)
    }
  }
}

export function applyDesignTokens(target: HTMLElement = document.documentElement) {
  const setters: Array<[string, string]> = []
  visit(tokens, [], (key, value) => setters.push([key, value]))

  for (const [key, value] of setters) {
    target.style.setProperty(key, value)
  }

  target.style.setProperty('--aoi-brand-gradient', BRAND_GRADIENT)
  target.style.setProperty('--aoi-focus-ring', tokens.effects.focusRing)
  target.style.setProperty('--aoi-shadow-glow', tokens.effects.glow)
}
