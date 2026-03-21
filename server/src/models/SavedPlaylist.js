const mongoose = require('mongoose');

const savedPlaylistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  playlistId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  thumbnail: {
    type: String,
    default: ''
  },
  savedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
savedPlaylistSchema.index({ userId: 1, playlistId: 1 }, { unique: true });
savedPlaylistSchema.index({ userId: 1, savedAt: -1 });

module.exports = mongoose.model('SavedPlaylist', savedPlaylistSchema);
