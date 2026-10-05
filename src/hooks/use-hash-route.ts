'use client'

import { useCallback, useEffect, useState } from 'react'

export type View = 'dashboard' | 'notes' | 'todos' | 'canvas' | 'settings' | 'guide' | 'widget'

const VALID: View[] = ['dashboard', 'notes', 'todos', 'canvas', 'settings', 'guide', 'widget']

export function parseHash(hash: string): { view: View; param: string | null } {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const raw = parts[0] ?? ''
  const view = (VALID as string[]).includes(raw) ? (raw as View) : 'dashboard'
  return { view, param: parts[1] ?? null }
}

export function useHashRoute() {
  const [hash, setHash] = useState('')

  useEffect(() => {
    const f = () => setHash(window.location.hash)
    f()
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])

  const navigate = useCallback((view: string, param?: string) => {
    window.location.hash = `#/${view}${param ? '/' + param : ''}`
  }, [])

  const parsed = parseHash(hash)
  return { ...parsed, navigate, rawHash: hash }
}
