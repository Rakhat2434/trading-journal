const mongoose = require('mongoose');

const focusSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    durationMinutes: {
      type: Number,
      required: [true, 'Duration is required'],
      min: [1, 'Duration must be at least 1 minute'],
      max: [600, 'Duration cannot exceed 600 minutes'],
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    completed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

focusSessionSchema.index({ user: 1, startedAt: -1 });

module.exports = mongoose.model('FocusSession', focusSessionSchema);
