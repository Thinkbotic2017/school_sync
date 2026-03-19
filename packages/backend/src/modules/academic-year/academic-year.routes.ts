import { Router } from 'express';
import { academicYearController } from './academic-year.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validator';
import {
  createAcademicYearSchema,
  updateAcademicYearSchema,
  paginationSchema,
} from './academic-year.validator';

const router: import("express").Router = Router();

router.use(authenticate);

router.get('/', validate(paginationSchema, 'query'), academicYearController.list.bind(academicYearController));
router.get('/:id', academicYearController.getById.bind(academicYearController));
router.post('/', validate(createAcademicYearSchema), academicYearController.create.bind(academicYearController));
router.put('/:id', validate(updateAcademicYearSchema), academicYearController.update.bind(academicYearController));
router.delete('/:id', academicYearController.delete.bind(academicYearController));
router.put('/:id/set-current', academicYearController.setCurrent.bind(academicYearController));

export { router as academicYearRouter };
