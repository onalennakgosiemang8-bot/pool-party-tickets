import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        abyss: '#04182B',      // dark navy — contrast
        ocean: '#073B63',      // deep ocean blue
        deep: '#0B2E4F',
        pool: '#1FA8E0',       // bright pool blue
        aqua: '#7FE3E8',       // soft aqua
        foam: '#F2FAFF',       // white / foam
        gold: '#D8B15E',       // subtle gold accent
        goldlite: '#EFD8A0',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl2: '1.75rem', xl3: '2.5rem' },
      boxShadow: {
        glass: '0 24px 60px -28px rgba(4,24,43,0.75)',
        gold: '0 0 0 1px rgba(216,177,94,0.35), 0 18px 40px -24px rgba(216,177,94,0.5)',
      },
      keyframes: {
        ripple: {
          '0%': { transform: 'scale(0.6)', opacity: '0.55' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        drift: {
          '0%,100%': { transform: 'translate3d(0,0,0) rotate(0deg)' },
          '50%': { transform: 'translate3d(0,-14px,0) rotate(2.5deg)' },
        },
        surface: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        rise: { '0%': { transform: 'translateY(18px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: {
        ripple: 'ripple 4.5s ease-out infinite',
        drift: 'drift 11s ease-in-out infinite',
        surface: 'surface 14s linear infinite',
        rise: 'rise .7s cubic-bezier(.2,.7,.2,1) both',
      },
    },
  },
  plugins: [],
};
export default config;
