// Requires: pnpm add multer @types/multer
import { Router } from 'express';
import multer from 'multer';
import { validate } from '../../middleware/validator';
import { studentController } from './student.controller';
import {
  createStudentSchema,
  updateStudentSchema,
  studentFiltersSchema,
  assignParentSchema,
} from './student.validator';

const router: import("express").Router = Router();

// Authentication and tenant context are applied globally in index.ts
// before this router is mounted — no need to re-apply here.

// --- Configured multer instances (CRIT-004) ---

const photoUpload = multer({
  dest: 'uploads/photos/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed for photos'));
    }
  },
});

const documentUpload = multer({
  dest: 'uploads/documents/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images, PDFs, and Word documents are allowed'));
    }
  },
});

const csvUpload = multer({
  dest: 'uploads/imports/',
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['text/csv', 'application/csv', 'text/plain'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed for bulk import'));
    }
  },
});

// IMPORTANT: bulk-import must be registered before /:id to avoid route conflict
router.post(
  '/bulk-import',
  csvUpload.single('file'),
  studentController.bulkImport.bind(studentController),
);

// Student CRUD
router.get(
  '/',
  validate(studentFiltersSchema, 'query'),
  studentController.list.bind(studentController),
);

router.get('/:id', studentController.getById.bind(studentController));

router.post(
  '/',
  validate(createStudentSchema),
  studentController.create.bind(studentController),
);

router.put(
  '/:id',
  validate(updateStudentSchema),
  studentController.update.bind(studentController),
);

router.delete('/:id', studentController.delete.bind(studentController));

// Photo
router.post(
  '/:id/photo',
  photoUpload.single('photo'),
  studentController.uploadPhoto.bind(studentController),
);

// Documents
router.get('/:id/documents', studentController.listDocuments.bind(studentController));

router.post(
  '/:id/documents',
  documentUpload.single('file'),
  studentController.uploadDocument.bind(studentController),
);

router.delete(
  '/:id/documents/:docId',
  studentController.deleteDocument.bind(studentController),
);

// Parents
router.post(
  '/:id/parents',
  validate(assignParentSchema),
  studentController.assignParent.bind(studentController),
);

router.delete(
  '/:id/parents/:parentId',
  studentController.removeParent.bind(studentController),
);

export { router as studentRouter };
