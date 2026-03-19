import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { studentService } from './student.service';
import { BadRequestError } from '../../utils/errors';
import type { StudentFilters, CreateStudentDto } from './student.types';

class StudentController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const filters = req.query as unknown as StudentFilters;
      const result = await studentService.list(tenantId, filters);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const { id } = req.params;
      const student = await studentService.getById(tenantId, id);
      res.json({ success: true, data: student });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const student = await studentService.create(tenantId, req.body);
      res.status(201).json({ success: true, data: student });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const { id } = req.params;
      const student = await studentService.update(tenantId, id, req.body);
      res.json({ success: true, data: student });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const { id } = req.params;
      await studentService.delete(tenantId, id);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  }

  async uploadPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const { id } = req.params;

      if (!req.file) {
        throw new BadRequestError('Photo file is required');
      }

      const photoPath = req.file.path;
      const result = await studentService.updatePhoto(tenantId, id, photoPath);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async listDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const { id } = req.params;
      const documents = await studentService.listDocuments(tenantId, id);
      res.json({ success: true, data: documents });
    } catch (err) {
      next(err);
    }
  }

  async uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const { id } = req.params;

      if (!req.file) {
        throw new BadRequestError('Document file is required');
      }

      const { name } = req.body as { name?: string };
      if (!name) {
        throw new BadRequestError('Document name is required');
      }

      const doc = await studentService.addDocument(tenantId, id, {
        name,
        filePath: req.file.path,
        fileType: req.file.mimetype,
      });

      res.status(201).json({ success: true, data: doc });
    } catch (err) {
      next(err);
    }
  }

  async deleteDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const { docId } = req.params;
      await studentService.deleteDocument(tenantId, docId);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  }

  async assignParent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const { id } = req.params;
      const link = await studentService.assignParent(tenantId, id, req.body);
      res.status(201).json({ success: true, data: link });
    } catch (err) {
      next(err);
    }
  }

  async removeParent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;
      const { id, parentId } = req.params;
      await studentService.removeParent(tenantId, id, parentId);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  }

  async bulkImport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.auth!.tenantId;

      if (!req.file) {
        throw new BadRequestError('CSV file is required');
      }

      const filePath = req.file.path;
      const content = fs.readFileSync(filePath, 'utf-8');

      // Clean up uploaded file after reading
      fs.unlink(filePath, () => {});

      const lines = content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length < 2) {
        throw new BadRequestError('CSV file must have a header row and at least one data row');
      }

      const headerLine = lines[0];
      const headers = headerLine.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));

      const requiredHeaders = ['firstName', 'lastName', 'dateOfBirth', 'gender', 'classId', 'sectionId'];
      for (const required of requiredHeaders) {
        if (!headers.includes(required)) {
          throw new BadRequestError(`CSV missing required column: ${required}`);
        }
      }

      const rows: CreateStudentDto[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
        const rowObj: Record<string, string> = {};
        headers.forEach((header, idx) => {
          rowObj[header] = values[idx] ?? '';
        });

        rows.push({
          firstName: rowObj['firstName'] ?? '',
          lastName: rowObj['lastName'] ?? '',
          dateOfBirth: rowObj['dateOfBirth'] ?? '',
          gender: (rowObj['gender'] as 'MALE' | 'FEMALE') || 'MALE',
          classId: rowObj['classId'] ?? '',
          sectionId: rowObj['sectionId'] ?? '',
          bloodGroup: rowObj['bloodGroup'] || undefined,
          nationality: rowObj['nationality'] || undefined,
          rollNumber: rowObj['rollNumber'] || undefined,
          rfidCardNumber: rowObj['rfidCardNumber'] || undefined,
          admissionDate: rowObj['admissionDate'] || undefined,
          status:
            (rowObj['status'] as CreateStudentDto['status']) || undefined,
        });
      }

      const result = await studentService.bulkCreate(tenantId, rows);
      res.status(207).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const studentController = new StudentController();
