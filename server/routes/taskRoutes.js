const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
} = require('../controllers/taskController');

router.use(authMiddleware);

router.route('/').get(getTasks).post(createTask);
router.route('/:id').get(getTaskById).put(updateTask).delete(deleteTask);
router.patch('/:id/complete', completeTask);

module.exports = router;
