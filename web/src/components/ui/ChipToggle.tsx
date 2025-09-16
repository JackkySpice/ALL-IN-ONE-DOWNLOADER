import clsx from 'clsx'
import React from 'react'

type ChipToggleProps = {
  checked: boolean
  onCheckedChange: (value: boolean) => void
  children: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

export function ChipToggle({ checked, onCheckedChange, children, icon, className }: ChipToggleProps) {
  return (
    <label className={clsx('inline-flex cursor-pointer select-none', className)}>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      <span
        className={clsx(
          'inline-flex items-center gap-2 rounded-[var(--aoi-radii-pill)] border px-3 py-1.5 text-xs font-medium transition-colors duration-150 ease-out',
          'peer-focus-visible:[box-shadow:var(--aoi-focus-ring)]',
          checked
            ? 'border-[color:var(--aoi-colors-border-strong)] bg-[color:var(--aoi-colors-surface-strong)] text-[color:var(--aoi-colors-text-primary)] shadow-inner'
            : 'border-[color:var(--aoi-colors-border-subtle)] bg-[color:var(--aoi-colors-surface-muted)] text-[color:var(--aoi-colors-text-secondary)] hover:text-[color:var(--aoi-colors-text-primary)]',
        )}
      >
        {icon}
        <span>{children}</span>
      </span>
    </label>
  )
}
