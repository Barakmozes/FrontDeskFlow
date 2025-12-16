'use client'

import React, { useCallback, useState, useEffect } from 'react'

export default function FullscreenButton() {
  const [isFs, setIsFs] = useState(false)

  // Listen for fullscreen change events (in case the user hits Esc or F11)
  useEffect(() => {
    const handler = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .catch((err) => console.error('Fullscreen request failed:', err))
    } else {
      document.exitFullscreen().catch((err) => console.error('Exit fullscreen failed:', err))
    }
  }, [])

  return (
    <button
      onClick={toggleFullscreen}
      className={`
        px-4 py-2 rounded-lg shadow 
        ${isFs ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}
        text-white transition
      `}
    >
      {isFs ? 'Exit Fullscreen' : 'Enter Fullscreen'}
    </button>
  )
}
