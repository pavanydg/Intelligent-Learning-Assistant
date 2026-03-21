const mongoose = require('mongoose');

const CertificateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    playlistId: { type: String, required: true, index: true },
    playlistTitle: { type: String, required: true },
    userName: { type: String, required: true },
    issuedAt: { type: Date, default: Date.now },
    startedAt: { type: Date },
    completedAt: { type: Date },
    totalVideos: { type: Number, default: 0 },
    completedVideos: { type: Number, default: 0 },
    totalDurationSeconds: { type: Number, default: 0 },
    watchedDurationSeconds: { type: Number, default: 0 },
    certificatePath: { type: String, required: true },
    certificateNumber: { type: String, required: true, unique: true },
    verificationHash: { type: String, required: true, index: true },
    metadata: {
      theme: { type: String, default: 'classic' },
      timezone: { type: String, default: 'UTC' }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Certificate', CertificateSchema);




