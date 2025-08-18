import React, { useMemo, useState } from 'react'
import { Download, Music2, PlayCircle, Youtube, Instagram, Facebook, Music, BadgeCheck, Link as LinkIcon, Loader2, Crown, ShieldCheck, Video, Waves, Sparkles, RefreshCw, Info, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'

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
}

type ExtractResponse = {
  id?: string
  title?: string
  thumbnail?: string
  duration?: number
  webpage_url?: string
  extractor?: string
  formats: Format[]
}

async function extract(url: string): Promise<ExtractResponse> {
  const res = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Extraction failed')
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

export default function App() {
  const [active, setActive] = useState(PLATFORMS[0].key)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ExtractResponse | null>(null)

  const recommended = useMemo(() => {
    if (!data) return [] as Format[]
    // Prefer muxed MP4 with highest resolution
    return data.formats.filter(f => (f.vcodec && f.acodec && f.vcodec !== 'none' && f.acodec !== 'none') && f.ext === 'mp4')
  }, [data])

  const videos = useMemo(() => {
    if (!data) return [] as Format[]
    return data.formats.filter(f => !f.is_audio_only)
  }, [data])

  const audios = useMemo(() => {
    if (!data) return [] as Format[]
    return data.formats.filter(f => f.is_audio_only)
  }, [data])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setData(null)
    if (!url.trim()) {
      setError('Please paste a valid URL')
      return
    }
    setLoading(true)
    try {
      const src = url.trim()
      const res = await extract(src)
      ;(window as any).__aoi_last_source = src
      setData(res)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to extract')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900" />
      <div className="absolute inset-0 bg-grid opacity-[0.35]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-80 w-[40rem] rounded-full blur-3xl bg-gradient-to-r from-fuchsia-500/20 via-purple-500/20 to-cyan-400/20" />

      <header className="relative z-10 sticky top-0 backdrop-blur border-b border-white/10 bg-slate-950/70">
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
          <div className="hidden md:flex items-center gap-4 text-slate-300 text-sm">
            <div className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400"/> Secure</div>
            <div className="inline-flex items-center gap-2"><Waves className="h-4 w-4 text-cyan-400"/> No ads</div>
            <div className="inline-flex items-center gap-2"><Crown className="h-4 w-4 text-amber-400"/> Free</div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 py-10">
        <section className="text-center">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white">
            Download from <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-purple-400 to-cyan-400">YouTube</span>, Facebook, TikTok, Instagram & SoundCloud
          </h1>
          <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
            Paste a link, pick your quality, and download. No sign-up, no watermark. Works on mobile and desktop.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {PLATFORMS.map((p) => {
              const Icon = p.icon
              return (
                <button
                  key={p.key}
                  onClick={() => setActive(p.key)}
                  className={clsx(
                    'group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all',
                    active === p.key
                      ? 'border-fuchsia-500/50 bg-fuchsia-500/10 text-white shadow-[0_0_0_3px] shadow-fuchsia-500/10'
                      : 'border-white/10 text-slate-300 hover:border-white/20 hover:bg-white/5'
                  )}
                >
                  <Icon className={clsx('h-4 w-4', p.color)} />
                  <span className="font-medium">{p.label}</span>
                  {active === p.key && <BadgeCheck className="h-4 w-4 text-emerald-400" />}
                </button>
              )
            })}
          </div>

          <form onSubmit={onSubmit} className="mt-8 max-w-3xl mx-auto">
            <div className="relative bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-lg">
              <div className="absolute inset-0 pointer-events-none [mask-image:radial-gradient(50%_50%_at_50%_0%,rgba(255,255,255,.4),transparent_70%)] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,.08),transparent_40%)]" />
              <div className="relative p-3 md:p-4 flex flex-col md:flex-row gap-3 items-stretch">
                <div className="flex-1 flex items-center gap-2 bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 focus-within:border-fuchsia-500/50">
                  <LinkIcon className="h-4 w-4 text-slate-400" />
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={`Paste ${PLATFORMS.find(p=>p.key===active)?.label} URL (https://...)`}
                    className="w-full bg-transparent outline-none placeholder:text-slate-500 text-slate-100"
                  />
                </div>
                <button
                  type="submit"
                  className={clsx(
                    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-medium transition-all',
                    'bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-400 text-white shadow-lg hover:shadow-xl hover:shadow-fuchsia-500/30'
                  )}
                  disabled={loading}
                >
                  {loading ? (<><Loader2 className="h-4 w-4 animate-spin"/> Analyzing...</>) : (<><Sparkles className="h-4 w-4"/> Analyze</>)}
                </button>
              </div>

              <div className="relative px-4 pb-4 text-left text-xs text-slate-400">
                <div className="inline-flex items-center gap-2"><Info className="h-3.5 w-3.5"/> Tip: For private/age-gated videos, add cookies on the server via <code className="px-1 rounded bg-white/10">AOI_COOKIEFILE</code> or base64 with <code className="px-1 rounded bg-white/10">AOI_COOKIES_BASE64</code>.</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setUrl('https://www.tiktok.com/@scout2015/video/6718335390845095173')} className="text-slate-300 hover:text-white underline/30 hover:underline">Sample TikTok</button>
                  <button type="button" onClick={() => setUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')} className="text-slate-300 hover:text-white underline/30 hover:underline">Sample YouTube</button>
                  <button type="button" onClick={() => setUrl('https://www.facebook.com/watch/?v=10153231379946729')} className="text-slate-300 hover:text-white underline/30 hover:underline">Sample Facebook</button>
                </div>
              </div>
            </div>
          </form>

          {error && (
            <div className="mt-4 max-w-3xl mx-auto rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-left text-red-200">
              {error}
            </div>
          )}
        </section>

        {data && (
          <section className="mt-10 grid gap-6 md:grid-cols-[2fr_3fr]">
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <div className="text-sm uppercase tracking-wider text-slate-400 mb-2 inline-flex items-center gap-2"><Video className="h-4 w-4"/> Details</div>
                <h2 className="text-xl font-semibold text-white">{data.title || 'Untitled'}</h2>
                <div className="text-slate-400 text-sm mt-1">Duration: {formatDuration(data.duration)}</div>
              </div>
              {data.thumbnail && (
                <img src={data.thumbnail} className="w-full max-h-[320px] object-cover" alt="thumbnail" />
              )}
              <div className="p-4 text-left text-slate-400 text-sm">
                <div className="inline-flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-emerald-400"/> Extractor: {data.extractor}</div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="text-sm uppercase tracking-wider text-slate-400 inline-flex items-center gap-2"><Download className="h-4 w-4"/> Download Options</div>
                <button onClick={() => { setUrl(data.webpage_url || ''); setData(null); setError(null); }} className="text-slate-300 hover:text-white inline-flex items-center gap-2 text-sm">
                  <RefreshCw className="h-4 w-4"/> New link
                </button>
              </div>

              <div className="p-4 grid gap-6">
                {recommended.length > 0 && (
                  <div>
                    <div className="text-slate-300 text-sm mb-2 inline-flex items-center gap-2"><Crown className="h-4 w-4 text-amber-400"/> Recommended</div>
                    <div className="grid gap-2">
                      {recommended.slice(0, 4).map((f) => (
                        <FormatRow key={`rec-${f.format_id}`} format={f} />
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-slate-300 text-sm mb-2 inline-flex items-center gap-2"><PlayCircle className="h-4 w-4 text-cyan-400"/> Video</div>
                  <div className="grid gap-2 max-h-[300px] overflow-auto pr-1">
                    {videos.map((f) => (
                      <FormatRow key={`v-${f.format_id}`} format={f} />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-slate-300 text-sm mb-2 inline-flex items-center gap-2"><Music2 className="h-4 w-4 text-emerald-400"/> Audio</div>
                  <div className="grid gap-2 max-h-[260px] overflow-auto pr-1">
                    {audios.map((f) => (
                      <FormatRow key={`a-${f.format_id}`} format={f} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {!data && !error && (
          <div className="mt-10 text-center text-sm text-slate-400">
            <div className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400"/>
              Supports direct downloads for most sites. For HLS/DASH, a compatible player/app may be required.
            </div>
          </div>
        )}

        <section className="mt-12 text-center text-xs text-slate-500">
          <p>
            Always respect each service's Terms of Service and copyright. Use this tool only for content you own rights to or have permission to download.
          </p>
        </section>
      </main>
    </div>
  )
}

function FormatRow({ format }: { format: Format }) {
  const quality = format.resolution ?? (format.audio_bitrate ? `${format.audio_bitrate}kbps` : '—')
  const isMuxed = format.vcodec && format.acodec && format.vcodec !== 'none' && format.acodec !== 'none'
  const isAudio = format.is_audio_only

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

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-3 py-2">
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
        {proxyHref && (
          <a
            href={proxyHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium bg-white/10 hover:bg-white/15 border border-white/10 text-white"
          >
            <Download className="h-4 w-4"/> Download
          </a>
        )}
      </div>
    </div>
  )
}