import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ChipToggle } from './ChipToggle'

describe('ChipToggle component', () => {
  it('renders the provided label and optional icon', () => {
    render(
      <ChipToggle checked={false} onCheckedChange={() => {}} icon={<span data-testid="icon">★</span>}>
        Option label
      </ChipToggle>
    )

    expect(screen.getByText('Option label')).toBeInTheDocument()
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()
  })

  it('toggles the checkbox and calls the change handler', async () => {
    const onCheckedChange = vi.fn()
    render(
      <ChipToggle checked={false} onCheckedChange={onCheckedChange}>
        Notify me
      </ChipToggle>
    )

    const checkbox = screen.getByRole('checkbox')
    await userEvent.click(checkbox)
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('applies the checked styles when active', () => {
    render(
      <ChipToggle checked onCheckedChange={() => {}}>
        Enabled option
      </ChipToggle>
    )

    const text = screen.getByText('Enabled option')
    const chip = text.parentElement
    if (!chip) {
      throw new Error('Chip container not found')
    }
    expect(chip).toHaveClass('shadow-inner')
    expect(chip).toHaveClass('bg-[color:var(--aoi-colors-surface-strong)]')
  })
})
