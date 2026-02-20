import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
})

const PORT = 3001

app.use(cors())
app.use(express.json())

app.get('/api/notifications', (_req, res) => {
  res.json([
    { id: 1, message: 'Welcome!', read: false, createdAt: new Date().toISOString() },
  ])
})

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  socket.on('subscribe', (channel: string) => {
    socket.join(channel)
    console.log(`Socket ${socket.id} joined channel: ${channel}`)
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
