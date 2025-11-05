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
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			flame: {
  				'50': '#FFF8E7',
  				'100': '#FFEFCC',
  				'200': '#FFD89A',
  				'300': '#FFB627',
  				'400': '#FF9500',
  				'500': '#FF6B35',
  				'600': '#E55A2B',
  				'700': '#CC4A21',
  				'800': '#B33A17',
  				'900': '#992A0D'
  			},
  			forest: {
  				'50': '#F0FFFE',
  				'100': '#CCFFFE',
  				'200': '#99FFFB',
  				'300': '#4ECDC4',
  				'400': '#45B7D1',
  				'500': '#3BA99C',
  				'600': '#2C8F85',
  				'700': '#2C5F5D',
  				'800': '#1A3A37',
  				'900': '#0F2922'
  			},
			"baltic-sea": "#242C32",
			"black-eel": "#434343",
  			blackPearl: '#01151D',
  			"dark-slate-gray": '#1F3041',
  			bluishCyan: '#022029',
			"blueberry-blue": "#0147B4",
  			"blue-whale": '#003843',
  			"burning-orange": '#FB6D3F',
  			cadmiumOrange: '#FF7F1D',
			cloud: "#C8C5C5",
  			creole: '#1C0902',
  			davyGray: '#545456',
			"faded-orange": "#E5993D",
  			greyBlue: '#6C86AD',
  			midnight: '#011F2A',
			myrtle: "#2F461D",
			"prussian-blue": "#013954",
			"tealish-green": "#01E17B",
			tune: "#303746",
  			woodsmoke: '#0A0B0D',
  			zinwallditeBrown: '#2F1005',
			"black-wallet-fill": '#001219',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		fontFamily: {
  			sans: [
  				'var(--font-inter)'
  			],
  			heading: [
  				'var(--font-inter)',
  				'system-ui',
  				'sans-serif'
  			]
  		},
  		animation: {
  			'flame-flicker': 'flameFlicker 3s ease-in-out infinite',
  			'flame-pulse': 'flamePulse 2s ease-in-out infinite',
  			'forest-sway': 'forestSway 4s ease-in-out infinite',
  			'magical-glow': 'magicalGlow 2s ease-in-out infinite alternate',
  			float: 'float 6s ease-in-out infinite',
  			'ember-rise': 'emberRise 4s ease-out infinite'
  		},
  		keyframes: {
  			flameFlicker: {
  				'0%, 100%': {
  					opacity: '1',
  					transform: 'translateY(0px) scale(1)'
  				},
  				'25%': {
  					opacity: '0.9',
  					transform: 'translateY(-1px) scale(1.01)'
  				},
  				'50%': {
  					opacity: '0.8',
  					transform: 'translateY(-2px) scale(1.02)'
  				},
  				'75%': {
  					opacity: '0.9',
  					transform: 'translateY(-1px) scale(1.01)'
  				}
  			},
  			flamePulse: {
  				'0%, 100%': {
  					opacity: '0.6',
  					transform: 'scale(1)'
  				},
  				'50%': {
  					opacity: '0.9',
  					transform: 'scale(1.05)'
  				}
  			},
  			forestSway: {
  				'0%, 100%': {
  					transform: 'translateX(0px) rotate(0deg)'
  				},
  				'25%': {
  					transform: 'translateX(1px) rotate(0.5deg)'
  				},
  				'50%': {
  					transform: 'translateX(2px) rotate(1deg)'
  				},
  				'75%': {
  					transform: 'translateX(1px) rotate(0.5deg)'
  				}
  			},
  			magicalGlow: {
  				'0%': {
  					boxShadow: '0 0 5px rgba(255, 107, 53, 0.3), 0 0 10px rgba(255, 107, 53, 0.2)'
  				},
  				'100%': {
  					boxShadow: '0 0 20px rgba(255, 107, 53, 0.6), 0 0 30px rgba(255, 107, 53, 0.4)'
  				}
  			},
  			float: {
  				'0%, 100%': {
  					transform: 'translateY(0px) translateX(0px)'
  				},
  				'25%': {
  					transform: 'translateY(-8px) translateX(2px)'
  				},
  				'50%': {
  					transform: 'translateY(-12px) translateX(0px)'
  				},
  				'75%': {
  					transform: 'translateY(-8px) translateX(-2px)'
  				}
  			},
  			emberRise: {
  				'0%': {
  					transform: 'translateY(100px) scale(0)',
  					opacity: '0'
  				},
  				'20%': {
  					opacity: '1'
  				},
  				'80%': {
  					opacity: '1'
  				},
  				'100%': {
  					transform: 'translateY(-100px) scale(1)',
  					opacity: '0'
  				}
  			}
  		},
		screens: {
			short: { raw: '(min-height: 400px)' },
			tall: { raw: '(min-height: 720px)' },
			grande: { raw: '(min-height: 800px)' },
			venti: { raw: '(min-height: 801px)' },
		},
  		backdropBlur: {
  			xs: '2px'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
