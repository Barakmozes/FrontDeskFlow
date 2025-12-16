// components/EntryFullscreenModal.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'

export default function EntryFullscreenModal() {
  const [show, setShow] = useState(false)

  // Show the modal once, on first mount
  useEffect(() => {
    setShow(true)
  }, [])

  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen()
    } catch (err) {
      console.error('Failed to enter fullscreen:', err)
    } finally {
      setShow(false)
    }
  }, [])

  if (!show) return null

  return (
    <div
      className="
        fixed inset-0
        bg-black bg-opacity-60
        flex items-center justify-center
        z-50
      "
    >
      <div
        className="
          bg-white rounded-2xl p-8
          max-w-sm w-full
          text-center
          shadow-lg
        "
      >
        <h2 className="text-2xl font-semibold mb-4">Welcome to StarManag!</h2>
        <p className="mb-6">
          For the best experience, please enter fullscreen mode.
        </p>
        <button
          onClick={enterFullscreen}
          className="
            px-6 py-3
            bg-blue-600 hover:bg-blue-700
            text-white font-medium
            rounded-lg
            transition
          "
        >
          Enter Fullscreen
        </button>
      </div>
    </div>
  )
}
