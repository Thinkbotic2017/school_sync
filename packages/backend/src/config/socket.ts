import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from './env';
import { logger } from '../utils/logger';

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env['FRONTEND_URL'] ?? 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io',
  });

  // ── /attendance namespace ──────────────────────────────────────────────────
  // Clients connect to /attendance, authenticate via JWT in handshake.auth.token,
  // and are joined to a room keyed by their tenantId. This allows the server to
  // broadcast attendance events to only the users of a specific school.
  const attendanceNs = io.of('/attendance');

  attendanceNs.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }
    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
        tenantId: string;
        userId: string;
      };
      socket.data['tenantId'] = payload.tenantId;
      socket.data['userId'] = payload.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  attendanceNs.on('connection', (socket) => {
    const tenantId = socket.data['tenantId'] as string;
    void socket.join(tenantId);
    logger.info(`Socket connected: user=${socket.data['userId'] as string} tenant=${tenantId}`);

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: user=${socket.data['userId'] as string}`);
    });
  });

  logger.info('Socket.IO initialized');
  return io;
}

/**
 * Returns the initialized Socket.IO server instance.
 * Throws if initSocket() has not been called yet.
 */
export function getIo(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initSocket() first.');
  }
  return io;
}
