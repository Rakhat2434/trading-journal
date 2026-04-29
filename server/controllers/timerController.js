const FocusSession = require('../models/FocusSession');
const { checkAchievementsForUser } = require('./achievementController');

const parseBoolean = (value) => value === true || value === 'true';

const sanitizeSessionPayload = (body) => {
  const data = {};

  if (body.durationMinutes !== undefined) {
    data.durationMinutes = Number(body.durationMinutes);
  }
  if (body.startedAt !== undefined) {
    data.startedAt = body.startedAt ? new Date(body.startedAt) : new Date();
  }
  if (body.endedAt !== undefined) {
    data.endedAt = body.endedAt ? new Date(body.endedAt) : null;
  }
  if (body.completed !== undefined) {
    data.completed = parseBoolean(body.completed);
  }

  return data;
};

const getSessions = async (req, res) => {
  try {
    const sessions = await FocusSession.find({ user: req.userId }).sort({ startedAt: -1 });
    res.json({ success: true, data: sessions, count: sessions.length });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createSession = async (req, res) => {
  try {
    const data = sanitizeSessionPayload(req.body);

    if (!data.durationMinutes || Number.isNaN(data.durationMinutes)) {
      return res.status(400).json({ success: false, message: 'Duration is required' });
    }

    if (data.durationMinutes < 1 || data.durationMinutes > 600) {
      return res.status(400).json({ success: false, message: 'Duration must be between 1 and 600 minutes' });
    }

    const session = await FocusSession.create({
      user: req.userId,
      durationMinutes: data.durationMinutes,
      startedAt: data.startedAt || new Date(),
      endedAt: data.endedAt || null,
      completed: Boolean(data.completed),
    });

    const achievements = session.completed ? await checkAchievementsForUser(req.userId) : [];

    res.status(201).json({
      success: true,
      data: session,
      achievements,
      message: 'Focus session created successfully',
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }

    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateSession = async (req, res) => {
  try {
    const data = sanitizeSessionPayload(req.body);

    if (data.durationMinutes !== undefined && (Number.isNaN(data.durationMinutes) || data.durationMinutes < 1 || data.durationMinutes > 600)) {
      return res.status(400).json({ success: false, message: 'Duration must be between 1 and 600 minutes' });
    }

    const session = await FocusSession.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      data,
      { new: true, runValidators: true }
    );

    if (!session) {
      return res.status(404).json({ success: false, message: 'Focus session not found' });
    }

    const achievements = session.completed ? await checkAchievementsForUser(req.userId) : [];

    res.json({
      success: true,
      data: session,
      achievements,
      message: 'Focus session updated successfully',
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }

    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteSession = async (req, res) => {
  try {
    const session = await FocusSession.findOneAndDelete({ _id: req.params.id, user: req.userId });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Focus session not found' });
    }

    res.json({ success: true, message: 'Focus session deleted successfully' });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getSessions,
  createSession,
  updateSession,
  deleteSession,
};
