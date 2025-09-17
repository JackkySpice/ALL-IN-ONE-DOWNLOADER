import React from 'react'
import clsx from 'clsx'

type PublicUser = {
  id: string
  email?: string | null
  guest: boolean
}

type Props = {
  open: boolean
  onClose: () => void
  onAuthSuccess: (user: PublicUser) => void
}

async function apiJson<T>(path: string, body?: any, method: string = 'POST'): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include'
  })
  if (!res.ok) {
    let msg = 'Request failed'
    try { const data = await res.json(); msg = (data as any)?.detail || msg } catch {}
    throw new Error(msg)
  }
  return res.json()
}

export default function AuthModal({ open, onClose, onAuthSuccess }: Props) {
  const [mode, setMode] = React.useState<'login' | 'signup'>('login')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const firstFieldRef = React.useRef<HTMLInputElement>(null)
  const lastFocusedElementRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!open) {
      setEmail('');
      setPassword('');
      setError(null)
      setMode('login')
    }
  }, [open])

  React.useEffect(() => {
    if (open) {
      lastFocusedElementRef.current = document.activeElement as HTMLElement | null
      const id = requestAnimationFrame(() => {
        if (firstFieldRef.current) {
          firstFieldRef.current.focus()
        } else {
          dialogRef.current?.focus()
        }
      })
      return () => cancelAnimationFrame(id)
    }
    const previouslyFocused = lastFocusedElementRef.current
    if (previouslyFocused) {
      const id = requestAnimationFrame(() => previouslyFocused.focus())
      return () => cancelAnimationFrame(id)
    }
  }, [open])

  if (!open) return null

  function onDialogKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape' && !e.defaultPrevented) {
      e.preventDefault()
      onClose()
    }
    if (e.key === 'Tab') {
      const container = contentRef.current
      if (!container) return
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) =>
        !el.hasAttribute('disabled') &&
        el.getAttribute('aria-hidden') !== 'true' &&
        !el.closest('[aria-hidden="true"]')
      )

      if (focusable.length === 0) {
        e.preventDefault()
        dialogRef.current?.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeEl = document.activeElement as HTMLElement | null

      if (e.shiftKey) {
        if (!activeEl || activeEl === first || !container.contains(activeEl)) {
          e.preventDefault()
          last.focus()
        }
      } else if (!activeEl || activeEl === last || !container.contains(activeEl)) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (loading) return
    setLoading(true)
    try {
      const path = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login'
      const user = await apiJson<PublicUser>(path, { email, password })
      onAuthSuccess(user)
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Auth failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleGuest() {
    setError(null)
    if (loading) return
    setLoading(true)
    try {
      const user = await apiJson<PublicUser>('/api/auth/guest')
      onAuthSuccess(user)
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Guest login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      tabIndex={-1}
      onKeyDown={onDialogKeyDown}
    >
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Decorative circles */}
      <div className="pointer-events-none absolute -top-16 left-0 sm:-left-10 h-40 w-40 sm:h-48 sm:w-48 rounded-full blur-3xl bg-gradient-to-br from-fuchsia-500/30 via-purple-500/30 to-cyan-400/30" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-16 right-0 sm:-right-10 h-40 w-40 sm:h-48 sm:w-48 rounded-full blur-3xl bg-gradient-to-tr from-cyan-400/30 via-purple-500/30 to-fuchsia-500/30" aria-hidden="true" />

      <div
        ref={contentRef}
        className="relative mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/90 p-5 shadow-2xl max-h-full overflow-y-auto"
      >
        <div className="text-center">
          <h2 id="auth-modal-title" className="text-2xl font-semibold text-white">Log in or sign up</h2>
          <div className="mt-2 inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1 text-xs">
            <button
              className={clsx('px-3 py-1 rounded-full transition-colors', mode === 'login' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white')}
              onClick={() => setMode('login')}
            >Login</button>
            <button
              className={clsx('px-3 py-1 rounded-full transition-colors', mode === 'signup' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white')}
              onClick={() => setMode('signup')}
            >Sign up</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
          <label htmlFor="auth-email" className="text-xs text-slate-400">Email address</label>
          <input
            ref={firstFieldRef}
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            placeholder="you@example.com"
          />
          <label htmlFor="auth-password" className="mt-2 text-xs text-slate-400">Password</label>
          <input
            id="auth-password"
            type="password"
            required
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            placeholder="••••••••"
          />
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-400 bg-[length:200%_200%] px-4 py-2 font-medium text-white shadow-lg hover:animate-gradient-x disabled:opacity-50"
          >{loading ? 'Please wait…' : (mode === 'signup' ? 'Create account' : 'Continue')}</button>
        </form>

        <div className="mt-4 text-center text-xs text-slate-400">OR</div>

        <div className="mt-3">
          <button
            type="button"
            onClick={handleGuest}
            disabled={loading}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10 disabled:opacity-50"
          >Continue as guest</button>
        </div>

        <div className="mt-4 text-center">
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
        </div>
      </div>
    </div>
  )
}

