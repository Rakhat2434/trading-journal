const Goal = require('../models/Goal');
const { checkAchievementsForUser } = require('./achievementController');

const VALID_PRIORITIES = ['low', 'medium', 'high'];
const VALID_STATUSES = ['active', 'completed', 'failed'];

const cleanGoalPayload = (body) => {
  const data = {};

  if (body.title !== undefined) data.title = String(body.title).trim();
  if (body.description !== undefined) data.description = String(body.description).trim();
  if (body.targetDate !== undefined) data.targetDate = body.targetDate || null;
  if (body.status !== undefined) data.status = body.status;
  if (body.progress !== undefined) data.progress = Number(body.progress);
  if (body.priority !== undefined) data.priority = body.priority;
  if (body.category !== undefined) data.category = String(body.category).trim();

  return data;
};

/**
 * GET /api/goals
 */
const getAllGoals = async (req, res) => {
  try {
    const { status, priority, category } = req.query;
    const filter = { user: req.userId };

    if (status && VALID_STATUSES.includes(status)) {
      filter.status = status;
    }

    if (priority && VALID_PRIORITIES.includes(priority)) {
      filter.priority = priority;
    }

    if (category) {
      filter.category = category;
    }

    const goals = await Goal.find(filter).sort({ status: 1, targetDate: 1, createdAt: -1 });
    res.json({ success: true, data: goals, count: goals.length });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/goals/:id
 */
const getGoalById = async (req, res) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, user: req.userId });

    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }

    res.json({ success: true, data: goal });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * POST /api/goals
 */
const createGoal = async (req, res) => {
  try {
    const data = cleanGoalPayload(req.body);

    if (!data.title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    if (data.progress !== undefined && (Number(data.progress) < 0 || Number(data.progress) > 100)) {
      return res.status(400).json({ success: false, message: 'Progress must be between 0 and 100' });
    }

    const goal = await Goal.create({
      user: req.userId,
      title: data.title,
      description: data.description || '',
      targetDate: data.targetDate || null,
      status: data.status || 'active',
      progress: data.progress !== undefined ? Number(data.progress) : 0,
      priority: data.priority || 'medium',
      category: data.category || '',
    });

    const achievements = goal.status === 'completed' ? await checkAchievementsForUser(req.userId) : [];

    res.status(201).json({
      success: true,
      data: goal,
      achievements,
      message: 'Goal created successfully',
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }

    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * PUT /api/goals/:id
 */
const updateGoal = async (req, res) => {
  try {
    const updateData = cleanGoalPayload(req.body);
    const { progress } = updateData;

    if (progress !== undefined && (Number(progress) < 0 || Number(progress) > 100)) {
      return res.status(400).json({ success: false, message: 'Progress must be between 0 and 100' });
    }

    if (updateData.title !== undefined && !updateData.title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    if (progress !== undefined) {
      updateData.progress = Number(progress);
    }

    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }

    const achievements = goal.status === 'completed' ? await checkAchievementsForUser(req.userId) : [];

    res.json({
      success: true,
      data: goal,
      achievements,
      message: 'Goal updated successfully',
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }

    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * DELETE /api/goals/:id
 */
const deleteGoal = async (req, res) => {
  try {
    const goal = await Goal.findOneAndDelete({ _id: req.params.id, user: req.userId });

    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }

    res.json({ success: true, message: 'Goal deleted successfully' });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAllGoals, getGoalById, createGoal, updateGoal, deleteGoal };
