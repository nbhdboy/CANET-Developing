/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'line': {
          light: '#00E000',
          DEFAULT: '#00C300',
          dark: '#00B300',
        },
        'gradient': {
          'primary': 'linear-gradient(135deg, #00E000 0%, #00C300 100%)',
          'secondary': 'linear-gradient(135deg, #00C300 0%, #00B300 100%)',
          'accent': 'linear-gradient(135deg, #00E000 0%, #00B300 100%)',
          'card': 'linear-gradient(135deg, rgba(0, 224, 0, 0.1) 0%, rgba(0, 195, 0, 0.1) 100%)',
          'button': 'linear-gradient(135deg, #00E000 0%, #00C300 100%)',
          'button-hover': 'linear-gradient(135deg, #00C300 0%, #00B300 100%)',
        }
      },
      backgroundImage: {
        'line-gradient': 'linear-gradient(135deg, #00E000 0%, #00C300 100%)',
        'line-gradient-hover': 'linear-gradient(135deg, #00C300 0%, #00B300 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(0, 224, 0, 0.1) 0%, rgba(0, 195, 0, 0.1) 100%)',
        'button-gradient': 'linear-gradient(135deg, #00E000 0%, #00C300 100%)',
        'button-gradient-hover': 'linear-gradient(135deg, #00C300 0%, #00B300 100%)',
      },
      boxShadow: {
        'card': '0 4px 20px rgba(180,180,180,0.18)',
        'button': '0 4px 15px rgba(0, 195, 0, 0.2)',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
};