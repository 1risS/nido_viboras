// ── Servidor de sincronización con el operador ───────────
// Dos tipos de cliente se conectan:
//   - 'headset': cada visor Quest, corre index.html
//   - 'operator' : el panel de control (control.html), lo abre el staff 
//                  en la laptop/PC para ver quién está listo y disparar
//                  el inicio para todos a la vez.
// ──  Flujo ───────────
// 1. Cada headset se registra y avisa cuando el usuario tocó "Comenzar"
//    ('ready'). El servidor le avisa a los operadores conectados el
//    estado actual de todos los cascos ('headsets-state').
// 2. El operador, aprieta "Iniciar para todos" en su panel
//    dispara 'operator-start'. El servidor calcula un timestamp de
//    arranque unos segundos en el futuro y se lo manda a TODOS los
//    cascos ('go'), sin importar si estaban "listos" o no
//    La decisión de cuándo arrancar es del operador, no es automática.
// 3. Si un casco se conecta/reconecta después de que ya arrancó, recibe
//    'catchup' con la posición actual para ponerse al día solo.

const express = require('express')
const http = require('http')
const path = require('path')
const { Server } = require('socket.io')

const PORT = process.env.PORT || 3001
const START_BUFFER_MS = 3000 // margen entre "Iniciar" y el arranque real

const app = express()
app.use(express.static(path.join(__dirname))) // sirve /control.html

const server = http.createServer(app)

const io = new Server(server, {
  cors: { origin: '*' },
  methods: ['GET', 'POST']
})

const headsets = new Map()
let startAt = null

function headsetsList() {
  return Array.from(headsets.entries()).map(([id, info]) => ({
    id,
    ready: info.ready
  }))
}

function broadcastHeadsetsState() {
  io.to('operators').emit('headsets-state', {
    headsets: headsetsList(),
    started: startAt !== null
  })
}

io.on('connection', socket => {
  socket.on('register', role => {
    socket.data.role = role

    if (role === 'headset') {
      socket.join('headsets')
      headsets.set(socket.id, { ready: false })
      console.log(`[casco conectado] ${socket.id} (${headsets.size} total)`)
      broadcastHeadsetsState()

      if (startAt) socket.emit('catchup', { startAt })
    } else if (role === 'operator') {
      socket.join('operators')
      console.log(`[operador conectado] ${socket.id}`)
      socket.emit('headsets-state', { headsets: headsetsList(), started: startAt !== null })
    }
  })

  socket.on('ready', () => {
    if (!headsets.has(socket.id)) return
    headsets.get(socket.id).ready = true
    console.log(`[casco listo] ${socket.id}`)
    broadcastHeadsetsState()
  })

  socket.on('operator-start', () => {
    if (socket.data.role !== 'operator') return
    startAt = Date.now() + START_BUFFER_MS
    console.log(`[INICIO disparado por operador] startAt=${startAt}`)
    io.to('headsets').emit('go', { startAt })
    broadcastHeadsetsState()
  })

  socket.on('operator-reset', () => {
    if (socket.data.role !== 'operator') return
    startAt = null
    headsets.forEach(info => (info.ready = false))
    io.to('headsets').emit('reset-ack')
    broadcastHeadsetsState()
    console.log('[reset] sesión reiniciada por operador')
  })

  socket.on('disconnect', () => {
    if (socket.data.role === 'headset') {
      headsets.delete(socket.id)
      console.log(`[casco desconectado] ${socket.id} (${headsets.size} total)`)
      broadcastHeadsetsState()
    }
  })
})

server.listen(PORT, () => {
  console.log(`Sync server escuchando en puerto ${PORT}`)
  console.log(`Panel de control disponible en /control.html`)
})