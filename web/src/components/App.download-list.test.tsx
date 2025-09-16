import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { FormatRow, type Format } from '../App'

describe('FormatRow download list rendering', () => {
  const baseFormat: Format = {
    format_id: '137',
    ext: 'mp4',
    resolution: '1080p',
    fps: 60,
    is_audio_only: false,
    vcodec: 'avc1',
    acodec: 'mp4a',
    filesize_pretty: '20 MB',
  }

  const originalClipboard = navigator.clipboard

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        configurable: true,
      })
    } else {
      Reflect.deleteProperty(navigator, 'clipboard')
    }
  })

  it('renders key download details for muxed formats', () => {
    render(<FormatRow format={baseFormat} source="https://example.com/video" />)

    expect(screen.getByText('1080p 60fps · mp4')).toBeInTheDocument()

    const downloadLink = screen.getByRole('link', { name: 'Download' })
    expect(downloadLink.getAttribute('href')).toContain('/api/download?')
    expect(downloadLink.getAttribute('href')).toContain('format_id=137')
    expect(downloadLink.getAttribute('href')).toContain('source=https%3A%2F%2Fexample.com%2Fvideo')

    expect(screen.queryByRole('link', { name: 'MP3' })).not.toBeInTheDocument()
  })

  it('shows streaming protocol labels and mp3 conversion for audio formats', () => {
    const audioFormat: Format = {
      format_id: '140',
      ext: 'm4a',
      is_audio_only: true,
      audio_bitrate: 128,
      filesize_pretty: '4 MB',
      protocol: 'm3u8',
      acodec: 'mp4a',
      vcodec: 'none',
    }

    render(<FormatRow format={audioFormat} source="https://example.com/song" />)

    expect(screen.getByText('HLS')).toBeInTheDocument()
    const mp3Link = screen.getByRole('link', { name: /mp3/i })
    expect(mp3Link.getAttribute('href')).toContain('/api/convert_mp3?')
    expect(mp3Link.getAttribute('href')).toContain('source=https%3A%2F%2Fexample.com%2Fsong')
  })

  it('copies the proxy download url to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(<FormatRow format={baseFormat} source="https://example.com/video" />)

    const copyButton = screen.getByRole('button', { name: /copy/i })
    await userEvent.click(copyButton)

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText.mock.calls[0][0]).toContain('/api/download?')
    expect(writeText.mock.calls[0][0]).toContain('format_id=137')
    expect(await screen.findByText('Copied!')).toBeInTheDocument()
  })
})
