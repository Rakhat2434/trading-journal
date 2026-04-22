const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getAllEntries,
  getEntryById,
  createEntry,
  updateEntry,
  deleteEntry,
} = require('../controllers/journalController');

router.use(authMiddleware);

router.route('/').get(getAllEntries).post(createEntry);
router.route('/:id').get(getEntryById).put(updateEntry).delete(deleteEntry);

module.exports = router;
