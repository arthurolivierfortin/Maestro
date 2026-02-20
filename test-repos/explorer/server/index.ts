import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

app.get('/api/files', (_req, res) => {
  res.json({
    name: 'project-root',
    type: 'folder',
    children: [
      {
        name: 'src',
        type: 'folder',
        children: [
          {
            name: 'components',
            type: 'folder',
            children: [
              { name: 'Header.tsx', type: 'file', size: 2048 },
              { name: 'Footer.tsx', type: 'file', size: 1024 },
              { name: 'Sidebar.tsx', type: 'file', size: 3072 },
            ],
          },
          {
            name: 'hooks',
            type: 'folder',
            children: [
              { name: 'useAuth.ts', type: 'file', size: 512 },
              { name: 'useTheme.ts', type: 'file', size: 256 },
            ],
          },
          { name: 'App.tsx', type: 'file', size: 4096 },
          { name: 'main.tsx', type: 'file', size: 256 },
          { name: 'index.css', type: 'file', size: 1024 },
        ],
      },
      {
        name: 'public',
        type: 'folder',
        children: [
          { name: 'favicon.ico', type: 'file', size: 4096 },
          { name: 'robots.txt', type: 'file', size: 128 },
        ],
      },
      { name: 'package.json', type: 'file', size: 512 },
      { name: 'tsconfig.json', type: 'file', size: 256 },
      { name: 'vite.config.ts', type: 'file', size: 128 },
      { name: 'README.md', type: 'file', size: 2048 },
      { name: '.gitignore', type: 'file', size: 64 },
    ],
  })
})

app.listen(PORT, () => {
  console.log(`Explorer server running on http://localhost:${PORT}`)
})
