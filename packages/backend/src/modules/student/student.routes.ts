// Requires: pnpm add multer @types/multer
import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validator';
import { studentController } from './student.controller';
import {
  createStudentSchema,
  updateStudentSchema,
  studentFiltersSchema,
  assignParentSchema,
} from './student.validator';

const router: import("express").Router = Router();

const upload = multer({ dest: 'uploads/' });

// All routes require authentication
router.use(authenticate);

// IMPORTANT: bulk-import must be registered before /:id to avoid route conflict
router.post(
  '/bulk-import',
  upload.single('file'),
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
  upload.single('photo'),
  studentController.uploadPhoto.bind(studentController),
);

// Documents
router.get('/:id/documents', studentController.listDocuments.bind(studentController));

router.post(
  '/:id/documents',
  upload.single('file'),
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
