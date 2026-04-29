const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getSessions,
  createSession,
  updateSession,
  deleteSession,
} = require('../controllers/timerController');

router.use(authMiddleware);

router.route('/sessions').get(getSessions).post(createSession);
router.route('/sessions/:id').patch(updateSession).delete(deleteSession);

module.exports = router;
