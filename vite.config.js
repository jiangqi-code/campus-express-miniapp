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
          // uni-app 5.05 still invokes Sass through the legacy JS API.
          // Source styles already use the module system; silence only this upstream warning.
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
      host: '0.0.0.0',
      port: 3003,
      proxy: {
        '/api': {
          target: apiHost,
          changeOrigin: true,
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
