import type { Request, Response, NextFunction } from 'express';
import { dashboardService } from './dashboard.service';

export const dashboardController = {
  async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await dashboardService.getOverview(req.auth!.tenantId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getAttendanceChart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const period = (req.query['period'] as string | undefined) ?? 'week';
      if (period !== 'week' && period !== 'month' && period !== 'term') {
        res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'period must be one of: week, month, term' },
        });
        return;
      }
      const data = await dashboardService.getAttendanceChart(req.auth!.tenantId, period);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getFeeChart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const period = (req.query['period'] as string | undefined) ?? 'month';
      if (period !== 'month' && period !== 'quarter' && period !== 'year') {
        res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'period must be one of: month, quarter, year' },
        });
        return;
      }
      const data = await dashboardService.getFeeChart(req.auth!.tenantId, period);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getClassPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await dashboardService.getClassPerformance(req.auth!.tenantId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
