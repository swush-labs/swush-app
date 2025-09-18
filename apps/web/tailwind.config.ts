import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'var(--background)',
  			foreground: 'var(--foreground)',
        // Swush Flame Color Palette (inspired by the logo)
        flame: {
          50: '#FFF8E7',
          100: '#FFEFCC', 
          200: '#FFD89A',
          300: '#FFB627', // Warm amber from logo
          400: '#FF9500',
          500: '#FF6B35', // Primary flame orange from logo
          600: '#E55A2B',
          700: '#CC4A21',
          800: '#B33A17',
          900: '#992A0D',
        },
        forest: {
          50: '#F0FFFE',
          100: '#CCFFFE',
          200: '#99FFFB',
          300: '#4ECDC4', // Teal from logo
          400: '#45B7D1', // Turquoise from logo
          500: '#3BA99C',
          600: '#2C8F85',
          700: '#2C5F5D', // Deep teal from logo
          800: '#1A3A37', // Forest green from logo
          900: '#0F2922', // Mystical dark from logo
        },
        blackPearl: "#01151D",
        darkSlateGray: "#1F3041",
        bluishCyan: "#022029",
        burningOrange: "#FB6D3F",
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
		fontFamily: {
        	sans: ['var(--font-inter)'],
        	heading: ['var(--font-inter)', 'system-ui', 'sans-serif']
      },
      // Magical animations inspired by the flame character
      animation: {
        'flame-flicker': 'flameFlicker 3s ease-in-out infinite',
        'flame-pulse': 'flamePulse 2s ease-in-out infinite',
        'forest-sway': 'forestSway 4s ease-in-out infinite',
        'magical-glow': 'magicalGlow 2s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
        'ember-rise': 'emberRise 4s ease-out infinite',
      },
      keyframes: {
        flameFlicker: {
          '0%, 100%': { opacity: '1', transform: 'translateY(0px) scale(1)' },
          '25%': { opacity: '0.9', transform: 'translateY(-1px) scale(1.01)' },
          '50%': { opacity: '0.8', transform: 'translateY(-2px) scale(1.02)' },
          '75%': { opacity: '0.9', transform: 'translateY(-1px) scale(1.01)' },
        },
        flamePulse: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.05)' },
        },
        forestSway: {
          '0%, 100%': { transform: 'translateX(0px) rotate(0deg)' },
          '25%': { transform: 'translateX(1px) rotate(0.5deg)' },
          '50%': { transform: 'translateX(2px) rotate(1deg)' },
          '75%': { transform: 'translateX(1px) rotate(0.5deg)' },
        },
        magicalGlow: {
          '0%': { boxShadow: '0 0 5px rgba(255, 107, 53, 0.3), 0 0 10px rgba(255, 107, 53, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(255, 107, 53, 0.6), 0 0 30px rgba(255, 107, 53, 0.4)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '25%': { transform: 'translateY(-8px) translateX(2px)' },
          '50%': { transform: 'translateY(-12px) translateX(0px)' },
          '75%': { transform: 'translateY(-8px) translateX(-2px)' },
        },
        emberRise: {
          '0%': { transform: 'translateY(100px) scale(0)', opacity: '0' },
          '20%': { opacity: '1' },
          '80%': { opacity: '1' },
          '100%': { transform: 'translateY(-100px) scale(1)', opacity: '0' },
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
