const Achievement = require('../models/Achievement');
const FocusSession = require('../models/FocusSession');
const Goal = require('../models/Goal');
const Task = require('../models/Task');

const ACHIEVEMENTS = {
  first_task_completed: {
    type: 'first_task_completed',
    title: 'First Step',
    description: 'Completed one task.',
  },
  productive_day: {
    type: 'productive_day',
    title: 'Productive Day',
    description: 'Completed three tasks in one day.',
  },
  strong_week: {
    type: 'strong_week',
    title: 'Strong Week',
    description: 'Completed seven tasks in one week.',
  },
  stability: {
    type: 'stability',
    title: 'Stability',
    description: 'Completed tasks three days in a row.',
  },
  focus_master: {
    type: 'focus_master',
    title: 'Focus Master',
    description: 'You completed five focus sessions.',
  },
  goal_finisher: {
    type: 'goal_finisher',
    title: 'Goal Finisher',
    description: 'You completed your first goal.',
  },
  green_week: {
    type: 'green_week',
    title: 'Green Week',
    description: 'You created seven productive days in one week.',
  },
};

const startOfUtcDay = (dateInput) => {
  const date = new Date(dateInput);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const dayKey = (dateInput) => startOfUtcDay(dateInput).toISOString().slice(0, 10);

const maxConsecutiveDays = (keys) => {
  const sorted = [...new Set(keys)].sort();
  if (!sorted.length) return 0;

  let best = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i += 1) {
    const previous = startOfUtcDay(sorted[i - 1]);
    const currentDate = startOfUtcDay(sorted[i]);
    const diffDays = Math.round((currentDate - previous) / 86400000);

    if (diffDays === 1) {
      current += 1;
      best = Math.max(best, current);
    } else if (diffDays > 1) {
      current = 1;
    }
  }

  return best;
};

const unlockAchievement = async (userId, achievement) => {
  const existing = await Achievement.findOne({ user: userId, type: achievement.type });
  if (existing) return null;

  try {
    return await Achievement.create({
      user: userId,
      type: achievement.type,
      title: achievement.title,
      description: achievement.description,
      unlockedAt: new Date(),
    });
  } catch (error) {
    if (error.code === 11000) return null;
    throw error;
  }
};

const weekKey = (dateInput) => {
  const date = startOfUtcDay(dateInput);
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + mondayOffset);
  return dayKey(date);
};

const countBy = (items, getKey) => {
  const counts = new Map();
  items.forEach((item) => {
    const key = getKey(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
};

const maxCount = (counts) => {
  if (!counts.size) return 0;
  return Math.max(...counts.values());
};

const checkAchievementsForUser = async (userId) => {
  const [
    completedTasks,
    completedSessionsCount,
    completedGoalsCount,
  ] = await Promise.all([
    Task.find({ user: userId, status: 'completed' }).select('date').lean(),
    FocusSession.countDocuments({ user: userId, completed: true }),
    Goal.countDocuments({ user: userId, status: 'completed' }),
  ]);

  const taskDayKeys = completedTasks.map((task) => dayKey(task.date));
  const dayCounts = countBy(completedTasks, (task) => dayKey(task.date));
  const weekCounts = countBy(completedTasks, (task) => weekKey(task.date));
  const candidates = [];

  if (completedTasks.length >= 1) candidates.push(ACHIEVEMENTS.first_task_completed);
  if (maxCount(dayCounts) >= 3) candidates.push(ACHIEVEMENTS.productive_day);
  if (maxCount(weekCounts) >= 7) candidates.push(ACHIEVEMENTS.strong_week);
  if (maxConsecutiveDays(taskDayKeys) >= 3) candidates.push(ACHIEVEMENTS.stability);
  if (completedSessionsCount >= 5) candidates.push(ACHIEVEMENTS.focus_master);
  if (completedGoalsCount >= 1) candidates.push(ACHIEVEMENTS.goal_finisher);

  const unlocked = [];
  for (const candidate of candidates) {
    const achievement = await unlockAchievement(userId, candidate);
    if (achievement) unlocked.push(achievement);
  }

  return unlocked;
};

const getAchievements = async (req, res) => {
  try {
    const achievements = await Achievement.find({ user: req.userId }).sort({ unlockedAt: -1 });
    res.json({ success: true, data: achievements, count: achievements.length });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const checkAchievements = async (req, res) => {
  try {
    const unlocked = await checkAchievementsForUser(req.userId);
    const achievements = await Achievement.find({ user: req.userId }).sort({ unlockedAt: -1 });

    res.json({
      success: true,
      data: achievements,
      unlocked,
      count: achievements.length,
      message: unlocked.length ? 'New achievements unlocked' : 'Achievements are up to date',
    });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getAchievements,
  checkAchievements,
  checkAchievementsForUser,
};
