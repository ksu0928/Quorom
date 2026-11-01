import { io } from 'socket.io-client'

const socket = io('http://localhost:3001', { transports: ['websocket'] })
socket.onAny((ev, ...args) => {
  if (ev === 'room:state') console.log('EV room:state phase=', args[0]?.phase, 'participants=', args[0]?.participants?.length)
  else console.log('EV', ev)
})
socket.on('connect', () => {
  console.log('connected', socket.id)
  socket.emit('room:create', { title: 'Probe', name: 'A' }, (r) => {
    console.log('ACK', r && r.code ? r.code : JSON.stringify(r))
    setTimeout(() => {
      console.log('--- now registering room:state listener and waiting for join-broadcast style event ---')
      socket.on('room:state', () => console.log('LATE room:state received'))
    }, 500)
  })
})
socket.on('connect_error', (e) => console.log('CONNECT_ERROR', e.message))
setTimeout(() => process.exit(0), 4000)
