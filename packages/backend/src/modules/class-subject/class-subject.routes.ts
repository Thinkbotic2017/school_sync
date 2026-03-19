import { Router } from 'express';
import { classSubjectController } from './class-subject.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validator';
import {
  assignSubjectSchema,
  classSubjectFiltersSchema,
  classSubjectParamsSchema,
} from './class-subject.validator';

const router: import("express").Router = Router();

router.use(authenticate);

router.get(
  '/',
  validate(classSubjectFiltersSchema, 'query'),
  classSubjectController.listByClass.bind(classSubjectController),
);

router.post(
  '/',
  validate(assignSubjectSchema),
  classSubjectController.assign.bind(classSubjectController),
);

router.delete(
  '/:classId/:subjectId',
  validate(classSubjectParamsSchema, 'params'),
  classSubjectController.unassign.bind(classSubjectController),
);

export { router as classSubjectRouter };
