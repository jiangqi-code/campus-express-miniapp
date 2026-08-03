import { defineConfig, loadEnv } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiHost = env.VITE_API_HOST || 'http://localhost:3000'

  const staticPathList = [
    '/upload',
    '/uploads',
    '/static',
    '/files',
    '/media',
    '/images',
    '/storage',
    '/public',
    '/assets',
  ]

  const staticProxy = {}
  staticPathList.forEach((p) => {
    staticProxy[p] = {
      target: apiHost,
      changeOrigin: true,
    }
  })

  return {
    plugins: [uni()],
    css: {
      preprocessorOptions: {
        scss: {
          silenceDeprecations: ['legacy-js-api'],
        },
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      host: '127.0.0.1',
      port: 3003,
      strictPort: true,
      hmr: {
        host: 'localhost',
        clientPort: 3003,
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true
        },
        '/socket.io': {
          target: apiHost,
          changeOrigin: true,
          ws: true,
        },
        ...staticProxy,
      }
    }
  }
})