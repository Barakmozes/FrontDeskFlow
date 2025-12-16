// components/home/ModernWaveHeading.tsx
import React from 'react'

export default function ModernWaveHeading() {
  const text = 'On the Menu'

  return (
    <h2 className="text-4xl sm:text-5xl font-serif font-bold text-black inline-block text-shadow-modern ">
      {Array.from(text).map((char, idx) => (
        <span
          key={idx}
          className="inline-block opacity-0 animate-wave-letters"
          style={{ animationDelay: `${idx * 100}ms` }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </h2>
  )
}
