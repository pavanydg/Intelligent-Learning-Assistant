const mongoose = require('mongoose');

const TranscriptSchema = new mongoose.Schema(
  {
    videoId: { type: String, required: true, index: true, unique: true },
    transcript: { type: String, required: true },
    language: { type: String, default: 'en' },
    wordCount: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    source: { type: String, enum: ['assemblyai', 'youtube', 'mock', 'whisperx'], default: 'assemblyai' },
    status: { 
      type: String, 
      enum: ['pending', 'processing', 'completed', 'failed'], 
      default: 'pending',
      index: true
    },
    processingMode: { 
      type: String, 
      enum: ['sequential', 'parallel', 'offline'], 
      default: 'sequential' 
    },
    chunks: [{
      chunkIndex: { type: Number, required: true },
      startTime: { type: Number, required: true },
      endTime: { type: Number, required: true },
      transcriptId: { type: String }, // AssemblyAI transcript ID for this chunk
      transcript: { type: String },
      language: { type: String }, // Language detected for this chunk
      status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
      uploadedAt: { type: Date },
      completedAt: { type: Date },
      error: { type: String }
    }],
    embeddings: { type: [Number] }, // Vector embeddings for semantic search
    metadata: {
      savedBy: { type: String, default: 'system' },
      lastUsedAt: { type: Date },
      totalChunks: { type: Number, default: 0 },
      completedChunks: { type: Number, default: 0 },
      processingStartTime: { type: Date },
      processingEndTime: { type: Date },
      processingDuration: { type: Number }, // in milliseconds
    },
  },
  { timestamps: true }
);

TranscriptSchema.methods.touchLastUsed = async function () {
  this.metadata.lastUsedAt = new Date();
  await this.save();
};

module.exports = mongoose.model('Transcript', TranscriptSchema);



