import rawTokens from './tokens.json'

export const tokens = rawTokens as const

export type DesignTokens = typeof tokens

export const BRAND_GRADIENT = `linear-gradient(110deg, ${tokens.brand.start}, ${tokens.brand.mid}, ${tokens.brand.end})`

export const BRAND_GRADIENT_CLASS = 'bg-[linear-gradient(110deg,_var(--aoi-brand-start),_var(--aoi-brand-mid),_var(--aoi-brand-end))]'

export const SURFACE_TONES = {
  muted: 'bg-[color:var(--aoi-colors-surface-muted)]',
  raised: 'bg-[color:var(--aoi-colors-surface-default)]',
  solid: 'bg-[color:var(--aoi-colors-surface-strong)]',
} as const

type SurfaceTone = keyof typeof SURFACE_TONES

export type { SurfaceTone }
