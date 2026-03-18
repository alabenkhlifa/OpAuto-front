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
          50: '#FFF5EB',   // Very light orange
          100: '#FFE4C4',  // Light orange
          200: '#FFCA8A',  // Soft orange
          300: '#FFa033',  // Medium light orange
          400: '#FF8400',  // Main primary orange
          500: '#E67700',  // Darker orange
          600: '#CC6A00',  // Deep orange
          700: '#B35C00',  // Very deep orange
          800: '#994F00',  // Darkest orange
          900: '#804200',  // Almost black orange
          950: '#663500',  // Deepest orange
        },
        secondary: {
          50: '#F0F3FB',   // Very light vista bleu
          100: '#DCE3F4',  // Light vista bleu
          200: '#C4CFEC',  // Soft vista bleu
          300: '#A3B4E6',  // Medium light vista bleu
          400: '#8FA0D8',  // Main secondary vista bleu
          500: '#7B8CC4',  // Darker vista bleu
          600: '#6778B0',  // Deep vista bleu
          700: '#53649C',  // Very deep vista bleu
          800: '#3F5088',  // Darkest vista bleu
          900: '#2B3C74',  // Almost black vista bleu
          950: '#172860',  // Deepest vista bleu
        },
        accent: {
          50: '#FEFAF5',   // Very light amande
          100: '#FDF0E0',  // Light amande
          200: '#F9DFC6',  // Main amande
          300: '#F5CFA8',  // Darker amande
          400: '#F1BF8A',  // Deep amande
        },
        // Enhanced grays for Bleu Oxford palette
        gray: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#2A2566',
          700: '#1C1852',
          800: '#120F3D',
          900: '#0B0829',
          950: '#060518',
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
