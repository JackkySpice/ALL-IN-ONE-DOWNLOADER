import React from 'react'

export function FadeInUp({ children, className }: { children: React.ReactNode, className?: string }) {
  const [M, setM] = React.useState<any>(null)
  React.useEffect(() => {
    let mounted = true
    import('framer-motion').then(mod => { if (mounted) setM(mod) })
    return () => { mounted = false }
  }, [])
  if (!M) return <div className={className}>{children}</div>
  const MotionDiv = M.motion.div
  return (
    <MotionDiv initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className={className}>
      {children}
    </MotionDiv>
  )
}

export function FadeInUpH1({ children, className }: { children: React.ReactNode, className?: string }) {
  const [M, setM] = React.useState<any>(null)
  React.useEffect(() => {
    let mounted = true
    import('framer-motion').then(mod => { if (mounted) setM(mod) })
    return () => { mounted = false }
  }, [])
  if (!M) return <h1 className={className}>{children}</h1>
  const MotionH1 = M.motion.h1
  return (
    <MotionH1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className={className}>
      {children}
    </MotionH1>
  )
}
