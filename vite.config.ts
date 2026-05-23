import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  base: "/jv/", // for gh-pages deployment
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'vendor';
            if (id.includes('@monaco-editor/react')) return 'editor';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('jsonpath-plus') || id.includes('lz-string') || id.includes('cmdk')) return 'utils';
            return 'modules';
          }
        }
      }
    }
  }
})
