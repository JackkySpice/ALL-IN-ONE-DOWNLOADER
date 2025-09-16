import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest'
import AuthModal from './AuthModal'

type FetchArgs = Parameters<typeof fetch>

function createFetchResponse<T>(data: T, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => data,
    text: async () => (typeof data === 'string' ? data : JSON.stringify(data)),
  } as unknown as Response
}

describe('AuthModal authentication flows', () => {
  const originalFetch = globalThis.fetch
  let fetchMock: ReturnType<typeof vi.fn<(input: FetchArgs[0], init?: FetchArgs[1]) => Promise<Response>>>

  beforeEach(() => {
    fetchMock = vi.fn<(input: FetchArgs[0], init?: FetchArgs[1]) => Promise<Response>>()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('logs in successfully and closes the modal', async () => {
    const onClose = vi.fn()
    const onAuthSuccess = vi.fn()
    const user = { id: 'user-1', email: 'user@example.com', guest: false }

    fetchMock.mockResolvedValue(createFetchResponse(user))

    render(<AuthModal open onClose={onClose} onAuthSuccess={onAuthSuccess} />)

    await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'user@example.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(onAuthSuccess).toHaveBeenCalledWith(user)
      expect(onClose).toHaveBeenCalled()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
      })
    )
  })

  it('switches to sign up mode and hits the signup endpoint', async () => {
    const onClose = vi.fn()
    const onAuthSuccess = vi.fn()
    const newUser = { id: 'user-2', email: 'new@example.com', guest: false }

    fetchMock.mockResolvedValue(createFetchResponse(newUser))

    render(<AuthModal open onClose={onClose} onAuthSuccess={onAuthSuccess} />)

    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }))
    await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'new@example.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'supersecure')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(onAuthSuccess).toHaveBeenCalledWith(newUser)
      expect(onClose).toHaveBeenCalled()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/signup',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'new@example.com', password: 'supersecure' }),
      })
    )
  })

  it('allows continuing as guest', async () => {
    const onClose = vi.fn()
    const onAuthSuccess = vi.fn()
    const guestUser = { id: 'guest-1', guest: true }

    fetchMock.mockResolvedValue(createFetchResponse(guestUser))

    render(<AuthModal open onClose={onClose} onAuthSuccess={onAuthSuccess} />)

    await userEvent.click(screen.getByRole('button', { name: 'Continue as guest' }))

    await waitFor(() => {
      expect(onAuthSuccess).toHaveBeenCalledWith(guestUser)
      expect(onClose).toHaveBeenCalled()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/guest',
      expect.objectContaining({ method: 'POST' })
    )
  })
})
