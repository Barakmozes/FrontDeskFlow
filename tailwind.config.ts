// tailwind.config.ts
import plugin from 'tailwindcss/plugin'
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
          // ← your existing gradients
          backgroundImage: {
            'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
            'gradient-conic':
              'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
          },
          keyframes: {
            wave: {
              '0%':   { transform: 'translateY(100%)', opacity: '0' },
              '10%':  { transform: 'translateY(-10%)', opacity: '1' },
              '30%':  { transform: 'translateY(0)',     opacity: '1' },
              '100%': { transform: 'translateY(0)',     opacity: '1' },
            },
          },
          animation: {
            'wave-letters': 'wave 6s ease-in-out infinite',
          },
        },
      },
      plugins: [
        plugin(function ({ addUtilities }) {
          addUtilities({
            '.text-shadow-modern': {
              textShadow:
                '0 -1px 4px #FFF, 0 -2px 10px #ff0, 0 -10px 20px #ff8000, 0 -18px 40px #F00',
            },
          })
        }),
      ],
    }
    
    export default config