import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // convex-test needs the edge-runtime environment to accurately emulate
    // Convex's server runtime (crypto, fetch, etc.); individual React-hook
    // test files opt back into jsdom via a `@vitest-environment jsdom` pragma.
    environment: 'edge-runtime',
    server: { deps: { inline: ['convex-test'] } },
  },
})
