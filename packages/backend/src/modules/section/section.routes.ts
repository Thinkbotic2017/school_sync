import { Router } from 'express';
import { sectionController } from './section.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validator';
import { createSectionSchema, updateSectionSchema, sectionFiltersSchema } from './section.validator';

const router: import("express").Router = Router();

router.use(authenticate);

router.get('/', validate(sectionFiltersSchema, 'query'), sectionController.list.bind(sectionController));
router.get('/:id', sectionController.getById.bind(sectionController));
router.post('/', validate(createSectionSchema), sectionController.create.bind(sectionController));
router.put('/:id', validate(updateSectionSchema), sectionController.update.bind(sectionController));
router.delete('/:id', sectionController.delete.bind(sectionController));

export { router as sectionRouter };
