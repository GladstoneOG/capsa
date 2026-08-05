import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import express from 'express'
import path from 'path'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-stickers',
      configureServer(server) {
        const stickersDir = path.resolve(__dirname, 'stickers');
        server.middlewares.use('/stickers', express.static(stickersDir));
        server.middlewares.use('/api/stickers', (req, res) => {
          fs.readdir(stickersDir, (err, files) => {
            if (err) {
              res.statusCode = 500;
              return res.end(JSON.stringify([]));
            }
            const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
            const stickerUrls = files
              .filter(file => validExtensions.includes(path.extname(file).toLowerCase()))
              .map(file => `/stickers/${file}`);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(stickerUrls));
          });
        });
      }
    }
  ],
  server: {
    fs: {
      allow: ['.', 'stickers']
    }
  }
})
