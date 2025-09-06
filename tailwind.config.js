/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{html,ts}",
  ],
  // Dark mode only - no theme switching needed
  theme: {
    extend: {
      colors: {
        // OpAuto Professional Color Palette
        primary: {
          50: '#eff6ff',   // Very light blue
          100: '#dbeafe',  // Light blue
          200: '#bfdbfe',  // Soft blue
          300: '#93c5fd',  // Medium light blue
          400: '#60a5fa',  // Medium blue
          500: '#2563eb',  // Main primary blue
          600: '#1d4ed8',  // Darker blue
          700: '#1e40af',  // Deep blue
          800: '#1e3a8a',  // Very deep blue
          900: '#1a365d',  // Darkest blue
          950: '#0f172a',  // Almost black blue
        },
        secondary: {
          50: '#fffbeb',   // Very light amber
          100: '#fef3c7',  // Light amber
          200: '#fde68a',  // Soft amber
          300: '#fcd34d',  // Medium light amber
          400: '#fbbf24',  // Medium amber
          500: '#f59e0b',  // Main secondary amber
          600: '#d97706',  // Darker amber
          700: '#b45309',  // Deep amber
          800: '#92400e',  // Very deep amber
          900: '#78350f',  // Darkest amber
          950: '#451a03',  // Almost black amber
        },
        // Enhanced grays for better contrast
        gray: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // Status colors that work well in both modes
        success: {
          500: '#22c55e',  // Green
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          500: '#eab308',  // Yellow
          600: '#ca8a04',
          700: '#a16207',
        },
        error: {
          500: '#ef4444',  // Red
          600: '#dc2626',
          700: '#b91c1c',
        },
        // Special automotive colors
        automotive: {
          steel: '#71717a',      // Steel gray
          chrome: '#a1a1aa',     // Chrome silver
          carbon: '#18181b',     // Carbon black
          electric: '#06b6d4',   // Electric cyan
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      }
    },
  },
  plugins: [],
}
