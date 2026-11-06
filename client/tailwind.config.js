export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ["Arial", "Segoe UI", "Noto Sans", "Helvetica Neue", "sans-serif"],
                primary: ["Arial", "Noto Sans", "Helvetica Neue", "sans-serif"],
                secondary: ["Segoe UI", "Arial", "Noto Sans", "sans-serif"],
                logo: ["Pacifico", "cursive"],
                ai: ["Bebas Neue", "sans-serif"],
            },
            fontSize: {
                'xs': '0.875rem',    // 14px (was 12px)
                'sm': '1rem',        // 16px (was 14px)
                'base': '1.125rem',  // 18px (was 16px)
                'lg': '1.25rem',     // 20px (was 18px)
                'xl': '1.5rem',      // 24px (was 20px)
                '2xl': '1.875rem',   // 30px (was 24px)
                '3xl': '2.25rem',    // 36px (was 30px)
                '4xl': '3rem',       // 48px (was 36px)
                '5xl': '3.75rem',    // 60px (was 48px)
            },
            fontWeight: {
                'black': '700',      // Map black to bold
                'bold': '600',       // Map bold to semibold
                'semibold': '500',   // Map semibold to medium
                'medium': '500',     // Keep medium at 500
            }
        },
    },
    plugins: [],
}
