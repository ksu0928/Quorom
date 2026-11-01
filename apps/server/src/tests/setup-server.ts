import { httpServer } from '../server.js';

// The server module starts listening on import. If another instance (dev
// server or a previous vitest worker) already owns the port, reuse it
// instead of crashing the test run.
httpServer.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') return;
  throw error;
});
