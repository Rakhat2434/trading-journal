const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    goal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Goal',
      default: null,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    startTime: {
      type: String,
      trim: true,
      default: '',
    },
    endTime: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'completed', 'missed'],
        message: 'Status must be pending, completed, or missed',
      },
      default: 'pending',
    },
    priority: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high'],
        message: 'Priority must be low, medium, or high',
      },
      default: 'medium',
    },
    color: {
      type: String,
      trim: true,
      maxlength: [32, 'Color cannot exceed 32 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

taskSchema.index({ user: 1, date: 1 });
taskSchema.index({ user: 1, status: 1, date: 1 });
taskSchema.index({ user: 1, goal: 1 });

module.exports = mongoose.model('Task', taskSchema);
