const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getAchievements,
  checkAchievements,
} = require('../controllers/achievementController');

router.use(authMiddleware);

router.get('/', getAchievements);
router.post('/check', checkAchievements);

module.exports = router;
