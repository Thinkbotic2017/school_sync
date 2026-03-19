import type { Request, Response, NextFunction } from 'express';
import { attendanceService } from './attendance.service';
import type { AttendanceFilters } from './attendance.types';

export const attendanceController = {
  async rfidEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await attendanceService.processRfidEvent(req.auth!.tenantId, req.body as Parameters<typeof attendanceService.processRfidEvent>[1]);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async manual(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await attendanceService.markManual(
        req.auth!.tenantId,
        req.auth!.userId,
        req.body as Parameters<typeof attendanceService.markManual>[2],
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async bulk(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await attendanceService.markBulk(
        req.auth!.tenantId,
        req.body as Parameters<typeof attendanceService.markBulk>[1],
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await attendanceService.list(
        req.auth!.tenantId,
        req.query as unknown as AttendanceFilters,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async report(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate, classId, sectionId, studentId } = req.query as Record<
        string,
        string | undefined
      >;
      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'startDate and endDate are required' },
        });
        return;
      }
      const result = await attendanceService.getReport(req.auth!.tenantId, {
        startDate,
        endDate,
        classId,
        sectionId,
        studentId,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async todaySummary(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await attendanceService.getTodaySummary(req.auth!.tenantId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async recentCheckIns(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await attendanceService.getRecentCheckIns(req.auth!.tenantId, 5);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
