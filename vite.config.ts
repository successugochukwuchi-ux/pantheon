import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
    },
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
      ],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('firebase')) return 'vendor-firebase';
            if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/')) return 'vendor-react';
            if (id.includes('katex') || id.includes('rehype-') || id.includes('remark-') || id.includes('react-markdown')) return 'vendor-math-md';
            if (id.includes('mathjs')) return 'vendor-mathjs';
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
            if (id.includes('framer-motion') || id.includes('/motion/')) return 'vendor-motion';
            if (id.includes('jspdf') || id.includes('xlsx') || id.includes('jszip') || id.includes('html2canvas')) return 'vendor-docs';
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
          './src/App.tsx',
          './src/contexts/AuthContext.tsx',
          './src/pages/Landing.tsx',
          './src/pages/Login.tsx',
          './src/pages/Dashboard.tsx',
        ],
      },
    },
  };
});
