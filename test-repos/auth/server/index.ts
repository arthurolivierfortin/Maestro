import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

// Mock user database
const users = [
  { id: 1, email: 'admin@example.com', password: 'password123', name: 'Admin User' },
]

// Mock JWT token generator
function generateToken(userId: number) {
  return `mock-jwt-token-${userId}-${Date.now()}`
}

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body
  const user = users.find(u => u.email === email && u.password === password)
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }
  res.json({ token: generateToken(user.id), user: { id: user.id, email: user.email, name: user.name } })
})

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body
  if (users.find(u => u.email === email)) {
    res.status(409).json({ error: 'Email already exists' })
    return
  }
  const newUser = { id: users.length + 1, email, password, name }
  users.push(newUser)
  res.status(201).json({ token: generateToken(newUser.id), user: { id: newUser.id, email, name } })
})

app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  // Mock: extract user id from token
  res.json({ id: 1, email: 'admin@example.com', name: 'Admin User' })
})

app.post('/api/auth/logout', (_req, res) => {
  res.json({ message: 'Logged out' })
})

app.listen(PORT, () => {
  console.log(`Auth server running on http://localhost:${PORT}`)
})
