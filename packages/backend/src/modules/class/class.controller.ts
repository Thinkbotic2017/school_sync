import { Request, Response, NextFunction } from 'express';
import { classService } from './class.service';

export class ClassController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const { academicYearId, page, limit } = req.query as {
        academicYearId?: string;
        page?: string;
        limit?: string;
      };
      const result = await classService.list(
        tenantId,
        {
          academicYearId,
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
      const data = await classService.getById(tenantId, req.params.id, req.db);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const data = await classService.create(tenantId, req.body, req.db);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const data = await classService.update(tenantId, req.params.id, req.body, req.db);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const data = await classService.delete(tenantId, req.params.id, req.db);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const classController = new ClassController();
