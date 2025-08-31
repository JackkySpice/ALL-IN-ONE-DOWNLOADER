import React, { useMemo, useState } from 'react'
import { Download, Music2, PlayCircle, Youtube, Instagram, Facebook, Music, BadgeCheck, Link as LinkIcon, Loader2, Crown, ShieldCheck, Video, Waves, Sparkles, RefreshCw, Info, CheckCircle2, Copy, ExternalLink, History as HistoryIcon, Filter as FilterIcon, Languages, Cookie } from 'lucide-react'
import clsx from 'clsx'
import * as Popover from '@radix-ui/react-popover'
import * as Tabs from '@radix-ui/react-tabs'
import { FadeInUp, FadeInUpH1 } from './components/Animated'
import AuthModal from './components/AuthModal'

const PLATFORMS = [
  { key: 'youtube', label: 'YouTube', color: 'text-red-500', icon: Youtube },
  { key: 'facebook', label: 'Facebook', color: 'text-blue-500', icon: Facebook },
  { key: 'tiktok', label: 'TikTok', color: 'text-pink-400', icon: PlayCircle },
  { key: 'instagram', label: 'Instagram', color: 'text-fuchsia-400', icon: Instagram },
  { key: 'soundcloud', label: 'SoundCloud', color: 'text-orange-400', icon: Music },
]

type Format = {
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

async function extract(url: string): Promise<ExtractResponse> {
  const res = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
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

function formatDuration(seconds?: number) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [h, m, s]
    .map((v, i) => (i === 0 ? String(v) : String(v).padStart(2, '0')))
    .filter((v, i) => i === 0 ? v !== '0' : true)
    .join(':')
}

function normalizeInputUrl(raw: string): string | null {
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
  const [aborter, setAborter] = useState<AbortController | null>(null)
  const [user, setUser] = useState<{ id: string, email?: string | null, guest: boolean } | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [cookiesOn, setCookiesOn] = useState<boolean | null>(null)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [historyItems, setHistoryItems] = useState<{ url: string, title?: string | null, extractor?: string | null, thumbnail?: string | null, at: number }[]>([])
  const [prefs, setPrefs] = useState<{ onlyMp4: boolean, onlyMuxed: boolean, hideStreaming: boolean, autoAnalyzeOnShare: boolean }>(() => {
    try { return JSON.parse(localStorage.getItem('aoi:prefs') || '') || { onlyMp4: false, onlyMuxed: true, hideStreaming: true, autoAnalyzeOnShare: true } } catch { return { onlyMp4: false, onlyMuxed: true, hideStreaming: true, autoAnalyzeOnShare: true } }
  })
  const [showAutoSubs, setShowAutoSubs] = useState(false)

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
    localStorage.setItem('aoi:prefs', JSON.stringify(prefs))
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
      const res = await extract(src)
      ;(window as any).__aoi_last_source = src
      setData(res)
      // Save to history
      try {
        const item = { url: src, title: res?.title || null, extractor: res?.extractor || null, thumbnail: res?.thumbnail || null, at: Date.now() }
        const next = [item, ...historyItems.filter(h => h.url !== src)].slice(0, 10)
        setHistoryItems(next)
        localStorage.setItem('aoi:history', JSON.stringify(next))
      } catch {}
    } catch (err: any) {
      setError(err?.message ?? 'Failed to extract')
    } finally {
      setLoading(false)
    }
  }

  function bestDownloadHref(): string | undefined {
    const src = (window as any).__aoi_last_source as string | undefined
    const pick = (recommended[0] || filteredVideos[0] || filteredAudios[0])
    if (!src || !pick) return undefined
    const params = new URLSearchParams()
    params.set('source', src)
    params.set('format_id', String(pick.format_id))
    return `/api/download?${params.toString()}`
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

  return (
    <div className="min-h-[100dvh] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900" />
      <div className="absolute inset-0 bg-grid opacity-[0.30]" />
      <div className="absolute inset-0 bg-noise opacity-[0.06]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-80 w-[40rem] rounded-full blur-3xl bg-gradient-to-r from-fuchsia-500/20 via-purple-500/20 to-cyan-400/20" />

      <header className="relative z-10 sticky top-0 backdrop-blur border-b border-white/10 bg-slate-950/70 pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-fuchsia-500 via-purple-500 to-cyan-400 grid place-items-center shadow-lg shadow-fuchsia-500/20 glow">
              <Download className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-white font-semibold tracking-tight">All-In-One Downloader</div>
              <div className="text-xs text-slate-400 -mt-0.5">Fast. Gorgeous. Private.</div>
            </div>
          </div>
          <ul className="flex flex-wrap justify-end items-center gap-x-4 gap-y-1 text-slate-300 text-xs sm:text-sm">
            <li className="inline-flex items-center gap-1 sm:gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400"/> Secure</li>
            <li className="inline-flex items-center gap-1 sm:gap-2"><Waves className="h-4 w-4 text-cyan-400"/> No ads</li>
            <li className="inline-flex items-center gap-1 sm:gap-2"><Crown className="h-4 w-4 text-amber-400"/> Free</li>
            <li className="inline-flex items-center gap-1 sm:gap-2"><Cookie className="h-4 w-4 text-pink-400"/> Cookies: <span className={clsx('font-medium', cookiesOn ? 'text-emerald-300' : 'text-slate-400')}>{cookiesOn == null ? '—' : cookiesOn ? 'On' : 'Off'}</span></li>
            {installPrompt && (
              <li>
                <button
                  onClick={async () => { try { await installPrompt.prompt?.(); } catch {} finally { setInstallPrompt(null) } }}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
                >
                  Install
                </button>
              </li>
            )}
            <li>
              {user ? (
                <div className="inline-flex items-center gap-2">
                  <span className="text-slate-200">{user.email || 'Guest'}</span>
                  <button
                    onClick={async () => { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); setUser(null) }}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
                  >Logout</button>
                </div>
              ) : (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 hover:bg-white/10"
                >Log in</button>
              )}
            </li>
          </ul>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 py-10" onDrop={onDropHandler} onDragOver={onDragOverHandler}>
        <section className="text-center">
          <FadeInUpH1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight text-white">
            Download from <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-purple-400 to-cyan-400">YouTube</span>, Facebook, TikTok, Instagram & SoundCloud
          </FadeInUpH1>
          <p className="mt-3 text-slate-300 max-w-xl mx-auto">
            Paste a link, pick your quality, and download. No sign-up, no watermark. Works on mobile and desktop.
          </p>

          <div className="mt-6">
            <div className="inline-flex flex-wrap items-center justify-center bg-white/5 border border-white/10 rounded-full p-1 gap-1">
              {PLATFORMS.map((p) => {
                const Icon = p.icon
                const isActive = active === p.key
                return (
                  <button
                    key={p.key}
                    onClick={() => setActive(p.key)}
                    className={clsx(
                      'inline-flex items-center gap-2 rounded-full px-3 sm:py-1.5 py-2 text-sm transition-all brand-focus hover:-translate-y-0.5',
                      isActive ? 'bg-white/10 text-white shadow-[0_0_0_3px] shadow-fuchsia-500/10' : 'text-slate-300 hover:bg-white/5'
                    )}
                  >
                    <Icon className={clsx('h-4 w-4', p.color)} />
                    <span className="font-medium">{p.label}</span>
                    {isActive && <BadgeCheck className="h-4 w-4 text-emerald-400" />}
                  </button>
                )
              })}
            </div>
          </div>

          <form id="analyze-form" onSubmit={onSubmit} className="mt-8 max-w-3xl mx-auto">
            <div className="relative bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-lg">
              <div className="absolute inset-0 pointer-events-none [mask-image:radial-gradient(50%_50%_at_50%_0%,rgba(255,255,255,.4),transparent_70%)] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,.08),transparent_40%)]" />
              <div className="relative p-3 md:p-4">
                <div className="text-left text-xs text-slate-400 px-1 pb-2">Source URL</div>
                <div className="flex flex-col md:flex-row gap-3 items-stretch">
                  <div className="flex-1 flex items-center gap-2 bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 brand-focus-within">
                    <LinkIcon className="h-4 w-4 text-slate-400" />
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      type="url"
                      aria-label="Source URL"
                      placeholder={`Paste ${PLATFORMS.find(p=>p.key===active)?.label} URL (https://...)`}
                      className="w-full bg-transparent outline-none placeholder:text-slate-500 text-slate-100"
                      inputMode="url"
                      enterKeyHint="go"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText()
                        if (text) setUrl(text)
                      } catch (e) {
                        setError('Clipboard permission denied')
                      }
                    }}
                    aria-label="Paste from clipboard"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-4 sm:py-2 py-2.5 text-sm font-medium border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 brand-focus transition-all hover:-translate-y-0.5 active:scale-95"
                  >
                    Paste
                  </button>
                  <button
                    type="submit"
                    aria-busy={loading}
                    className={clsx(
                      'inline-flex items-center justify-center gap-2 rounded-xl px-4 sm:py-2 py-2.5 font-medium transition-all brand-focus',
                      'bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-400 bg-[length:200%_200%] text-white shadow-lg hover:shadow-xl hover:shadow-fuchsia-500/30 hover:animate-gradient-x active:scale-95'
                    )}
                    disabled={loading}
                  >
                    {loading ? (<><Loader2 className="h-4 w-4 animate-spin"/> Analyzing...</>) : (<><Sparkles className="h-4 w-4"/> Analyze</>)}
                  </button>
                </div>
              </div>

              <div className="relative px-4 pb-4 text-left text-xs text-slate-400">
                <div className="flex items-center justify-between">
                  <Popover.Root>
                    <Popover.Trigger asChild>
                      <button type="button" className="inline-flex items-center gap-2 text-slate-300 hover:text-white brand-focus rounded px-2 py-1 transition-colors">
                        <Info className="h-3.5 w-3.5"/> Advanced
                      </button>
                    </Popover.Trigger>
                    <Popover.Content sideOffset={8} className="rounded-xl border border-white/10 bg-slate-900/90 backdrop-blur p-3 text-left text-xs text-slate-300 shadow-xl max-w-sm">
                      <div>For private/age-gated videos, add cookies on the server via <code className="px-1 rounded bg-white/10">AOI_COOKIEFILE</code> or base64 with <code className="px-1 rounded bg-white/10">AOI_COOKIES_BASE64</code>.</div>
                    </Popover.Content>
                  </Popover.Root>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setUrl('https://www.tiktok.com/@scout2015/video/6718335390845095173')} className="text-slate-300 hover:text-white underline/30 hover:underline brand-focus rounded px-1">Sample TikTok</button>
                    <button type="button" onClick={() => setUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')} className="text-slate-300 hover:text-white underline/30 hover:underline brand-focus rounded px-1">Sample YouTube</button>
                    <button type="button" onClick={() => setUrl('https://www.facebook.com/watch/?v=10153231379946729')} className="text-slate-300 hover:text-white underline/30 hover:underline brand-focus rounded px-1">Sample Facebook</button>
                  </div>
                </div>
              </div>
            </div>
          </form>

          {error && (
            <div className="mt-4 max-w-3xl mx-auto rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-left text-red-200" role="alert">
              <div className="font-medium">{error}</div>
              <ul className="mt-2 text-sm text-red-100/90 list-disc pl-6 space-y-1">
                {/(private|age|login)/i.test(error) && <li>Content may be private/age-gated. {cookiesOn ? 'Cookies are enabled.' : 'Add cookies to access restricted content.'}</li>}
                {/403|429|forbidden|quota|rate/i.test(error) && <li>Server may be blocked or rate-limited. Try again later or a different network.</li>}
                {/not found|format not/i.test(error) && <li>Try a different quality or format.</li>}
                <li>Ensure the link opens in your browser and is not behind a paywall.</li>
              </ul>
            </div>
          )}

          <div className="sr-only" aria-live="polite">{loading ? 'Analyzing URL…' : data ? 'Formats ready' : error ? `Error: ${error}` : ''}</div>
        </section>

        {data && (
          <section className="mt-10 grid gap-6 md:grid-cols-[2fr_3fr]">
            <FadeInUp className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <div className="text-sm uppercase tracking-wider text-slate-400 mb-2 inline-flex items-center gap-2"><Video className="h-4 w-4"/> Details</div>
                <h2 className="text-xl font-semibold text-white inline-flex items-center gap-2">
                  {(() => { const Icon = platformIconByExtractor(data.extractor); return <Icon className="h-5 w-5 opacity-80"/> })()}
                  {data.title || 'Untitled'}
                </h2>
                <div className="text-slate-400 text-sm mt-1">Duration: {formatDuration(data.duration)}</div>
              </div>
              {data.thumbnail && (
                <img src={data.thumbnail} className="w-full max-h-[320px] object-cover" alt="thumbnail" />
              )}
              <div className="p-4 text-left text-slate-400 text-sm">
                <div className="inline-flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-emerald-400"/> Extractor: {data.extractor}</div>
                <div className="mt-3">
                  {data.webpage_url && (
                    <a href={data.webpage_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200 hover:bg-white/10 brand-focus">
                      <ExternalLink className="h-4 w-4"/> Open source page
                    </a>
                  )}
                </div>
              </div>
            </FadeInUp>

            <FadeInUp className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="text-sm uppercase tracking-wider text-slate-400 inline-flex items-center gap-2"><Download className="h-4 w-4"/> Download Options</div>
                <div className="flex items-center gap-2">
                  <a
                    href={bestDownloadHref()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium bg-white/10 hover:bg-white/15 border border-white/10 text-white brand-focus"
                  >
                    <Download className="h-4 w-4"/> Best quality
                  </a>
                  <button onClick={() => { setUrl(data.webpage_url || ''); setData(null); setError(null); }} className="text-slate-300 hover:text-white inline-flex items-center gap-2 text-sm brand-focus rounded px-2 py-1">
                  <RefreshCw className="h-4 w-4"/> New link
                  </button>
                </div>
              </div>

              <div className="p-4">
                <Tabs.Root defaultValue={recommended.length > 0 ? 'rec' : 'video'}>
                  <Tabs.List className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1">
                    <Tabs.Trigger value="rec" className="px-3 py-1.5 rounded-full text-sm data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-300 hover:bg-white/5 brand-focus transition-colors disabled:opacity-50">
                      Recommended
                    </Tabs.Trigger>
                    <Tabs.Trigger value="video" className="px-3 py-1.5 rounded-full text-sm data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-300 hover:bg-white/5 brand-focus transition-colors">
                      Video
                    </Tabs.Trigger>
                    <Tabs.Trigger value="audio" className="px-3 py-1.5 rounded-full text-sm data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-300 hover:bg-white/5 brand-focus transition-colors">
                      Audio
                    </Tabs.Trigger>
                    {!!(data?.subtitles?.length) && (
                      <Tabs.Trigger value="subs" className="px-3 py-1.5 rounded-full text-sm data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-300 hover:bg-white/5 brand-focus transition-colors">
                        Subtitles
                      </Tabs.Trigger>
                    )}
                  </Tabs.List>

                  <div className="mt-4 grid gap-6">
                    <Tabs.Content value="rec">
                      {recommended.length > 0 ? (
                        <div className="grid gap-2">
                          {recommended.slice(0, 4).map((f) => (
                            <FormatRow key={`rec-${f.format_id}`} format={f} />
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">No recommended MP4 found. See other tabs.</div>
                      )}
                    </Tabs.Content>

                    <Tabs.Content value="video">
                      <div className="mb-3 flex items-center gap-2 text-xs text-slate-300">
                        <FilterIcon className="h-3.5 w-3.5"/>
                        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={prefs.onlyMp4} onChange={e => setPrefs(p => ({ ...p, onlyMp4: e.target.checked }))}/> Only MP4</label>
                        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={prefs.onlyMuxed} onChange={e => setPrefs(p => ({ ...p, onlyMuxed: e.target.checked }))}/> Only muxed</label>
                        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={prefs.hideStreaming} onChange={e => setPrefs(p => ({ ...p, hideStreaming: e.target.checked }))}/> Hide HLS/DASH</label>
                      </div>
                      <div className="grid gap-2 max-h-[300px] overflow-auto pr-1">
                        {videos.length === 0 ? (
                          <div className="text-slate-400 text-sm">No video formats found</div>
                        ) : (
                          filteredVideos.map((f) => (
                            <FormatRow key={`v-${f.format_id}`} format={f} />
                          ))
                        )}
                      </div>
                    </Tabs.Content>

                    <Tabs.Content value="audio">
                      <div className="mb-3 flex items-center gap-2 text-xs text-slate-300">
                        <FilterIcon className="h-3.5 w-3.5"/>
                        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={prefs.hideStreaming} onChange={e => setPrefs(p => ({ ...p, hideStreaming: e.target.checked }))}/> Hide HLS/DASH</label>
                      </div>
                      <div className="grid gap-2 max-h-[260px] overflow-auto pr-1">
                        {audios.length === 0 ? (
                          <div className="text-slate-400 text-sm">No audio formats found</div>
                        ) : (
                          filteredAudios.map((f) => (
                            <FormatRow key={`a-${f.format_id}`} format={f} />
                          ))
                        )}
                      </div>
                    </Tabs.Content>

                    <Tabs.Content value="subs">
                      {!(data?.subtitles?.length) ? (
                        <div className="text-slate-400 text-sm">No subtitles found</div>
                      ) : (
                        <div>
                          <div className="mb-3 flex items-center gap-2 text-xs text-slate-300">
                            <Languages className="h-3.5 w-3.5"/>
                            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showAutoSubs} onChange={e => setShowAutoSubs(e.target.checked)}/> Show auto-captions</label>
                          </div>
                          <div className="grid gap-2 max-h-[260px] overflow-auto pr-1">
                            {Object.entries(
                              (data.subtitles || []).filter(s => showAutoSubs ? true : !s.auto).reduce((acc: Record<string, { lang: string, tracks: { ext?: string | null, auto?: boolean }[] }>, s) => {
                                acc[s.lang] = acc[s.lang] || { lang: s.lang, tracks: [] }
                                acc[s.lang].tracks.push({ ext: s.ext, auto: s.auto })
                                return acc
                              }, {})
                            ).map(([lang, entry]) => (
                              <div key={lang} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-3 py-2">
                                <div className="text-sm text-white">{lang}</div>
                                <div className="flex flex-wrap gap-2">
                                  {entry.tracks.map((t, idx) => {
                                    const u = new URLSearchParams()
                                    const src = (window as any).__aoi_last_source as string | undefined
                                    if (src) {
                                      u.set('source', src)
                                      u.set('lang', lang)
                                      if (t.ext) u.set('ext', String(t.ext))
                                      if (t.auto) u.set('auto', '1')
                                    }
                                    const href = src ? `/api/subtitle?${u.toString()}` : undefined
                                    return (
                                      <a key={`${lang}-${t.ext || 'vtt'}-${idx}`} href={href} target="_blank" rel="noopener noreferrer" download className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium bg-white/10 hover:bg-white/15 border border-white/10 text-white brand-focus">
                                        <Download className="h-4 w-4"/> {(t.ext || 'vtt').toUpperCase()} {t.auto ? '(auto)' : ''}
                                      </a>
                                    )
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Tabs.Content>
                  </div>
                </Tabs.Root>
              </div>
            </FadeInUp>
          </section>
        )}

        {!data && !error && (
          <div className="mt-10 text-center text-sm text-slate-400">
            <div className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400"/>
              Supports direct downloads for most sites. For HLS/DASH, a compatible player/app may be required.
            </div>
            {!!historyItems.length && (
              <div className="mt-6 text-left max-w-3xl mx-auto">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 text-slate-300"><HistoryIcon className="h-4 w-4"/> Recent</div>
                  <button onClick={() => { setHistoryItems([]); localStorage.removeItem('aoi:history') }} className="text-xs text-slate-400 hover:text-slate-200">Clear</button>
                </div>
                <div className="mt-2 grid gap-2">
                  {historyItems.map((h, i) => (
                    <button key={`${h.url}-${i}`} onClick={() => { setUrl(h.url); setTimeout(() => { const form = document.getElementById('analyze-form') as HTMLFormElement | null; form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })) }, 10) }} className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/40 p-2 text-left hover:bg-slate-900/60">
                      {h.thumbnail ? (<img src={h.thumbnail} alt="thumb" className="h-10 w-16 object-cover rounded"/>) : (<div className="h-10 w-16 rounded bg-white/10" />)}
                      <div className="min-w-0">
                        <div className="truncate text-white text-sm">{h.title || h.url}</div>
                        <div className="text-xs text-slate-400">{new Date(h.at).toLocaleString()}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <section className="mt-12 text-center text-xs text-slate-500 pb-[env(safe-area-inset-bottom)]">
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

function FormatRow({ format }: { format: Format }) {
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
    // Use current analyzed URL as source
    const current = (window as any).__aoi_last_source as string | undefined
    if (current && format.format_id) {
      urlParams.set('source', current)
      urlParams.set('format_id', String(format.format_id))
      return `/api/download?${urlParams.toString()}`
    }
    return format.direct_url ?? undefined
  }, [format.format_id, format.direct_url])

  async function copyLink() {
    try {
      if (!proxyHref) return
      await navigator.clipboard.writeText(proxyHref)
    } catch {}
  }

  const mp3Href = useMemo(() => {
    const current = (window as any).__aoi_last_source as string | undefined
    if (!current) return undefined
    const params = new URLSearchParams()
    params.set('source', current)
    if (format.format_id) params.set('format_id', String(format.format_id))
    return `/api/convert_mp3?${params.toString()}`
  }, [format.format_id])

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-3 py-2 transition-all hover:-translate-y-0.5">
      <div className="flex items-center gap-3 min-w-0">
        <div className={clsx('h-9 w-9 grid place-items-center rounded-lg', isAudio ? 'bg-emerald-500/15' : isMuxed ? 'bg-cyan-500/15' : 'bg-purple-500/15')}>
          {isAudio ? <Music2 className="h-4 w-4 text-emerald-400"/> : isMuxed ? <PlayCircle className="h-4 w-4 text-cyan-400"/> : <Video className="h-4 w-4 text-purple-400"/>}
        </div>
        <div className="min-w-0">
          <div className="text-sm text-white truncate">{quality} {format.fps ? `${format.fps}fps` : ''} {format.ext ? `· ${format.ext}` : ''}</div>
          <div className="text-xs text-slate-400">{format.filesize_pretty ?? 'Size unknown'}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {protocolLabel && (
          <span className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-slate-400">{protocolLabel}</span>
        )}
        {proxyHref && (
          <a
            href={proxyHref}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium bg-white/10 hover:bg-white/15 border border-white/10 text-white brand-focus"
          >
            <Download className="h-4 w-4"/> Download
          </a>
        )}
        {proxyHref && (
          <button onClick={copyLink} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 brand-focus">
            <Copy className="h-3.5 w-3.5"/> Copy link
          </button>
        )}
        {isAudio && (
          <a href={mp3Href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 brand-focus">
            <Download className="h-3.5 w-3.5"/> MP3
          </a>
        )}
      </div>
    </div>
  )
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={clsx('animate-pulse rounded-md bg-white/10', className)} />
  )
}