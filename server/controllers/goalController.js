const Goal = require('../models/Goal');

/**
 * GET /api/goals
 */
const getAllGoals = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { user: req.userId };

    if (status && ['active', 'completed', 'failed'].includes(status)) {
      filter.status = status;
    }

    const goals = await Goal.find(filter).sort({ createdAt: -1 });
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
    const { title, description, targetDate, status, progress } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    if (progress !== undefined && (Number(progress) < 0 || Number(progress) > 100)) {
      return res.status(400).json({ success: false, message: 'Progress must be between 0 and 100' });
    }

    const goal = await Goal.create({
      user: req.userId,
      title: String(title).trim(),
      description: description ? String(description).trim() : '',
      targetDate: targetDate || null,
      status: status || 'active',
      progress: progress !== undefined ? Number(progress) : 0,
    });

    res.status(201).json({ success: true, data: goal, message: 'Goal created successfully' });
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
    const { progress } = req.body;

    if (progress !== undefined && (Number(progress) < 0 || Number(progress) > 100)) {
      return res.status(400).json({ success: false, message: 'Progress must be between 0 and 100' });
    }

    const updateData = { ...req.body };

    if (progress !== undefined) {
      updateData.progress = Number(progress);
    }

    if (updateData.title !== undefined) {
      updateData.title = String(updateData.title).trim();
    }

    if (updateData.description !== undefined) {
      updateData.description = String(updateData.description).trim();
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

    res.json({ success: true, data: goal, message: 'Goal updated successfully' });
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
