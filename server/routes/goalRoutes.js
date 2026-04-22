const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getAllGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
} = require('../controllers/goalController');

router.use(authMiddleware);

router.route('/').get(getAllGoals).post(createGoal);
router.route('/:id').get(getGoalById).put(updateGoal).delete(deleteGoal);

module.exports = router;
