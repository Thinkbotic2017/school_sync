import { Queue, Worker } from 'bullmq';
import { env } from './env';
import { logger } from '../utils/logger';

// Parse host and port from REDIS_URL (e.g. redis://localhost:6379)
// BullMQ requires {host, port} — it does not accept a URL string directly.
function parseRedisUrl(url: string): { host: string; port: number } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '6379', 10),
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

const redisConnection = parseRedisUrl(env.REDIS_URL);

// ── Notification queue ───────────────────────────────────────────────────────
export const notificationQueue = new Queue('notifications', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  },
});

// ── Notification worker ──────────────────────────────────────────────────────
// Processes notification jobs from the queue.
// Currently logs to console — Phase 5 will wire in Firebase FCM and Ethio Telecom SMS.
export const notificationWorker = new Worker(
  'notifications',
  async (job) => {
    const { type, studentName, time, tenantId } = job.data as {
      type: string;
      studentName: string;
      time: string;
      tenantId: string;
    };
    logger.info(
      `[NotificationQueue] ${type}: ${studentName} at ${time} (tenant: ${tenantId})`,
    );
    // TODO: Phase 5 — integrate Firebase FCM for push notifications
    // TODO: Phase 5 — integrate Ethio Telecom SMS via EthioTelecomSMSProvider
  },
  { connection: redisConnection },
);

notificationWorker.on('failed', (job, err) => {
  logger.error(`[NotificationQueue] Job ${job?.id ?? 'unknown'} failed: ${err.message}`);
});

notificationWorker.on('error', (err) => {
  logger.error(`[NotificationQueue] Worker error: ${err.message}`);
});
