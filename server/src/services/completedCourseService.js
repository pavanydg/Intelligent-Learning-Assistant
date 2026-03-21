const CompletedCourse = require('../models/CompletedCourse');
const UserProgress = require('../models/UserProgress');
const Course = require('../models/Course');
const Certificate = require('../models/Certificate');

class CompletedCourseService {
  /**
   * Mark a course as completed and store details
   * @param {string} userId - User ID
   * @param {string} playlistId - Playlist ID
   * @param {Object} certificate - Certificate object (optional)
   * @returns {Promise<Object>} Completed course record
   */
  async markCourseCompleted(userId, playlistId, certificate = null) {
    try {
      // Get user progress
      const progress = await UserProgress.findOne({ userId, courseId: playlistId });
      if (!progress) {
        throw new Error('User progress not found');
      }

      // Get course details
      const course = await Course.findOne({ playlistId });
      if (!course) {
        throw new Error('Course not found');
      }

      // Check if already completed
      const existingCompleted = await CompletedCourse.findOne({ userId, playlistId });
      if (existingCompleted) {
        // Update with certificate if provided
        if (certificate) {
          existingCompleted.certificateId = certificate._id;
          existingCompleted.certificateNumber = certificate.certificateNumber;
          existingCompleted.certificateIssuedAt = certificate.issuedAt;
          await existingCompleted.save();
        }
        return existingCompleted;
      }

      // Calculate total duration
      const totalDuration = course.videos.reduce((acc, video) => {
        return acc + this.parseDuration(video.duration || 'PT0S');
      }, 0);

      // Create completed course record
      const completedCourse = new CompletedCourse({
        userId,
        playlistId,
        courseTitle: progress.courseTitle || course.title,
        courseDescription: course.description || '',
        courseThumbnail: course.thumbnail || '',
        channelTitle: course.channelTitle || '',
        totalVideos: progress.totalVideos,
        completedVideos: progress.completedVideos.length,
        completionPercentage: progress.completionPercentage,
        averageTestScore: progress.averageTestScore,
        totalWatchTime: progress.totalWatchTime,
        totalDuration,
        startedAt: progress.startedAt || progress.createdAt,
        completedAt: progress.lastUpdated || new Date(),
        certificateId: certificate?._id || null,
        certificateNumber: certificate?.certificateNumber || null,
        certificateIssuedAt: certificate?.issuedAt || null,
        metadata: {
          difficulty: course.difficulty || 'beginner',
          category: course.category || 'general',
          tags: course.tags || [],
          totalAttempts: progress.testScores?.length || 0,
          bestScore: Math.max(...(progress.testScores || [0])),
        },
      });

      await completedCourse.save();
      return completedCourse;
    } catch (error) {
      console.error('Error marking course as completed:', error);
      throw error;
    }
  }

  /**
   * Get all completed courses for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Completed courses
   */
  async getUserCompletedCourses(userId) {
    try {
      const completedCourses = await CompletedCourse.find({ userId })
        .populate('certificateId')
        .sort({ completedAt: -1 });

      return completedCourses;
    } catch (error) {
      console.error('Error getting user completed courses:', error);
      throw error;
    }
  }

  /**
   * Get completed course by ID
   * @param {string} completedCourseId - Completed course ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Completed course
   */
  async getCompletedCourseById(completedCourseId, userId) {
    try {
      const completedCourse = await CompletedCourse.findOne({
        _id: completedCourseId,
        userId
      }).populate('certificateId');

      return completedCourse;
    } catch (error) {
      console.error('Error getting completed course by ID:', error);
      throw error;
    }
  }

  /**
   * Update certificate information for a completed course
   * @param {string} userId - User ID
   * @param {string} playlistId - Playlist ID
   * @param {Object} certificate - Certificate object
   * @returns {Promise<Object>} Updated completed course
   */
  async updateCertificateInfo(userId, playlistId, certificate) {
    try {
      const completedCourse = await CompletedCourse.findOne({ userId, playlistId });
      if (!completedCourse) {
        throw new Error('Completed course not found');
      }

      completedCourse.certificateId = certificate._id;
      completedCourse.certificateNumber = certificate.certificateNumber;
      completedCourse.certificateIssuedAt = certificate.issuedAt;

      await completedCourse.save();
      return completedCourse;
    } catch (error) {
      console.error('Error updating certificate info:', error);
      throw error;
    }
  }

  /**
   * Parse ISO 8601 duration to seconds
   * @param {string} duration - ISO 8601 duration string
   * @returns {number} Duration in seconds
   */
  parseDuration(duration) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Get completion statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Statistics
   */
  async getUserCompletionStats(userId) {
    try {
      const stats = await CompletedCourse.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: null,
            totalCompleted: { $sum: 1 },
            totalVideos: { $sum: '$totalVideos' },
            totalWatchTime: { $sum: '$totalWatchTime' },
            totalDuration: { $sum: '$totalDuration' },
            averageScore: { $avg: '$averageTestScore' },
            certificatesEarned: {
              $sum: { $cond: [{ $ne: ['$certificateId', null] }, 1, 0] }
            }
          }
        }
      ]);

      return stats[0] || {
        totalCompleted: 0,
        totalVideos: 0,
        totalWatchTime: 0,
        totalDuration: 0,
        averageScore: 0,
        certificatesEarned: 0
      };
    } catch (error) {
      console.error('Error getting completion stats:', error);
      throw error;
    }
  }
}

module.exports = new CompletedCourseService();


