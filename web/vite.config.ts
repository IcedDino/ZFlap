import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { contributorsPlugin } from './plugins/contributors'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // The landing page's contributor list is read from git history at build
    // time; `repo` only enriches it with GitHub logins and avatars.
    contributorsPlugin({ repo: 'IcedDino/ZFlap' }),
  ],
  server: {
    port: 5190,
    strictPort: true,
  },
})
