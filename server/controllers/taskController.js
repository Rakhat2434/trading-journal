const Goal = require('../models/Goal');
const Task = require('../models/Task');
const { checkAchievementsForUser } = require('./achievementController');

const VALID_STATUSES = ['pending', 'completed', 'missed'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

const normalizeDate = (dateInput) => {
  const d = new Date(dateInput);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const ensureGoalBelongsToUser = async (goalId, userId) => {
  if (!goalId) return null;

  const goal = await Goal.findOne({ _id: goalId, user: userId });
  return goal ? goal._id : false;
};

const cleanPayload = (body) => {
  const data = {};

  if (body.goal !== undefined) data.goal = body.goal || null;
  if (body.title !== undefined) data.title = String(body.title).trim();
  if (body.description !== undefined) data.description = String(body.description).trim();
  if (body.date !== undefined) data.date = body.date ? normalizeDate(body.date) : null;
  if (body.startTime !== undefined) data.startTime = String(body.startTime).trim();
  if (body.endTime !== undefined) data.endTime = String(body.endTime).trim();
  if (body.status !== undefined) data.status = body.status;
  if (body.priority !== undefined) data.priority = body.priority;
  if (body.color !== undefined) data.color = String(body.color).trim();

  return data;
};

const getTasks = async (req, res) => {
  try {
    const { status, priority, goal, date, from, to } = req.query;
    const filter = { user: req.userId };

    if (status && VALID_STATUSES.includes(status)) filter.status = status;
    if (priority && VALID_PRIORITIES.includes(priority)) filter.priority = priority;
    if (goal) filter.goal = goal;

    if (date) {
      const start = normalizeDate(date);
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 1);
      filter.date = { $gte: start, $lt: end };
    } else if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = normalizeDate(from);
      if (to) {
        const end = normalizeDate(to);
        end.setUTCDate(end.getUTCDate() + 1);
        filter.date.$lt = end;
      }
    }

    const tasks = await Task.find(filter)
      .populate('goal', 'title status progress')
      .sort({ date: 1, startTime: 1, createdAt: 1 });

    res.json({ success: true, data: tasks, count: tasks.length });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getTaskById = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.userId }).populate('goal', 'title status progress');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({ success: true, data: task });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createTask = async (req, res) => {
  try {
    const data = cleanPayload(req.body);

    if (!data.title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    if (!data.date || Number.isNaN(data.date.getTime())) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    if (data.goal) {
      const goalId = await ensureGoalBelongsToUser(data.goal, req.userId);
      if (!goalId) return res.status(400).json({ success: false, message: 'Goal not found' });
      data.goal = goalId;
    }

    const task = await Task.create({
      user: req.userId,
      title: data.title,
      description: data.description || '',
      date: data.date,
      startTime: data.startTime || '',
      endTime: data.endTime || '',
      status: data.status || 'pending',
      priority: data.priority || 'medium',
      goal: data.goal || null,
      color: data.color || '',
    });

    const populatedTask = await Task.findOne({ _id: task._id, user: req.userId }).populate('goal', 'title status progress');
    const achievements = populatedTask.status === 'completed' ? await checkAchievementsForUser(req.userId) : [];

    res.status(201).json({
      success: true,
      data: populatedTask,
      achievements,
      message: 'Task created successfully',
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }

    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateTask = async (req, res) => {
  try {
    const data = cleanPayload(req.body);

    if (data.title !== undefined && !data.title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    if (data.date !== undefined && (!data.date || Number.isNaN(data.date.getTime()))) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    if (data.goal) {
      const goalId = await ensureGoalBelongsToUser(data.goal, req.userId);
      if (!goalId) return res.status(400).json({ success: false, message: 'Goal not found' });
      data.goal = goalId;
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      data,
      { new: true, runValidators: true }
    ).populate('goal', 'title status progress');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const achievements = task.status === 'completed' ? await checkAchievementsForUser(req.userId) : [];

    res.json({
      success: true,
      data: task,
      achievements,
      message: 'Task updated successfully',
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }

    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteTask = async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.userId });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const completeTask = async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { status: 'completed' },
      { new: true, runValidators: true }
    ).populate('goal', 'title status progress');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const achievements = await checkAchievementsForUser(req.userId);

    res.json({
      success: true,
      data: task,
      achievements,
      reward: {
        title: 'Great job! You completed a task.',
        message: 'You deserve a small reward. Take a short break, drink water, or do something nice for yourself.',
      },
      message: 'Task completed successfully',
    });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
};
