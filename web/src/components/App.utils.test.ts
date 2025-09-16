import { describe, it, expect } from 'vitest'
import { formatDuration, normalizeInputUrl } from '../App'

describe('App utility functions', () => {
  describe('formatDuration', () => {
    it('returns an em dash for missing or zero values', () => {
      expect(formatDuration()).toBe('—')
      expect(formatDuration(0)).toBe('—')
    })

    it('formats values under an hour with leading minutes', () => {
      expect(formatDuration(59)).toBe('00:59')
      expect(formatDuration(65)).toBe('01:05')
    })

    it('includes hours when needed', () => {
      expect(formatDuration(3600)).toBe('1:00:00')
      expect(formatDuration(3665)).toBe('1:01:05')
    })
  })

  describe('normalizeInputUrl', () => {
    it('preserves valid http(s) urls', () => {
      expect(normalizeInputUrl('https://example.com/watch?v=123')).toBe('https://example.com/watch?v=123')
      expect(normalizeInputUrl('http://example.com/track')).toBe('http://example.com/track')
    })

    it('adds https:// for bare domains', () => {
      expect(normalizeInputUrl('example.com/video')).toBe('https://example.com/video')
      expect(normalizeInputUrl('WWW.YOUTUBE.COM/watch?v=abc')).toBe('https://www.youtube.com/watch?v=abc')
    })

    it('returns null for unsupported protocols or invalid urls', () => {
      expect(normalizeInputUrl('ftp://example.com/file')).toBeNull()
      expect(normalizeInputUrl('not a url')).toBeNull()
      expect(normalizeInputUrl('')).toBeNull()
    })
  })
})
