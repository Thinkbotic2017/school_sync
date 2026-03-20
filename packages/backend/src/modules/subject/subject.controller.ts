import { Request, Response, NextFunction } from 'express';
import { subjectService } from './subject.service';

export class SubjectController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const { academicYearId, type, page, limit } = req.query as {
        academicYearId?: string;
        type?: string;
        page?: string;
        limit?: string;
      };
      const result = await subjectService.list(
        tenantId,
        {
          academicYearId,
          type: type as 'CORE' | 'ELECTIVE' | 'EXTRACURRICULAR' | undefined,
          page: page ? Number(page) : undefined,
          limit: limit ? Number(limit) : undefined,
        },
        req.db!,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const data = await subjectService.getById(tenantId, req.params.id, req.db!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const data = await subjectService.create(tenantId, req.body, req.db!);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const data = await subjectService.update(tenantId, req.params.id, req.body, req.db!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const data = await subjectService.delete(tenantId, req.params.id, req.db!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const subjectController = new SubjectController();
