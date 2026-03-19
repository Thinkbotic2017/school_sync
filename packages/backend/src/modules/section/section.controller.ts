import { Request, Response, NextFunction } from 'express';
import { sectionService } from './section.service';

export class SectionController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const { classId, page, limit } = req.query as {
        classId?: string;
        page?: string;
        limit?: string;
      };
      const result = await sectionService.list(tenantId, {
        classId,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const data = await sectionService.getById(tenantId, req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const data = await sectionService.create(tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const data = await sectionService.update(tenantId, req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const data = await sectionService.delete(tenantId, req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const sectionController = new SectionController();
