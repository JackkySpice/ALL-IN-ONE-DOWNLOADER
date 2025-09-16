import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest'
import App from './App'

type FetchArgs = Parameters<typeof fetch>

function createFetchResponse<T>(data: T, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => data,
    text: async () => (typeof data === 'string' ? data : JSON.stringify(data)),
  } as unknown as Response
}

describe('App', () => {
  const originalFetch = globalThis.fetch
  let fetchMock: ReturnType<typeof vi.fn<(input: FetchArgs[0], init?: FetchArgs[1]) => Promise<Response>>>

  beforeEach(() => {
    fetchMock = vi.fn<(input: FetchArgs[0], init?: FetchArgs[1]) => Promise<Response>>()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    localStorage.clear()
    sessionStorage.clear()
    ;(window as any).__aoi_last_source = undefined
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('shows a validation error when submitting an empty form', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(createFetchResponse({}, false)))

    render(<App />)
    const analyzeButton = await screen.findByRole('button', { name: /analyze/i })

    await userEvent.click(analyzeButton)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/please paste a valid url/i)
    expect(fetchMock).not.toHaveBeenCalledWith('/api/extract', expect.anything())
  })

  it('submits a valid URL and shows download options', async () => {
    const videoResponse = {
      title: 'Sample Title',
      extractor: 'YouTube',
      duration: 95,
      formats: [
        {
          format_id: '137',
          ext: 'mp4',
          resolution: '1080p',
          fps: 30,
          filesize_pretty: '20 MB',
          is_audio_only: false,
          vcodec: 'avc1',
          acodec: 'mp4a',
        },
        {
          format_id: '140',
          ext: 'm4a',
          audio_bitrate: 128,
          filesize_pretty: '4 MB',
          is_audio_only: true,
          vcodec: 'none',
          acodec: 'mp4a',
        },
      ],
    }

    fetchMock.mockImplementation((input: FetchArgs[0]) => {
      if (typeof input === 'string' && input.includes('/api/extract')) {
        return Promise.resolve(createFetchResponse(videoResponse))
      }
      return Promise.resolve(createFetchResponse({}, false))
    })

    render(<App />)

    const urlInput = await screen.findByPlaceholderText(/paste youtube url/i)
    await userEvent.type(urlInput, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')

    await userEvent.click(screen.getByRole('button', { name: /analyze/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/extract',
        expect.objectContaining({
          body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
          method: 'POST',
        })
      )
    })

    expect(await screen.findByText('Sample Title')).toBeInTheDocument()
    expect(screen.getByText(/download options/i)).toBeInTheDocument()
    expect(screen.getByText(/1080p/i)).toBeInTheDocument()
  })
})
