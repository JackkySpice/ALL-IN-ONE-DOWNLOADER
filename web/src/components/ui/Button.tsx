import clsx from 'clsx'
import React from 'react'

import { BRAND_GRADIENT_CLASS } from '../../design/tokens'

type ButtonVariant = 'primary' | 'surface' | 'soft' | 'ghost' | 'outline'
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'
type ButtonShape = 'rounded' | 'pill'

type ButtonProps<T extends React.ElementType = 'button'> = {
  as?: T
  variant?: ButtonVariant
  size?: ButtonSize
  shape?: ButtonShape
  iconOnly?: boolean
  fullWidth?: boolean
  className?: string
  children: React.ReactNode
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'children'>

type ButtonComponent = <T extends React.ElementType = 'button'>(
  props: ButtonProps<T> & { ref?: React.ComponentPropsWithRef<T>['ref'] }
) => React.ReactElement | null

const variantStyles: Record<ButtonVariant, string> = {
  primary: clsx(
    'text-white shadow-lg shadow-fuchsia-500/20 hover:shadow-fuchsia-500/40',
    'bg-[length:200%_200%] hover:animate-gradient-x'
  ),
  surface: 'border border-[color:var(--aoi-colors-border-strong)] bg-[color:var(--aoi-colors-surface-strong)] text-[color:var(--aoi-colors-text-primary)] hover:bg-[color:var(--aoi-colors-surface-strong)]/90',
  soft: 'border border-[color:var(--aoi-colors-border-subtle)] bg-[color:var(--aoi-colors-surface-muted)] text-[color:var(--aoi-colors-text-secondary)] hover:bg-[color:var(--aoi-colors-surface-muted)]/90 hover:text-[color:var(--aoi-colors-text-primary)]',
  ghost: 'border border-transparent bg-transparent text-[color:var(--aoi-colors-text-secondary)] hover:bg-[color:var(--aoi-colors-surface-muted)]/50 hover:text-[color:var(--aoi-colors-text-primary)]',
  outline: 'border border-[color:var(--aoi-colors-border-subtle)] bg-transparent text-[color:var(--aoi-colors-text-primary)] hover:bg-[color:var(--aoi-colors-surface-muted)]',
}

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'text-[13px] px-2.5 py-1 h-8',
  sm: 'text-sm px-3 py-1.5 h-9',
  md: 'text-sm px-4 py-2 h-10',
  lg: 'text-base px-5 py-2.5 h-11',
}

const iconOnlyStyles: Record<ButtonSize, string> = {
  xs: 'px-0 py-0 h-8 w-8',
  sm: 'px-0 py-0 h-9 w-9',
  md: 'px-0 py-0 h-10 w-10',
  lg: 'px-0 py-0 h-11 w-11',
}

const shapeStyles: Record<ButtonShape, string> = {
  rounded: 'rounded-[var(--aoi-radii-control)]',
  pill: 'rounded-[var(--aoi-radii-pill)]',
}

export const Button: ButtonComponent = React.forwardRef(
  <T extends React.ElementType = 'button'>(
    {
      as,
      variant = 'soft',
      size = 'sm',
      shape = 'rounded',
      iconOnly = false,
      fullWidth = false,
      className,
      children,
      ...rest
    }: ButtonProps<T>,
    forwardedRef: React.Ref<Element>
  ) => {
    const Component = (as ?? 'button') as React.ElementType

    const classes = clsx(
      'focus-ring inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 ease-out',
      'disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-px',
      shapeStyles[shape],
      iconOnly ? iconOnlyStyles[size] : sizeStyles[size],
      iconOnly && 'gap-0',
      fullWidth && 'w-full',
      variantStyles[variant],
      variant === 'primary' && BRAND_GRADIENT_CLASS,
      className,
    )

    const finalProps: Record<string, unknown> = {
      ...rest,
      className: classes,
      ref: forwardedRef,
    }

    if (Component === 'button' && finalProps.type == null) {
      finalProps.type = 'button'
    }

    return React.createElement(Component, finalProps, children)
  }
) as ButtonComponent

Button.displayName = 'Button'
