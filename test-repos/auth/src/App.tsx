import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'

// Mock auth API stubs:
// POST /api/auth/login - { email, password } => { token, user }
// POST /api/auth/register - { email, password, name } => { token, user }
// GET /api/auth/me - (Authorization: Bearer <token>) => { user }
// POST /api/auth/logout - (Authorization: Bearer <token>) => { success: true }

function Login() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Login</h1>
      <p className="mt-4 text-gray-600">Login page placeholder.</p>
      <Link to="/register" className="text-blue-500 underline mt-2 block">Go to Register</Link>
    </div>
  )
}

function Register() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Register</h1>
      <p className="mt-4 text-gray-600">Register page placeholder.</p>
      <Link to="/login" className="text-blue-500 underline mt-2 block">Go to Login</Link>
    </div>
  )
}

function Dashboard() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-4 text-gray-600">Protected dashboard placeholder.</p>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <nav className="p-4 bg-gray-100 flex gap-4">
        <Link to="/login" className="text-blue-500">Login</Link>
        <Link to="/register" className="text-blue-500">Register</Link>
        <Link to="/dashboard" className="text-blue-500">Dashboard</Link>
      </nav>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/" element={<Login />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
