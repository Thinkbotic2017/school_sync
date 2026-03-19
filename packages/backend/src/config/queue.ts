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

// ── Fee overdue check queue ───────────────────────────────────────────────────
export const feeQueue = new Queue('fee', {
  connection: redisConnection,
  defaultJobOptions: { removeOnComplete: 100, removeOnFail: 50 },
});

// Schedule daily overdue check at midnight — use void to suppress unhandled promise warning
void feeQueue.add(
  'fee:check-overdue',
  {},
  {
    repeat: { pattern: '0 0 * * *' },
    jobId: 'fee-overdue-check-singleton',
  },
).catch((err: Error) => logger.error('Failed to schedule fee overdue job:', err));

// Worker: marks PENDING/PARTIAL fee records as OVERDUE when past due date
export const feeWorker = new Worker(
  'fee',
  async (job) => {
    if (job.name === 'fee:check-overdue') {
      const { prisma: prismaClient } = await import('./database');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tenants = await prismaClient.tenant.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      for (const tenant of tenants) {
        await prismaClient.$transaction(async (tx) => {
          // transaction-scoped RLS context (true = resets after transaction)
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenant.id}, true)`;

          const overdueRecords = await tx.feeRecord.findMany({
            where: {
              tenantId: tenant.id,
              status: { in: ['PENDING', 'PARTIAL'] },
              dueDate: { lt: today },
            },
            select: { id: true },
          });

          if (overdueRecords.length > 0) {
            await tx.feeRecord.updateMany({
              where: {
                tenantId: tenant.id,
                id: { in: overdueRecords.map((r) => r.id) },
              },
              data: { status: 'OVERDUE' },
            });

            logger.info(
              `[FeeQueue] Marked ${overdueRecords.length} records as OVERDUE for tenant ${tenant.id}`,
            );
          }
        });
      }
    }
  },
  { connection: redisConnection },
);

feeWorker.on('failed', (job, err) => {
  logger.error(`[FeeQueue] Job ${job?.id ?? 'unknown'} failed: ${err.message}`);
});
