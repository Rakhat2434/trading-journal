const Achievement = require('../models/Achievement');
const FocusSession = require('../models/FocusSession');
const Goal = require('../models/Goal');
const JournalEntry = require('../models/JournalEntry');
const Task = require('../models/Task');

const ACHIEVEMENTS = {
  first_task_completed: {
    type: 'first_task_completed',
    title: 'First Task Completed',
    description: 'You completed your first scheduled task.',
  },
  three_tasks_completed: {
    type: 'three_tasks_completed',
    title: '3 Tasks Completed',
    description: 'You completed three tasks and kept momentum moving.',
  },
  seven_day_consistency: {
    type: 'seven_day_consistency',
    title: '7-Day Consistency Streak',
    description: 'You logged productive work across seven consecutive days.',
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

const hasSevenDaysInRecentWindow = (keys) => {
  const unique = new Set(keys);
  const today = startOfUtcDay(new Date());

  for (let offset = 0; offset < 14; offset += 1) {
    const windowEnd = new Date(today);
    windowEnd.setUTCDate(today.getUTCDate() - offset);

    let count = 0;
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(windowEnd);
      day.setUTCDate(windowEnd.getUTCDate() - i);
      if (unique.has(dayKey(day))) count += 1;
    }

    if (count >= 7) return true;
  }

  return false;
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

const getProductiveDayKeys = async (userId) => {
  const [completedTasks, completedSessions, greenEntries] = await Promise.all([
    Task.find({ user: userId, status: 'completed' }).select('date').lean(),
    FocusSession.find({ user: userId, completed: true }).select('startedAt endedAt createdAt').lean(),
    JournalEntry.find({ user: userId, type: 'green' }).select('date').lean(),
  ]);

  return [
    ...completedTasks.map((task) => dayKey(task.date)),
    ...completedSessions.map((session) => dayKey(session.endedAt || session.startedAt || session.createdAt)),
    ...greenEntries.map((entry) => dayKey(entry.date)),
  ];
};

const checkAchievementsForUser = async (userId) => {
  const [
    completedTasksCount,
    completedSessionsCount,
    completedGoalsCount,
    productiveDayKeys,
  ] = await Promise.all([
    Task.countDocuments({ user: userId, status: 'completed' }),
    FocusSession.countDocuments({ user: userId, completed: true }),
    Goal.countDocuments({ user: userId, status: 'completed' }),
    getProductiveDayKeys(userId),
  ]);

  const candidates = [];

  if (completedTasksCount >= 1) candidates.push(ACHIEVEMENTS.first_task_completed);
  if (completedTasksCount >= 3) candidates.push(ACHIEVEMENTS.three_tasks_completed);
  if (maxConsecutiveDays(productiveDayKeys) >= 7) candidates.push(ACHIEVEMENTS.seven_day_consistency);
  if (completedSessionsCount >= 5) candidates.push(ACHIEVEMENTS.focus_master);
  if (completedGoalsCount >= 1) candidates.push(ACHIEVEMENTS.goal_finisher);
  if (hasSevenDaysInRecentWindow(productiveDayKeys)) candidates.push(ACHIEVEMENTS.green_week);

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
