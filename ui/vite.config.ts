import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    define: {'process.env': {}},
    optimizeDeps: {include: ['buffer']},
    server: {
        port: 5173,
        proxy: {
            '/api': {target: 'http://localhost:8082', changeOrigin: true},
            '/api.json': {target: 'http://localhost:8082', changeOrigin: true},
        },
    },
})
