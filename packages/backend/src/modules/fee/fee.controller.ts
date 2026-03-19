import type { Request, Response, NextFunction } from 'express';
import { feeService } from './fee.service';
import type { FeeStructureFilters, FeeRecordFilters, FeeReportFilters } from './fee.types';

export const feeController = {
  // ── Fee Structures ────────────────────────────────────────────────────────────

  async listStructures(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feeService.listStructures(
        req.auth!.tenantId,
        req.query as unknown as FeeStructureFilters,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async getStructure(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feeService.getStructureById(req.auth!.tenantId, req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async createStructure(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feeService.createStructure(req.auth!.tenantId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async updateStructure(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feeService.updateStructure(req.auth!.tenantId, req.params.id, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async deleteStructure(req: Request, res: Response, next: NextFunction) {
    try {
      await feeService.deleteStructure(req.auth!.tenantId, req.params.id);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  },

  async generateRecords(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feeService.generateRecords(req.auth!.tenantId, req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  // ── Fee Records ───────────────────────────────────────────────────────────────

  async listRecords(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feeService.listRecords(
        req.auth!.tenantId,
        req.query as unknown as FeeRecordFilters,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async getRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feeService.getRecordById(req.auth!.tenantId, req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async recordPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feeService.recordPayment(req.auth!.tenantId, req.params.id, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async waiveFee(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feeService.waiveFee(req.auth!.tenantId, req.params.id, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async updateRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feeService.updateRecord(req.auth!.tenantId, req.params.id, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  // ── Discounts ─────────────────────────────────────────────────────────────────

  async createDiscount(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feeService.createDiscount(req.auth!.tenantId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async listDiscounts(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feeService.listDiscounts(
        req.auth!.tenantId,
        req.query.studentId as string | undefined,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async deleteDiscount(req: Request, res: Response, next: NextFunction) {
    try {
      await feeService.deleteDiscount(req.auth!.tenantId, req.params.id);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  },

  // ── Reports ───────────────────────────────────────────────────────────────────

  async collectionSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feeService.getCollectionSummary(
        req.auth!.tenantId,
        req.query as unknown as FeeReportFilters,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async studentLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feeService.getStudentLedger(
        req.auth!.tenantId,
        req.params.studentId,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async overdueReport(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feeService.getOverdueRecords(req.auth!.tenantId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async classSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feeService.getClassSummary(
        req.auth!.tenantId,
        req.query as unknown as FeeReportFilters,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
