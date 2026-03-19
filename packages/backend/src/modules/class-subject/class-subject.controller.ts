import { Request, Response, NextFunction } from 'express';
import { classSubjectService } from './class-subject.service';

export class ClassSubjectController {
  async listByClass(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const { classId } = req.query as { classId: string };
      const data = await classSubjectService.listByClass(tenantId, classId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async assign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const data = await classSubjectService.assign(tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async unassign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const { classId, subjectId } = req.params;
      const data = await classSubjectService.unassign(tenantId, classId, subjectId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const classSubjectController = new ClassSubjectController();
