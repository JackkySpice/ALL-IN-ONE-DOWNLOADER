import React, { useMemo, useState } from 'react'
import { Download, Music2, PlayCircle, Youtube, Instagram, Facebook, Music, BadgeCheck, Link as LinkIcon, Loader2, Crown, ShieldCheck, Video, Waves, Sparkles, RefreshCw, Info, CheckCircle2, Copy, ExternalLink, History as HistoryIcon, Filter as FilterIcon, Languages, Cookie } from 'lucide-react'
import clsx from 'clsx'
import * as Popover from '@radix-ui/react-popover'
import * as Tabs from '@radix-ui/react-tabs'
import { FadeInUp, FadeInUpH1 } from './components/Animated'
import AuthModal from './components/AuthModal'
import { Button } from './components/ui/Button'
import { Surface } from './components/ui/Surface'
import { ChipToggle } from './components/ui/ChipToggle'

const PLATFORMS = [
  { key: 'youtube', label: 'YouTube', color: 'text-red-500', icon: Youtube },
  { key: 'facebook', label: 'Facebook', color: 'text-blue-500', icon: Facebook },
  { key: 'tiktok', label: 'TikTok', color: 'text-pink-400', icon: PlayCircle },
  { key: 'instagram', label: 'Instagram', color: 'text-fuchsia-400', icon: Instagram },
  { key: 'soundcloud', label: 'SoundCloud', color: 'text-orange-400', icon: Music },
]

export type Format = {
  format_id: string
  ext?: string
  resolution?: string
  fps?: number
  acodec?: string
  vcodec?: string
  filesize?: number
  filesize_pretty?: string | null
  audio_bitrate?: number
  direct_url?: string
  is_audio_only: boolean
  protocol?: string
}

type ExtractResponse = {
  id?: string
  title?: string
  thumbnail?: string
  duration?: number
  webpage_url?: string
  extractor?: string
  formats: Format[]
  subtitles?: { lang: string, ext?: string | null, url?: string | null, auto?: boolean }[]
}

async function extract(url: string, signal?: AbortSignal): Promise<ExtractResponse> {
  const res = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    signal,
  })
  if (!res.ok) {
    let message = 'Extraction failed'
    try {
      const data = await res.json()
      message = (data?.detail || data?.message || message)
    } catch {
      try {
        const text = await res.text()
        message = text || message
      } catch {}
    }
    throw new Error(message)
  }
  return res.json()
}

export function formatDuration(seconds?: number) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [h, m, s]
    .map((v, i) => (i === 0 ? String(v) : String(v).padStart(2, '0')))
    .filter((v, i) => i === 0 ? v !== '0' : true)
    .join(':')
}

export function normalizeInputUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  try {
    const u = new URL(t)
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString()
    return null
  } catch {
    try {
      const u2 = new URL(`https://${t}`)
      if (u2.protocol === 'http:' || u2.protocol === 'https:') return u2.toString()
    } catch {}
  }
  return null
}

export default function App() {
  const [active, setActive] = useState(PLATFORMS[0].key)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ExtractResponse | null>(null)
  const [lastSource, setLastSource] = useState<string | null>(null)
  const [aborter, setAborter] = useState<AbortController | null>(null)
  const [user, setUser] = useState<{ id: string, email?: string | null, guest: boolean } | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [cookiesOn, setCookiesOn] = useState<boolean | null>(null)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [historyItems, setHistoryItems] = useState<{ url: string, title?: string | null, extractor?: string | null, thumbnail?: string | null, at: number }[]>([])
  const [prefs, setPrefs] = useState<{ onlyMp4: boolean, onlyMuxed: boolean, hideStreaming: boolean, autoAnalyzeOnShare: boolean }>(() => {
    try { return JSON.parse(localStorage.getItem('aoi:prefs') || '') || { onlyMp4: false, onlyMuxed: false, hideStreaming: false, autoAnalyzeOnShare: true } } catch { return { onlyMp4: false, onlyMuxed: false, hideStreaming: false, autoAnalyzeOnShare: true } }
  })
  const [showAutoSubs, setShowAutoSubs] = useState(false)
  const platformRefs = React.useRef<(HTMLButtonElement | null)[]>([])

  React.useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (res.ok) {
          const u = await res.json()
          setUser(u)
        }
      } catch {}
      try {
        const res = await fetch('/api/cookies/status')
        if (res.ok) {
          const s = await res.json()
          setCookiesOn(!!s?.enabled)
        }
      } catch {}
      try {
        const saved = JSON.parse(localStorage.getItem('aoi:history') || '[]')
        if (Array.isArray(saved)) setHistoryItems(saved)
      } catch {}
    })()
  }, [])

  React.useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  React.useEffect(() => {
    try {
      localStorage.setItem('aoi:prefs', JSON.stringify(prefs))
    } catch (err) {
      console.warn('Failed to persist preferences to localStorage', err)
    }
  }, [prefs])

  React.useEffect(() => {
    // Handle PWA share target or incoming url param
    const params = new URLSearchParams(location.search)
    const sharedUrl = params.get('url')
    if (sharedUrl) {
      setUrl(sharedUrl)
      if (prefs.autoAnalyzeOnShare) {
        setTimeout(() => {
          const form = document.getElementById('analyze-form') as HTMLFormElement | null
          form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
        }, 50)
      }
    }
  }, [])

  const recommended = useMemo(() => {
    if (!data) return [] as Format[]
    // Prefer muxed formats with highest resolution; server sorts best first
    return data.formats.filter(f => (f.vcodec && f.acodec && f.vcodec !== 'none' && f.acodec !== 'none'))
  }, [data])

  const videos = useMemo(() => {
    if (!data) return [] as Format[]
    return data.formats.filter(f => !f.is_audio_only)
  }, [data])

  const audios = useMemo(() => {
    if (!data) return [] as Format[]
    return data.formats.filter(f => f.is_audio_only)
  }, [data])

  const filteredVideos = useMemo(() => {
    let arr = videos.slice()
    if (prefs.onlyMp4) arr = arr.filter(f => (f.ext || '').toLowerCase() === 'mp4')
    if (prefs.onlyMuxed) arr = arr.filter(f => f.vcodec && f.acodec && f.vcodec !== 'none' && f.acodec !== 'none')
    if (prefs.hideStreaming) arr = arr.filter(f => !((f.protocol || '').toLowerCase().includes('m3u8') || (f.protocol || '').toLowerCase().includes('dash')))
    return arr
  }, [videos, prefs])

  const filteredAudios = useMemo(() => {
    let arr = audios.slice()
    if (prefs.hideStreaming) arr = arr.filter(f => !((f.protocol || '').toLowerCase().includes('m3u8') || (f.protocol || '').toLowerCase().includes('dash')))
    return arr
  }, [audios, prefs])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setData(null)
    if (loading) return
    if (!url.trim()) {
      setError('Please paste a valid URL')
      return
    }
    setLoading(true)
    try {
      const normalized = normalizeInputUrl(url)
      if (!normalized) {
        throw new Error('Please enter a valid http(s) URL')
      }
      const src = normalized
      // Auto-detect platform tab from URL
      try {
        const host = new URL(src).hostname
        if (/youtu\.be|youtube\.com/i.test(host)) setActive('youtube')
        else if (/tiktok\.com/i.test(host)) setActive('tiktok')
        else if (/facebook\.com/i.test(host)) setActive('facebook')
        else if (/instagram\.com/i.test(host)) setActive('instagram')
        else if (/soundcloud\.com/i.test(host)) setActive('soundcloud')
      } catch {}
      // Cancel any previous request
      aborter?.abort()
      const controller = new AbortController()
      setAborter(controller)
      const res = await extract(src, controller.signal)
      setLastSource(src)
      setData(res)
      // Save to history
      try {
        const item = { url: src, title: res?.title || null, extractor: res?.extractor || null, thumbnail: res?.thumbnail || null, at: Date.now() }
        const next = [item, ...historyItems.filter(h => h.url !== src)].slice(0, 10)
        setHistoryItems(next)
        localStorage.setItem('aoi:history', JSON.stringify(next))
      } catch {}
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.code === 20) {
        return
      }
      setError(err?.message ?? 'Failed to extract')
    } finally {
      setLoading(false)
      setAborter(null)
    }
  }

  function platformIconByExtractor(extractor?: string) {
    const name = (extractor || '').toLowerCase()
    if (name.includes('youtube')) return Youtube
    if (name.includes('tiktok')) return PlayCircle
    if (name.includes('facebook')) return Facebook
    if (name.includes('instagram')) return Instagram
    if (name.includes('soundcloud')) return Music
    return Video
  }

  function onDropHandler(ev: React.DragEvent) {
    ev.preventDefault()
    try {
      const text = ev.dataTransfer.getData('text/uri-list') || ev.dataTransfer.getData('text/plain')
      if (text) setUrl(text)
    } catch {}
  }
  function onDragOverHandler(ev: React.DragEvent) { ev.preventDefault() }

  const bestHref = useMemo(() => {
    const src = lastSource
    const pick = recommended[0] || filteredVideos[0] || filteredAudios[0]
    if (!src || !pick || !pick.format_id) return undefined
    const params = new URLSearchParams()
    params.set('source', src)
    params.set('format_id', String(pick.format_id))
    return `/api/download?${params.toString()}`
  }, [lastSource, recommended, filteredVideos, filteredAudios])

  return (
    <div className="min-h-screen min-h-[100dvh] relative overflow-x-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900" />
      <div className="absolute inset-0 bg-grid opacity-[0.30]" />
      <div className="absolute inset-0 bg-noise opacity-[0.06]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-64 sm:h-80 w-[40rem] max-w-[calc(100vw-2rem)] rounded-full blur-3xl bg-gradient-to-r from-fuchsia-500/20 via-purple-500/20 to-cyan-400/20" />

      <header className="relative z-10 sticky top-0 backdrop-blur border-b border-[color:var(--aoi-colors-border-subtle)] bg-[color:var(--aoi-colors-background)]/85 pt-[env(safe-area-inset-top)]">
        <div className="max-w-screen-content mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-fuchsia-500 via-purple-500 to-cyan-400 grid place-items-center shadow-lg shadow-fuchsia-500/20 glow">
              <Download className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[color:var(--aoi-colors-text-primary)] font-semibold tracking-tight">All-In-One Downloader</div>
              <div className="text-xs text-[color:var(--aoi-colors-text-muted)] -mt-0.5">Fast. Gorgeous. Private.</div>
            </div>
          </div>
          <ul className="flex flex-wrap justify-end items-center gap-x-4 gap-y-1 text-[color:var(--aoi-colors-text-secondary)] text-xs sm:text-sm">
            <li className="inline-flex items-center gap-1 sm:gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true"/> Secure</li>
            <li className="inline-flex items-center gap-1 sm:gap-2"><Waves className="h-4 w-4 text-cyan-400" aria-hidden="true"/> No ads</li>
            <li className="inline-flex items-center gap-1 sm:gap-2"><Crown className="h-4 w-4 text-amber-400" aria-hidden="true"/> Free</li>
            <li className="inline-flex items-center gap-1 sm:gap-2"><Cookie className="h-4 w-4 text-pink-400" aria-hidden="true"/> Cookies: <span className={clsx('font-medium', cookiesOn ? 'text-emerald-300' : 'text-[color:var(--aoi-colors-text-muted)]')}>{cookiesOn == null ? '—' : cookiesOn ? 'On' : 'Off'}</span></li>
            {installPrompt && (
              <li>
                <Button
                  size="xs"
                  variant="soft"
                  onClick={async () => { try { await installPrompt.prompt?.(); } catch {} finally { setInstallPrompt(null) } }}
                >
                  Install
                </Button>
              </li>
            )}
            <li>
              {user ? (
                <div className="inline-flex items-center gap-2">
                  <span className="text-[color:var(--aoi-colors-text-primary)]">{user.email || 'Guest'}</span>
                  <Button
                    size="xs"
                    variant="soft"
                    onClick={async () => {
                      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
                      setUser(null)
                    }}
                  >
                    Logout
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="surface"
                  onClick={() => setAuthOpen(true)}
                >
                  Log in
                </Button>
              )}
            </li>
          </ul>
        </div>
      </header>

      <main className="relative z-10 max-w-screen-content mx-auto px-4 py-10" onDrop={onDropHandler} onDragOver={onDragOverHandler}>
        <section className="text-center">
          <FadeInUpH1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight text-[color:var(--aoi-colors-text-primary)]">
            Download from <span className="text-transparent bg-clip-text bg-brand-gradient">YouTube</span>, Facebook, TikTok, Instagram & SoundCloud
          </FadeInUpH1>
          <p className="mt-3 text-[color:var(--aoi-colors-text-secondary)] max-w-xl mx-auto">
            Paste a link, pick your quality, and download. No sign-up, no watermark. Works on mobile and desktop.
          </p>

          <div className="mt-6">
            <div
              className="inline-flex flex-wrap items-center justify-center rounded-full border border-[color:var(--aoi-colors-border-subtle)] bg-[color:var(--aoi-colors-surface-muted)] p-1 gap-1"
              role="tablist"
              aria-label="Select a platform"
            >
              {PLATFORMS.map((p, index) => {
                const Icon = p.icon
                const isActive = active === p.key
                return (
                  <Button
                    key={p.key}
                    ref={(el) => { platformRefs.current[index] = el as HTMLButtonElement | null }}
                    shape="pill"
                    size="sm"
                    variant={isActive ? 'surface' : 'ghost'}
                    className={clsx(
                      'px-3 py-2 sm:py-1.5 text-sm transition-all',
                      isActive
                        ? 'text-[color:var(--aoi-colors-text-primary)] shadow-[0_0_0_1px_rgba(168,85,247,0.35)]'
                        : 'text-[color:var(--aoi-colors-text-secondary)] hover:-translate-y-0.5'
                    )}
                    onClick={() => setActive(p.key)}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                        event.preventDefault()
                        const direction = event.key === 'ArrowRight' ? 1 : -1
                        const nextIndex = (index + direction + PLATFORMS.length) % PLATFORMS.length
                        const nextPlatform = PLATFORMS[nextIndex]
                        setActive(nextPlatform.key)
                        platformRefs.current[nextIndex]?.focus()
                      } else if (event.key === 'Home') {
                        event.preventDefault()
                        const nextPlatform = PLATFORMS[0]
                        setActive(nextPlatform.key)
                        platformRefs.current[0]?.focus()
                      } else if (event.key === 'End') {
                        event.preventDefault()
                        const lastIndex = PLATFORMS.length - 1
                        const nextPlatform = PLATFORMS[lastIndex]
                        setActive(nextPlatform.key)
                        platformRefs.current[lastIndex]?.focus()
                      }
                    }}
                    role="tab"
                    aria-selected={isActive}
                    tabIndex={isActive ? 0 : -1}
                  >
                    <Icon className={clsx('h-4 w-4', p.color)} aria-hidden="true" />
                    <span className="font-medium">{p.label}</span>
                    {isActive && <BadgeCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />}
                  </Button>
                )
              })}
            </div>
          </div>

          <form id="analyze-form" onSubmit={onSubmit} className="mt-8 max-w-3xl mx-auto">
            <Surface tone="raised" border="subtle" padding="none" className="relative overflow-hidden shadow-lg">
              <div className="absolute inset-0 pointer-events-none [mask-image:radial-gradient(50%_50%_at_50%_0%,rgba(255,255,255,.4),transparent_70%)] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,.08),transparent_40%)]" />
              <div className="relative p-3 md:p-4">
                <label htmlFor="source-url" className="text-left text-xs text-[color:var(--aoi-colors-text-muted)] px-1 pb-2">Source URL</label>
                <div className="flex flex-col md:flex-row gap-3 items-stretch">
                  <div className="flex-1 flex items-center gap-2 rounded-[var(--aoi-radii-control)] border border-[color:var(--aoi-colors-border-subtle)] bg-[color:var(--aoi-colors-surface-strong)]/70 px-3 py-2 focus-ring-within">
                    <LinkIcon className="h-4 w-4 text-[color:var(--aoi-colors-text-muted)]" aria-hidden="true" />
                    <input
                      id="source-url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      type="url"
                      placeholder={`Paste ${PLATFORMS.find(p=>p.key===active)?.label} URL (https://...)`}
                      className="w-full bg-transparent text-[color:var(--aoi-colors-text-primary)] outline-none placeholder:text-[color:var(--aoi-colors-text-muted)]"
                      inputMode="url"
                      enterKeyHint="go"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                  <Button
                    type="button"
                    size="md"
                    variant="soft"
                    className="hover:-translate-y-0.5"
                    aria-label="Paste from clipboard"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText()
                        if (text) setUrl(text)
                      } catch (e) {
                        setError('Clipboard permission denied')
                      }
                    }}
                  >
                    Paste
                  </Button>
                  <Button
                    type="submit"
                    size="md"
                    variant="primary"
                    className="hover:-translate-y-0.5"
                    aria-busy={loading}
                    disabled={loading}
                  >
                    {loading ? (<><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true"/> Analyzing...</>) : (<><Sparkles className="h-4 w-4" aria-hidden="true"/> Analyze</>)}
                  </Button>
                </div>
              </div>

              <div className="relative px-4 pb-4 text-left text-xs text-[color:var(--aoi-colors-text-muted)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Popover.Root>
                    <Popover.Trigger asChild>
                      <Button
                        size="xs"
                        variant="ghost"
                        className="text-[color:var(--aoi-colors-text-secondary)] hover:text-[color:var(--aoi-colors-text-primary)]"
                      >
                        <Info className="h-3.5 w-3.5" aria-hidden="true"/> Advanced
                      </Button>
                    </Popover.Trigger>
                    <Popover.Content sideOffset={8} className="rounded-[var(--aoi-radii-control)] border border-[color:var(--aoi-colors-border-subtle)] bg-[color:var(--aoi-colors-surface-strong)]/90 backdrop-blur p-3 text-left text-xs text-[color:var(--aoi-colors-text-secondary)] shadow-xl max-w-sm">
                      <div>For private/age-gated videos, add cookies on the server via <code className="px-1 rounded bg-white/10">AOI_COOKIEFILE</code> or base64 with <code className="px-1 rounded bg-white/10">AOI_COOKIES_BASE64</code>.</div>
                    </Popover.Content>
                  </Popover.Root>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      className="text-[color:var(--aoi-colors-text-secondary)] hover:text-[color:var(--aoi-colors-text-primary)] underline/30 hover:underline"
                      onClick={() => setUrl('https://www.tiktok.com/@scout2015/video/6718335390845095173')}
                    >
                      Sample TikTok
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      className="text-[color:var(--aoi-colors-text-secondary)] hover:text-[color:var(--aoi-colors-text-primary)] underline/30 hover:underline"
                      onClick={() => setUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')}
                    >
                      Sample YouTube
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      className="text-[color:var(--aoi-colors-text-secondary)] hover:text-[color:var(--aoi-colors-text-primary)] underline/30 hover:underline"
                      onClick={() => setUrl('https://www.facebook.com/watch/?v=10153231379946729')}
                    >
                      Sample Facebook
                    </Button>
                  </div>
                </div>
              </div>
            </Surface>
          </form>

          {error && (
            <Surface
              tone="muted"
              border="none"
              className="mt-4 max-w-3xl mx-auto border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-left text-rose-100"
              role="alert"
            >
              <div className="font-medium text-rose-50">{error}</div>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-rose-100/90">
                {/(private|age|login)/i.test(error) && <li>Content may be private/age-gated. {cookiesOn ? 'Cookies are enabled.' : 'Add cookies to access restricted content.'}</li>}
                {/403|429|forbidden|quota|rate/i.test(error) && <li>Server may be blocked or rate-limited. Try again later or a different network.</li>}
                {/not found|format not/i.test(error) && <li>Try a different quality or format.</li>}
                <li>Ensure the link opens in your browser and is not behind a paywall.</li>
              </ul>
            </Surface>
          )}

          <div className="sr-only" aria-live="polite">{loading ? 'Analyzing URL…' : data ? 'Formats ready' : error ? `Error: ${error}` : ''}</div>
        </section>

        {data && (
          <section className="mt-10 grid gap-6 md:grid-cols-[2fr_3fr]">
            <FadeInUp className="h-full">
              <Surface tone="raised" border="subtle" padding="none" className="h-full overflow-hidden">
                <div className="p-4 border-b border-[color:var(--aoi-colors-border-subtle)]">
                  <div className="mb-2 inline-flex items-center gap-2 text-sm uppercase tracking-wider text-[color:var(--aoi-colors-text-muted)]"><Video className="h-4 w-4" aria-hidden="true"/> Details</div>
                  <h2 className="text-xl font-semibold text-[color:var(--aoi-colors-text-primary)] inline-flex items-center gap-2">
                    {(() => { const Icon = platformIconByExtractor(data.extractor); return <Icon className="h-5 w-5 opacity-80" aria-hidden="true"/> })()}
                    {data.title || 'Untitled'}
                  </h2>
                  <div className="mt-1 text-sm text-[color:var(--aoi-colors-text-muted)]">Duration: {formatDuration(data.duration)}</div>
                </div>
                {data.thumbnail && (
                  <img
                    src={data.thumbnail}
                    className="w-full max-h-[320px] object-cover"
                    alt={data.title ? `${data.title} thumbnail` : 'Content thumbnail'}
                  />
                )}
                <div className="p-4 text-left text-sm text-[color:var(--aoi-colors-text-muted)]">
                  <div className="inline-flex items-center gap-2 text-[color:var(--aoi-colors-text-secondary)]"><BadgeCheck className="h-4 w-4 text-emerald-400" aria-hidden="true"/> Extractor: {data.extractor}</div>
                  <div className="mt-3">
                    {data.webpage_url && (
                      <Button
                        as="a"
                        href={data.webpage_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="sm"
                        variant="soft"
                        className="justify-start"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden="true"/> Open source page
                      </Button>
                    )}
                  </div>
                </div>
              </Surface>
            </FadeInUp>

            <FadeInUp className="h-full">
              <Surface tone="raised" border="subtle" padding="none" className="h-full overflow-hidden">
                <div className="p-4 border-b border-[color:var(--aoi-colors-border-subtle)] flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 text-sm uppercase tracking-wider text-[color:var(--aoi-colors-text-muted)]"><Download className="h-4 w-4" aria-hidden="true"/> Download Options</div>
                  <div className="flex items-center gap-2">
                    {bestHref ? (
                      <Button
                        as="a"
                        href={bestHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="sm"
                        variant="surface"
                        className="justify-start"
                      >
                        <Download className="h-4 w-4" aria-hidden="true"/> Best quality
                      </Button>
                    ) : (
                      <Button
                        as="span"
                        size="sm"
                        variant="soft"
                        aria-disabled="true"
                        className="pointer-events-none opacity-60 justify-start"
                      >
                        <Download className="h-4 w-4" aria-hidden="true"/> Best quality
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-[color:var(--aoi-colors-text-secondary)] hover:text-[color:var(--aoi-colors-text-primary)]"
                      onClick={() => {
                        setUrl(data.webpage_url || '')
                        setData(null)
                        setError(null)
                      }}
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true"/> New link
                    </Button>
                  </div>
                </div>

                <div className="p-4">
                <Tabs.Root defaultValue={recommended.length > 0 ? 'rec' : 'video'}>
                  <Tabs.List className="inline-flex flex-wrap items-center justify-center gap-1 rounded-full border border-[color:var(--aoi-colors-border-subtle)] bg-[color:var(--aoi-colors-surface-muted)] p-1">
                    <Tabs.Trigger value="rec" className="focus-ring px-3 py-1.5 rounded-full text-sm transition-colors data-[state=active]:bg-[color:var(--aoi-colors-surface-strong)] data-[state=active]:text-[color:var(--aoi-colors-text-primary)] text-[color:var(--aoi-colors-text-secondary)] hover:bg-[color:var(--aoi-colors-surface-muted)]/80 disabled:opacity-50">
                      Recommended
                    </Tabs.Trigger>
                    <Tabs.Trigger value="video" className="focus-ring px-3 py-1.5 rounded-full text-sm transition-colors data-[state=active]:bg-[color:var(--aoi-colors-surface-strong)] data-[state=active]:text-[color:var(--aoi-colors-text-primary)] text-[color:var(--aoi-colors-text-secondary)] hover:bg-[color:var(--aoi-colors-surface-muted)]/80">
                      Video
                    </Tabs.Trigger>
                    <Tabs.Trigger value="audio" className="focus-ring px-3 py-1.5 rounded-full text-sm transition-colors data-[state=active]:bg-[color:var(--aoi-colors-surface-strong)] data-[state=active]:text-[color:var(--aoi-colors-text-primary)] text-[color:var(--aoi-colors-text-secondary)] hover:bg-[color:var(--aoi-colors-surface-muted)]/80">
                      Audio
                    </Tabs.Trigger>
                    {!!(data?.subtitles?.length) && (
                      <Tabs.Trigger value="subs" className="focus-ring px-3 py-1.5 rounded-full text-sm transition-colors data-[state=active]:bg-[color:var(--aoi-colors-surface-strong)] data-[state=active]:text-[color:var(--aoi-colors-text-primary)] text-[color:var(--aoi-colors-text-secondary)] hover:bg-[color:var(--aoi-colors-surface-muted)]/80">
                        Subtitles
                      </Tabs.Trigger>
                    )}
                  </Tabs.List>

                  <div className="mt-4 grid gap-6">
                    <Tabs.Content value="rec">
                      {recommended.length > 0 ? (
                        <div className="grid gap-2">
                          {recommended.slice(0, 4).map((f) => (
                            <FormatRow key={`rec-${f.format_id}`} format={f} source={lastSource} />
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-[color:var(--aoi-colors-text-muted)]">No recommended MP4 found. See other tabs.</div>
                      )}
                    </Tabs.Content>

                    <Tabs.Content value="video">
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[color:var(--aoi-colors-text-secondary)]">
                        <FilterIcon className="h-3.5 w-3.5 text-[color:var(--aoi-colors-text-muted)]" aria-hidden="true"/>
                        <ChipToggle checked={prefs.onlyMp4} onCheckedChange={(value) => setPrefs(p => ({ ...p, onlyMp4: value }))}>Only MP4</ChipToggle>
                        <ChipToggle checked={prefs.onlyMuxed} onCheckedChange={(value) => setPrefs(p => ({ ...p, onlyMuxed: value }))}>Only muxed</ChipToggle>
                        <ChipToggle checked={prefs.hideStreaming} onCheckedChange={(value) => setPrefs(p => ({ ...p, hideStreaming: value }))}>Hide HLS/DASH</ChipToggle>
                      </div>
                      <div className="grid gap-2 max-h-[60vh] overflow-auto pr-1">
                        {videos.length === 0 ? (
                          <div className="text-sm text-[color:var(--aoi-colors-text-muted)]">No video formats found</div>
                        ) : (
                          filteredVideos.map((f) => (
                            <FormatRow key={`v-${f.format_id}`} format={f} source={lastSource} />
                          ))
                        )}
                      </div>
                    </Tabs.Content>

                    <Tabs.Content value="audio">
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[color:var(--aoi-colors-text-secondary)]">
                        <FilterIcon className="h-3.5 w-3.5 text-[color:var(--aoi-colors-text-muted)]" aria-hidden="true"/>
                        <ChipToggle checked={prefs.hideStreaming} onCheckedChange={(value) => setPrefs(p => ({ ...p, hideStreaming: value }))}>Hide HLS/DASH</ChipToggle>
                      </div>
                      <div className="grid gap-2 max-h-[60vh] overflow-auto pr-1">
                        {audios.length === 0 ? (
                          <div className="text-sm text-[color:var(--aoi-colors-text-muted)]">No audio formats found</div>
                        ) : (
                          filteredAudios.map((f) => (
                            <FormatRow key={`a-${f.format_id}`} format={f} source={lastSource} />
                          ))
                        )}
                      </div>
                    </Tabs.Content>

                    <Tabs.Content value="subs">
                      {!(data?.subtitles?.length) ? (
                        <div className="text-sm text-[color:var(--aoi-colors-text-muted)]">No subtitles found</div>
                      ) : (
                        <div>
                          <div className="mb-3 flex items-center gap-2 text-xs text-[color:var(--aoi-colors-text-secondary)]">
                            <Languages className="h-3.5 w-3.5 text-[color:var(--aoi-colors-text-muted)]" aria-hidden="true"/>
                            <ChipToggle checked={showAutoSubs} onCheckedChange={setShowAutoSubs}>Show auto-captions</ChipToggle>
                          </div>
                          <div className="grid gap-2 max-h-[60vh] overflow-auto pr-1">
                            {Object.entries(
                              (data.subtitles || []).filter(s => showAutoSubs ? true : !s.auto).reduce((acc: Record<string, { lang: string, tracks: { ext?: string | null, auto?: boolean }[] }>, s) => {
                                acc[s.lang] = acc[s.lang] || { lang: s.lang, tracks: [] }
                                acc[s.lang].tracks.push({ ext: s.ext, auto: s.auto })
                                return acc
                              }, {})
                            ).map(([lang, entry]) => (
                              <Surface
                                key={lang}
                                tone="muted"
                                padding="sm"
                                className="flex flex-wrap items-center justify-between gap-3"
                              >
                                <div className="text-sm text-[color:var(--aoi-colors-text-primary)]">{lang}</div>
                                <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                                  {entry.tracks.map((t, idx) => {
                                    if (!lastSource) {
                                      return (
                                        <Button
                                          as="span"
                                          key={`${lang}-${t.ext || 'vtt'}-${idx}`}
                                          size="xs"
                                          variant="soft"
                                          aria-disabled="true"
                                          className="pointer-events-none opacity-60 justify-start"
                                        >
                                          <Download className="h-4 w-4" aria-hidden="true"/> {(t.ext || 'vtt').toUpperCase()} {t.auto ? '(auto)' : ''}
                                        </Button>
                                      )
                                    }
                                    const params = new URLSearchParams()
                                    params.set('source', lastSource)
                                    params.set('lang', lang)
                                    if (t.ext) params.set('ext', String(t.ext))
                                    if (t.auto) params.set('auto', '1')
                                    const href = `/api/subtitle?${params.toString()}`
                                    return (
                                      <Button
                                        as="a"
                                        key={`${lang}-${t.ext || 'vtt'}-${idx}`}
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download
                                        size="xs"
                                        variant="surface"
                                        className="justify-start"
                                      >
                                        <Download className="h-4 w-4" aria-hidden="true"/> {(t.ext || 'vtt').toUpperCase()} {t.auto ? '(auto)' : ''}
                                      </Button>
                                    )
                                  })}
                                </div>
                              </Surface>
                            ))}
                          </div>
                        </div>
                      )}
                    </Tabs.Content>
                  </div>
                </Tabs.Root>
              </div>
            </Surface>
          </FadeInUp>
          </section>
        )}

        {!data && !error && (
          <div className="mt-10 text-center text-sm text-[color:var(--aoi-colors-text-muted)]">
            <div className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true"/>
              Supports direct downloads for most sites. For HLS/DASH, a compatible player/app may be required.
            </div>
            {!!historyItems.length && (
              <div className="mt-6 text-left max-w-3xl mx-auto">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 text-[color:var(--aoi-colors-text-secondary)]"><HistoryIcon className="h-4 w-4" aria-hidden="true"/> Recent</div>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="text-[color:var(--aoi-colors-text-muted)] hover:text-[color:var(--aoi-colors-text-primary)]"
                    onClick={() => {
                      setHistoryItems([])
                      localStorage.removeItem('aoi:history')
                    }}
                  >
                    Clear
                  </Button>
                </div>
                <div className="mt-2 grid gap-2">
                  {historyItems.map((h, i) => (
                    <Surface
                      as="button"
                      key={`${h.url}-${i}`}
                      tone="muted"
                      padding="sm"
                      interactive
                      className="flex items-center gap-3 text-left"
                      onClick={() => {
                        setUrl(h.url)
                        setTimeout(() => {
                          const form = document.getElementById('analyze-form') as HTMLFormElement | null
                          form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
                        }, 10)
                      }}
                    >
                      {h.thumbnail ? (
                        <img
                          src={h.thumbnail}
                          alt={h.title ? `${h.title} thumbnail` : h.url ? `${h.url} thumbnail` : 'Download thumbnail'}
                          className="h-12 w-20 object-cover rounded-[var(--aoi-radii-control)]"
                        />
                      ) : (
                        <div className="h-12 w-20 rounded-[var(--aoi-radii-control)] bg-white/10" />
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-[color:var(--aoi-colors-text-primary)] text-sm">{h.title || h.url}</div>
                        <div className="text-xs text-[color:var(--aoi-colors-text-muted)]">{new Date(h.at).toLocaleString()}</div>
                      </div>
                    </Surface>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <section className="mt-12 text-center text-xs text-[color:var(--aoi-colors-text-muted)] pb-[env(safe-area-inset-bottom)]">
          <p>
            Always respect each service's Terms of Service and copyright. Use this tool only for content you own rights to or have permission to download.
          </p>
        </section>
      </main>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthSuccess={(u) => setUser(u)}
      />
    </div>
  )
}

export function FormatRow({ format, source }: { format: Format, source: string | null }) {
  const quality = format.resolution ?? (format.audio_bitrate ? `${format.audio_bitrate}kbps` : '—')
  const isMuxed = format.vcodec && format.acodec && format.vcodec !== 'none' && format.acodec !== 'none'
  const isAudio = format.is_audio_only
  const protocolLabel = React.useMemo(() => {
    const p = (format.protocol || '').toLowerCase()
    if (!p) return null
    if (p.includes('m3u8')) return 'HLS'
    if (p.includes('dash')) return 'DASH'
    return null
  }, [format.protocol])

  // Build proxy link to preserve headers compatibility
  const proxyHref = useMemo(() => {
    const urlParams = new URLSearchParams()
    if (source && format.format_id) {
      urlParams.set('source', source)
      urlParams.set('format_id', String(format.format_id))
      return `/api/download?${urlParams.toString()}`
    }
    return format.direct_url ?? undefined
  }, [source, format.format_id, format.direct_url])

  const [copyStatus, setCopyStatus] = React.useState<'idle' | 'success' | 'error'>('idle')
  const copyTimeoutRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current != null) {
        window.clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  async function copyLink() {
    if (!proxyHref) return
    try {
      await navigator.clipboard.writeText(proxyHref)
      setCopyStatus('success')
    } catch {
      setCopyStatus('error')
    }

    if (copyTimeoutRef.current != null) {
      window.clearTimeout(copyTimeoutRef.current)
    }
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopyStatus('idle')
      copyTimeoutRef.current = null
    }, 2000)
  }

  const mp3Href = useMemo(() => {
    if (!source) return undefined
    const params = new URLSearchParams()
    params.set('source', source)
    if (format.format_id) params.set('format_id', String(format.format_id))
    return `/api/convert_mp3?${params.toString()}`
  }, [source, format.format_id])

  return (
    <Surface
      tone="muted"
      padding="sm"
      interactive
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={clsx(
            'grid h-10 w-10 place-items-center rounded-[var(--aoi-radii-control)]',
            isAudio ? 'bg-emerald-500/15' : isMuxed ? 'bg-cyan-500/15' : 'bg-purple-500/15'
          )}
        >
          {isAudio ? <Music2 className="h-4 w-4 text-emerald-400" aria-hidden="true"/> : isMuxed ? <PlayCircle className="h-4 w-4 text-cyan-400" aria-hidden="true"/> : <Video className="h-4 w-4 text-purple-400" aria-hidden="true"/>}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm text-[color:var(--aoi-colors-text-primary)]">{quality} {format.fps ? `${format.fps}fps` : ''} {format.ext ? `· ${format.ext}` : ''}</div>
          <div className="text-xs text-[color:var(--aoi-colors-text-muted)]">{format.filesize_pretty ?? 'Size unknown'}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
        {protocolLabel && (
          <span className="rounded-[var(--aoi-radii-pill)] border border-[color:var(--aoi-colors-border-subtle)] px-2 py-0.5 text-[10px] text-[color:var(--aoi-colors-text-muted)]">{protocolLabel}</span>
        )}
        {proxyHref && (
          <Button
            as="a"
            href={proxyHref}
            target="_blank"
            rel="noopener noreferrer"
            download
            size="sm"
            variant="surface"
            className="justify-start"
          >
            <Download className="h-4 w-4" aria-hidden="true"/> Download
          </Button>
        )}
        {proxyHref && (
          <Button
            type="button"
            size="xs"
            variant="soft"
            onClick={copyLink}
            className="justify-start"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true"/> <span className="hidden sm:inline">Copy link</span><span className="sm:hidden">Copy</span>
          </Button>
        )}
        {copyStatus === 'success' && (
          <span className="text-[11px] font-medium text-emerald-300">Copied!</span>
        )}
        {copyStatus === 'error' && (
          <span className="text-[11px] font-medium text-rose-300">Copy failed</span>
        )}
        <span className="sr-only" aria-live="polite">
          {copyStatus === 'success'
            ? 'Download link copied to clipboard'
            : copyStatus === 'error'
            ? 'Failed to copy download link'
            : ''}
        </span>
        {isAudio && mp3Href && (
          <Button
            as="a"
            href={mp3Href}
            target="_blank"
            rel="noopener noreferrer"
            size="xs"
            variant="soft"
            className="justify-start"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true"/> <span className="sm:hidden">MP3</span><span className="hidden sm:inline">MP3</span>
          </Button>
        )}
      </div>
    </Surface>
  )
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={clsx('animate-pulse rounded-md bg-white/10', className)} />
  )
}
