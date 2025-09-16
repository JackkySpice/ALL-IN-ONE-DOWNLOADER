import clsx from 'clsx'
import React from 'react'

import { SURFACE_TONES } from '../../design/tokens'

type SurfaceTone = keyof typeof SURFACE_TONES

type SurfaceBorder = 'subtle' | 'strong' | 'none'
type SurfacePadding = 'none' | 'xs' | 'sm' | 'md' | 'lg'
type SurfaceShadow = 'none' | 'glow'

type SurfaceProps<T extends React.ElementType = 'div'> = {
  as?: T
  tone?: SurfaceTone
  border?: SurfaceBorder
  padding?: SurfacePadding
  shadow?: SurfaceShadow
  interactive?: boolean
  className?: string
  children: React.ReactNode
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'children'>

type SurfaceComponent = <T extends React.ElementType = 'div'>(
  props: SurfaceProps<T> & { ref?: React.ComponentPropsWithRef<T>['ref'] }
) => React.ReactElement | null

const borderStyles: Record<SurfaceBorder, string> = {
  subtle: 'border border-[color:var(--aoi-colors-border-subtle)]',
  strong: 'border border-[color:var(--aoi-colors-border-strong)]',
  none: '',
}

const paddingStyles: Record<SurfacePadding, string> = {
  none: 'p-0',
  xs: 'p-2',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

const shadowStyles: Record<SurfaceShadow, string> = {
  none: '',
  glow: 'shadow-[var(--aoi-shadow-glow)]',
}

export const Surface: SurfaceComponent = React.forwardRef(
  <T extends React.ElementType = 'div'>(
    {
      as,
      tone = 'raised',
      border = 'subtle',
      padding = 'md',
      shadow = 'none',
      interactive = false,
      className,
      children,
      ...rest
    }: SurfaceProps<T>,
    forwardedRef: React.Ref<Element>
  ) => {
    const Component = (as ?? 'div') as React.ElementType

    const classes = clsx(
      'rounded-[var(--aoi-radii-surface)] backdrop-blur-[var(--aoi-effects-backdrop-blur)]',
      SURFACE_TONES[tone],
      borderStyles[border],
      paddingStyles[padding],
      shadowStyles[shadow],
      interactive && 'transition-transform duration-200 ease-out hover:-translate-y-0.5',
      'focus-ring-within',
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
) as SurfaceComponent

Surface.displayName = 'Surface'
