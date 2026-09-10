import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Honour a port handed to us by the environment. Other services on this machine also default
    // to Vite's 5173, so hardcoding it means whichever starts second silently fails to bind.
    port: Number(process.env.PORT) || 5173,
  },
})
