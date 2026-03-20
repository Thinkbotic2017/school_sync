import { Request, Response, NextFunction } from 'express';
import { academicYearService } from './academic-year.service';

export class AcademicYearController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const { page, limit } = req.query as { page?: string; limit?: string };
      const result = await academicYearService.list(
        tenantId,
        {
          page: page ? Number(page) : undefined,
          limit: limit ? Number(limit) : undefined,
        },
        req.db,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const data = await academicYearService.getById(tenantId, req.params.id, req.db);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const data = await academicYearService.create(tenantId, req.body, req.db);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const data = await academicYearService.update(tenantId, req.params.id, req.body, req.db);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const data = await academicYearService.delete(tenantId, req.params.id, req.db);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async setCurrent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const data = await academicYearService.setCurrent(tenantId, req.params.id, req.db);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const academicYearController = new AcademicYearController();
