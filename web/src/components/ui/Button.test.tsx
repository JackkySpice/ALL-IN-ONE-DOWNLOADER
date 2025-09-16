import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Button } from './Button'

describe('Button component', () => {
  it('renders a button element with default props', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button', { name: 'Click me' })
    expect(button.tagName).toBe('BUTTON')
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveClass('rounded-[var(--aoi-radii-control)]')
  })

  it('supports rendering as a different element', () => {
    render(
      <Button as="a" href="/docs" variant="surface">
        Read docs
      </Button>
    )
    const link = screen.getByRole('link', { name: 'Read docs' })
    expect(link.tagName).toBe('A')
    expect(link).not.toHaveAttribute('type')
    expect(link).toHaveAttribute('href', '/docs')
  })

  it('applies variant, shape, fullWidth and iconOnly styles', () => {
    render(
      <Button
        variant="primary"
        shape="pill"
        fullWidth
        iconOnly
        size="sm"
        aria-label="Open menu"
      >
        <span aria-hidden="true">☰</span>
      </Button>
    )
    const button = screen.getByRole('button', { name: 'Open menu' })
    expect(button).toHaveClass('bg-[linear-gradient(110deg,_var(--aoi-brand-start),_var(--aoi-brand-mid),_var(--aoi-brand-end))]')
    expect(button).toHaveClass('bg-[length:200%_200%]')
    expect(button).toHaveClass('rounded-[var(--aoi-radii-pill)]')
    expect(button).toHaveClass('w-full')
    expect(button).toHaveClass('w-9')
    expect(button).toHaveClass('gap-0')
  })
})
