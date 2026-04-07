import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#EBF2FE',
          100: '#D6E4FD',
          200: '#ADC9FB',
          300: '#85AEF9',
          400: '#5C93F7',
          500: '#3180F7',
          600: '#1A68E0',
          700: '#1352B5',
          800: '#0D3D8A',
          900: '#07275E',
        },
        surface: {
          50:  '#FAFBFC',
          100: '#F4F6F8',
          200: '#E9ECF0',
        },
        pudding: {
          gold: '#FFD700',
          silver: '#C0C0C0',
          bronze: '#CD7F32',
        },
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      screens: {
        'xs': '375px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1440px',
      },
      boxShadow: {
        'card':       '0 1px 4px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.03)',
        'card-hover': '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
        'float':      '0 20px 60px -15px rgba(49,128,247,0.12)',
        'nav':        '0 -1px 20px rgba(0,0,0,0.03)',
        'top-nav':    '0 1px 20px rgba(0,0,0,0.03)',
        'bezel':      'inset 0 1px 1px rgba(255,255,255,0.6), 0 1px 3px rgba(0,0,0,0.04)',
        'bezel-hover':'inset 0 1px 1px rgba(255,255,255,0.8), 0 8px 30px rgba(0,0,0,0.08)',
        'glow':       '0 0 30px rgba(49,128,247,0.15)',
        'ambient':    '0 20px 60px -15px rgba(0,0,0,0.05)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '24px',
        '5xl': '2rem',
      },
      animation: {
        'fade-in':   'fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up':  'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in':  'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'float':     'float 6s ease-in-out infinite',
        'review-fade': 'reviewFade 0.4s ease-out forwards',
      },
      keyframes: {
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(1.5rem)', filter: 'blur(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(2rem)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-15px)' },
        },
        reviewFade: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
