const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    type: {
      type: String,
      required: [true, 'Type is required'],
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    unlockedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

achievementSchema.index({ user: 1, type: 1 }, { unique: true });
achievementSchema.index({ user: 1, unlockedAt: -1 });

module.exports = mongoose.model('Achievement', achievementSchema);
