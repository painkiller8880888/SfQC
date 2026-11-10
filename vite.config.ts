import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  const preview = mode === 'sfqc-preview'
  return {
    base: preview ? '/SfQC/preview/' : '/SfQC/',
    plugins: [react()],
    ...(preview ? { build: { outDir: 'dist/preview', emptyOutDir: false } } : {}),
  }
})
