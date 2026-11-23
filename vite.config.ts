import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        'lucide-react',
        'sonner',
        'clsx',
        'tailwind-merge',
        'class-variance-authority',
        '@base-ui/react/button',
        '@base-ui/react/tooltip',
      ],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('/node_modules/firebase/') || id.includes('/node_modules/@firebase/')) {
              return 'vendor-firebase';
            }
            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/react-router/') ||
              id.includes('/node_modules/react-router-dom/') ||
              id.includes('/node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }
            if (
              id.includes('/node_modules/katex/') ||
              id.includes('/node_modules/rehype-') ||
              id.includes('/node_modules/remark-') ||
              id.includes('/node_modules/react-markdown/')
            ) {
              return 'vendor-math-md';
            }
            if (id.includes('/node_modules/recharts/') || id.includes('/node_modules/d3-')) {
              return 'vendor-charts';
            }
            if (id.includes('/node_modules/framer-motion/') || id.includes('/node_modules/motion/')) {
              return 'vendor-motion';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      warmup: {
        clientFiles: [
          './src/main.tsx',
          './src/index.css',
          './src/App.tsx',
          './src/firebase.ts',
          './src/contexts/AuthContext.tsx',
          './src/contexts/ThemeContext.tsx',
          './src/contexts/FluxContext.tsx',
          './src/components/ErrorBoundary.tsx',
          './src/components/MaintenanceGuard.tsx',
          './src/components/ProtectedRoute.tsx',
          './src/components/SystemStatus.tsx',
          './src/pages/Landing.tsx',
          './src/pages/Login.tsx',
        ],
      },
    },
  };
});
