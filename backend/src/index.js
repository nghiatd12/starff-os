import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'

// Routes
import authRoutes from './routes/auth.js'
import tablesRoutes from './routes/tables.js'
import menuRoutes from './routes/menu.js'
import ordersRoutes from './routes/orders.js'
import publicRoutes from './routes/public.js'
import adminRoutes from './routes/admin.js'
import staffRoutes from './routes/staff.js'

const app = express()
const httpServer = createServer(app)

// Danh sách origins được phép — hỗ trợ nhiều domain (local + Vercel)
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((o) => o.trim())
for (const origin of [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'https://admin-tau-tawny.vercel.app',
]) {
  if (!allowedOrigins.includes(origin)) allowedOrigins.push(origin)
}
if (process.env.ADMIN_DASHBOARD_URL) {
  for (const origin of process.env.ADMIN_DASHBOARD_URL.split(',').map((o) => o.trim()).filter(Boolean)) {
    if (!allowedOrigins.includes(origin)) allowedOrigins.push(origin)
  }
}

const corsOptions = {
  origin: (origin, callback) => {
    // Cho phép requests không có origin (mobile app, curl, Postman)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true,
}

// Socket.IO — realtime cho KDS
const io = new Server(httpServer, { cors: corsOptions })

// Middleware
app.use(cors(corsOptions))
app.use(express.json())

// Gắn io vào request để routes có thể emit events
app.set('io', io)

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/tables', tablesRoutes)
app.use('/api/menu', menuRoutes)
app.use('/api/orders', ordersRoutes)
app.use('/api/public', publicRoutes) // Public routes — không cần auth (QR menu khách)
app.use('/api/admin', adminRoutes)
app.use('/api/staff', staffRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Socket.IO events
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`)

  // Join room theo role (kitchen, waiter, cashier)
  socket.on('join-role', (role) => {
    socket.join(role)
    console.log(`[Socket] ${socket.id} joined room: ${role}`)
  })

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`)
  })
})

// Start server
const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`\n🚀 StaffOS Backend running on http://localhost:${PORT}`)
  console.log(`📡 Socket.IO ready`)
  console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}\n`)
})

export { io }
