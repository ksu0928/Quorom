import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@quorum/shared';
import { setupSocketHandlers } from './socket/handlers.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

/**
 * Create Express app
 */
const app = express();
const httpServer = createServer(app);

/**
 * Configure Socket.IO with CORS
 */
const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
  },
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 16 * 1024, // 16 KB
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * Setup Socket.IO event handlers
 */
setupSocketHandlers(io);

/**
 * Start server
 */
httpServer.listen(PORT, () => {
  console.log(`Quorum server listening on port ${PORT}`);
  console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { io, app, httpServer };
