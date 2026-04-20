/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Manrope"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        cream: {
          50: '#FDFBF6',
          100: '#FAF8F3',
          200: '#F4EFE4',
          300: '#EAE4D9',
        },
        ink: {
          900: '#171512',
          700: '#2F2A24',
          600: '#57524C',
          500: '#6B655E',
          400: '#8B8680',
          300: '#A8A29A',
        },
        rust: {
          50: '#FAEDE7',
          100: '#F3D5C7',
          200: '#E4A98E',
          400: '#D47757',
          500: '#C65D3B',
          600: '#A84A2C',
          700: '#853820',
        },
        forest: {
          50: '#E8EFEB',
          400: '#4F7C66',
          500: '#2F5743',
          600: '#234433',
        },
        amber: {
          500: '#C8932F',
          600: '#A87924',
        },
        brick: {
          500: '#A83D2F',
          600: '#8A2F23',
        },
        steel: {
          500: '#3A6B8A',
          600: '#2D5470',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(23, 21, 18, 0.04), 0 1px 3px 0 rgba(23, 21, 18, 0.06)',
        float: '0 4px 16px -2px rgba(23, 21, 18, 0.08), 0 2px 6px -1px rgba(23, 21, 18, 0.06)',
        sheet: '0 -8px 32px -4px rgba(23, 21, 18, 0.12)',
      },
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.24s cubic-bezier(0.32, 0.72, 0, 1)',
        'fade-in': 'fade-in 0.18s ease-out',
        'scale-in': 'scale-in 0.16s cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
}
