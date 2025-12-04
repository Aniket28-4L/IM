import { Router } from 'express';
import { auth, permit } from '../middlewares/auth.js';
import { listUsers, createUser, updateUser, getUser } from '../controllers/user.controller.js';

const router = Router();
router.get('/', auth(true), permit('Admin', 'Manager'), listUsers);
router.post('/', auth(true), permit('Admin', 'Manager'), createUser);
router.get('/new', auth(true), permit('Admin', 'Manager'), (req, res) => {
  res.json({ success: true, data: { name: '', email: '', role: 'Viewer' } });
});
router.get('/:id', auth(true), permit('Admin', 'Manager'), getUser);
router.put('/:id', auth(true), permit('Admin', 'Manager'), updateUser);

export default router;

