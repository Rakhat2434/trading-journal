const JournalEntry = require('../models/JournalEntry');

/**
 * Helper: normalize date to start of UTC day
 */
const normalizeDate = (dateInput) => {
  const d = new Date(dateInput);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const parseTags = (tags) => {
  if (tags === undefined || tags === null) return undefined;

  if (Array.isArray(tags)) {
    return tags.map((t) => String(t).trim()).filter(Boolean);
  }

  if (typeof tags === 'string') {
    return tags.split(',').map((t) => t.trim()).filter(Boolean);
  }

  return [];
};

/**
 * GET /api/journal
 */
const getAllEntries = async (req, res) => {
  try {
    const { type, sort } = req.query;
    const filter = { user: req.userId };

    if (type && ['green', 'red'].includes(type)) {
      filter.type = type;
    }

    const sortOrder = sort === 'asc' ? 1 : -1;
    const entries = await JournalEntry.find(filter).sort({ date: sortOrder });

    res.json({ success: true, data: entries, count: entries.length });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/journal/:id
 */
const getEntryById = async (req, res) => {
  try {
    const entry = await JournalEntry.findOne({ _id: req.params.id, user: req.userId });

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }

    res.json({ success: true, data: entry });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * POST /api/journal
 */
const createEntry = async (req, res) => {
  try {
    const { date, type, title, note, score, tags } = req.body;

    if (!date || !type || !title || !note || score === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: date, type, title, note, score',
      });
    }

    const normalizedDate = normalizeDate(date);
    const existing = await JournalEntry.findOne({ user: req.userId, date: normalizedDate });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You already have an entry for this date',
      });
    }

    const parsedTags = parseTags(tags) || [];

    const entry = await JournalEntry.create({
      user: req.userId,
      date: normalizedDate,
      type,
      title: String(title).trim(),
      note: String(note).trim(),
      score: Number(score),
      tags: parsedTags,
    });

    res.status(201).json({ success: true, data: entry, message: 'Entry created successfully' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You already have an entry for this date',
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }

    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * PUT /api/journal/:id
 */
const updateEntry = async (req, res) => {
  try {
    const { date, score, tags } = req.body;

    if (date) {
      const normalizedDate = normalizeDate(date);
      const existing = await JournalEntry.findOne({
        user: req.userId,
        date: normalizedDate,
        _id: { $ne: req.params.id },
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'You already have an entry for this date',
        });
      }
    }

    const updateData = { ...req.body };

    if (date) {
      updateData.date = normalizeDate(date);
    }

    if (tags !== undefined) {
      updateData.tags = parseTags(tags);
    }

    if (score !== undefined) {
      updateData.score = Number(score);
    }

    if (updateData.title !== undefined) {
      updateData.title = String(updateData.title).trim();
    }

    if (updateData.note !== undefined) {
      updateData.note = String(updateData.note).trim();
    }

    const entry = await JournalEntry.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }

    res.json({ success: true, data: entry, message: 'Entry updated successfully' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You already have an entry for this date',
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }

    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * DELETE /api/journal/:id
 */
const deleteEntry = async (req, res) => {
  try {
    const entry = await JournalEntry.findOneAndDelete({ _id: req.params.id, user: req.userId });

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }

    res.json({ success: true, message: 'Entry deleted successfully' });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAllEntries, getEntryById, createEntry, updateEntry, deleteEntry };
