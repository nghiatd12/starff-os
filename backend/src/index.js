import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { roleRoom } from './socketRooms.js'

// Routes
import authRoutes from './routes/auth.js'
import tablesRoutes from './routes/tables.js'
import menuRoutes from './routes/menu.js'
import ordersRoutes from './routes/orders.js'
import publicRoutes from './routes/public.js'
import adminRoutes from './routes/admin.js'
import staffRoutes from './routes/staff.js'
import dashboardRoutes from './routes/dashboard.js'

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

io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next()

  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET)
  } catch (err) {
    console.warn(`[Socket] Invalid token for ${socket.id}: ${err.message}`)
  }
  next()
})

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
app.use('/api/dashboard', dashboardRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Socket.IO events
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`)

  // Join room theo role (kitchen, waiter, cashier)
  socket.on('join-role', (role) => {
    const tenantId = socket.user?.tenantId
    if (!tenantId) {
      console.warn(`[Socket] ${socket.id} cannot join ${role}: missing tenant`)
      return
    }

    const room = roleRoom(tenantId, role)
    socket.join(room)
    console.log(`[Socket] ${socket.id} joined room: ${room}`)
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
