import { Router } from 'express';
import { subjectController } from './subject.controller';
import { validate } from '../../middleware/validator';
import { createSubjectSchema, updateSubjectSchema, subjectFiltersSchema } from './subject.validator';

const router: import("express").Router = Router();

// Authentication and tenant context are applied globally in index.ts.

router.get('/', validate(subjectFiltersSchema, 'query'), subjectController.list.bind(subjectController));
router.get('/:id', subjectController.getById.bind(subjectController));
router.post('/', validate(createSubjectSchema), subjectController.create.bind(subjectController));
router.put('/:id', validate(updateSubjectSchema), subjectController.update.bind(subjectController));
router.delete('/:id', subjectController.delete.bind(subjectController));

export { router as subjectRouter };
