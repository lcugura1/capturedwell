import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  // Vite resolves the ~/* alias from tsconfig natively; no plugin needed.
  resolve: { tsconfigPaths: true },
  build: {
    // The design is photography-first; keep an eye on the JS we ship
    // alongside it. Admin code is dynamically imported and excluded.
    chunkSizeWarningLimit: 150,
  },
})
