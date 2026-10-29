import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import handler from './api/analyze'

function apiAnalyzePlugin(): Plugin {
  return {
    name: 'api-analyze-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/analyze' && req.method === 'POST') {
          try {
            await handler(req, res);
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Internal Server Error: ' + String(err) }));
          }
          return;
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), apiAnalyzePlugin()],
})


