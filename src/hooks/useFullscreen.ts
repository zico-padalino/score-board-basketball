import { useCallback, useEffect, useState, type RefObject } from 'react'

export function useFullscreen(targetRef?: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        const el = targetRef?.current ?? document.documentElement
        await el.requestFullscreen()
      }
    } catch {
      /* browser may block without user gesture */
    }
  }, [targetRef])

  return { isFullscreen, toggle }
}
