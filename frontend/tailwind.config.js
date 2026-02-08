/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
        screens: {
            'xs': '375px',  // Small phones (iPhone SE, etc.)
            'sm': '640px',  // Default small
            'md': '768px',  // Tablets
            'lg': '1024px', // Desktop
            'xl': '1280px',
            '2xl': '1536px'
        },
        extend: {
                fontFamily: {
                        'heading': ['Barlow Condensed', 'Impact', 'Arial Narrow', 'sans-serif'],
                        'body': ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
                        'mono': ['JetBrains Mono', 'monospace']
                },
                borderRadius: {
                        lg: 'var(--radius)',
                        md: 'calc(var(--radius) - 2px)',
                        sm: 'calc(var(--radius) - 4px)'
                },
                colors: {
                        // Cyber-Auction Protocol Theme
                        'acid': {
                                DEFAULT: '#D4FF00',
                                hover: '#E5FF4D',
                                glow: 'rgba(212, 255, 0, 0.5)'
                        },
                        'cyber': {
                                DEFAULT: '#00F0FF',
                                hover: '#4DFAFF',
                                glow: 'rgba(0, 240, 255, 0.5)'
                        },
                        'hot-pink': {
                                DEFAULT: '#FF0099',
                                hover: '#FF33B2',
                                glow: 'rgba(255, 0, 153, 0.5)'
                        },
                        'obsidian': {
                                DEFAULT: '#050505',
                                paper: '#0A0A0F',
                                subtle: '#12121A'
                        },
                        background: 'hsl(var(--background))',
                        foreground: 'hsl(var(--foreground))',
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
                boxShadow: {
                        'neon-acid': '0 0 20px rgba(212, 255, 0, 0.3), 0 0 40px rgba(212, 255, 0, 0.1)',
                        'neon-cyber': '0 0 20px rgba(0, 240, 255, 0.3), 0 0 40px rgba(0, 240, 255, 0.1)',
                        'neon-pink': '0 0 20px rgba(255, 0, 153, 0.3), 0 0 40px rgba(255, 0, 153, 0.1)',
                        'glass': '0 8px 32px rgba(0, 0, 0, 0.5)'
                },
                keyframes: {
                        'accordion-down': {
                                from: { height: '0' },
                                to: { height: 'var(--radix-accordion-content-height)' }
                        },
                        'accordion-up': {
                                from: { height: 'var(--radix-accordion-content-height)' },
                                to: { height: '0' }
                        },
                        'pulse-urgent': {
                                '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 59, 48, 0.7)' },
                                '50%': { boxShadow: '0 0 20px 10px rgba(255, 59, 48, 0.3)' }
                        },
                        'glow-pulse': {
                                '0%, 100%': { opacity: '1' },
                                '50%': { opacity: '0.5' }
                        },
                        'slide-up': {
                                '0%': { transform: 'translateY(20px)', opacity: '0' },
                                '100%': { transform: 'translateY(0)', opacity: '1' }
                        },
                        'border-flow': {
                                '0%': { backgroundPosition: '0% 50%' },
                                '50%': { backgroundPosition: '100% 50%' },
                                '100%': { backgroundPosition: '0% 50%' }
                        }
                },
                animation: {
                        'accordion-down': 'accordion-down 0.2s ease-out',
                        'accordion-up': 'accordion-up 0.2s ease-out',
                        'pulse-urgent': 'pulse-urgent 1s ease-in-out infinite',
                        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
                        'slide-up': 'slide-up 0.5s ease-out forwards',
                        'border-flow': 'border-flow 3s linear infinite'
                }
        }
  },
  plugins: [require("tailwindcss-animate")],
};