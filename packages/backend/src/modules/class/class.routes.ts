import { Router } from 'express';
import { classController } from './class.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validator';
import { createClassSchema, updateClassSchema, classFiltersSchema } from './class.validator';

const router: import("express").Router = Router();

router.use(authenticate);

router.get('/', validate(classFiltersSchema, 'query'), classController.list.bind(classController));
router.get('/:id', classController.getById.bind(classController));
router.post('/', validate(createClassSchema), classController.create.bind(classController));
router.put('/:id', validate(updateClassSchema), classController.update.bind(classController));
router.delete('/:id', classController.delete.bind(classController));

export { router as classRouter };
