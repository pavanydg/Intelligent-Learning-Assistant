const { asyncHandler } = require('../middlewares/errorHandler');
const UserProgress = require('../models/UserProgress');
const Course = require('../models/Course');

/**
 * Get user progress for a specific course
 */
const getCourseProgress = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  // Ensure we use the correct userId - try both id and _id
  const userId = req.user.id || req.user._id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'User ID not found in request'
    });
  }

  try {
    // Always find progress by userId and courseId to ensure user-specific progress
    let progress = await UserProgress.findOne({ userId, courseId });
    
    if (!progress) {
      // Create new progress entry if it doesn't exist
      const course = await Course.findOne({ playlistId: courseId });
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      progress = new UserProgress({
        userId: userId, // Explicitly set userId to ensure it's correct
        courseId,
        courseTitle: course.title,
        totalVideos: course.videos.length,
        completedVideos: [],
        completionPercentage: 0,
        testScores: [],
        averageTestScore: 0,
        totalWatchTime: 0,
      });

      await progress.save();
    }

    // Double-check that the progress belongs to the correct user
    if (progress.userId.toString() !== userId.toString()) {
      console.error(`Progress userId mismatch! Expected: ${userId}, Found: ${progress.userId}`);
      return res.status(500).json({
        success: false,
        message: 'Progress record does not belong to the current user'
      });
    }

    res.json({
      success: true,
      data: {
        progress: {
          courseId: progress.courseId,
          courseTitle: progress.courseTitle,
          totalVideos: progress.totalVideos,
          completedVideos: progress.completedVideos,
          completionPercentage: progress.completionPercentage,
          testScores: progress.testScores,
          averageTestScore: progress.averageTestScore,
          lastWatchedVideo: progress.lastWatchedVideo,
          totalWatchTime: progress.totalWatchTime,
          startedAt: progress.startedAt,
          lastUpdated: progress.lastUpdated,
        }
      }
    });
  } catch (error) {
    console.error('Error fetching course progress:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching course progress'
    });
  }
});

/**
 * Get all user progress
 */
const getAllUserProgress = asyncHandler(async (req, res) => {
  // Ensure we use the correct userId - try both id and _id
  const userId = req.user.id || req.user._id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'User ID not found in request'
    });
  }

  try {
    // Always find progress by userId to ensure user-specific progress
    const progressList = await UserProgress.find({ userId })
      .sort({ lastUpdated: -1 })
      .populate('testScores.assessmentId', 'score totalQuestions createdAt');

    res.json({
      success: true,
      data: {
        progress: progressList.map(p => {
          // Calculate completion percentage if not set
          const completionPercentage = p.completionPercentage || 
            (p.totalVideos > 0 ? Math.round((p.completedVideos.length / p.totalVideos) * 100) : 0);
          
          return {
            courseId: p.courseId,
            courseTitle: p.courseTitle,
            totalVideos: p.totalVideos,
            completedVideos: p.completedVideos, // Return array to match ProfilePage
            completionPercentage: completionPercentage,
            testScores: p.testScores, // Return array to match ProfilePage
            averageTestScore: p.averageTestScore,
            lastWatchedVideo: p.lastWatchedVideo,
            totalWatchTime: p.totalWatchTime,
            startedAt: p.startedAt,
            lastUpdated: p.lastUpdated,
          };
        })
      }
    });
  } catch (error) {
    console.error('Error fetching user progress:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user progress'
    });
  }
});

/**
 * Mark video as completed
 */
const markVideoCompleted = asyncHandler(async (req, res) => {
  const { courseId, videoId, videoTitle, watchTime } = req.body;
  // Ensure we use the correct userId - try both id and _id
  const userId = req.user.id || req.user._id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'User ID not found in request'
    });
  }

  try {
    // Always find progress by userId and courseId to ensure user-specific progress
    let progress = await UserProgress.findOne({ userId, courseId });
    
    if (!progress) {
      // Create new progress entry
      const course = await Course.findOne({ playlistId: courseId });
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      progress = new UserProgress({
        userId: userId, // Explicitly set userId to ensure it's correct
        courseId,
        courseTitle: course.title,
        totalVideos: course.videos.length,
        completedVideos: [],
        completionPercentage: 0,
        testScores: [],
        averageTestScore: 0,
        totalWatchTime: 0,
      });
      
      // Save the new progress record immediately
      await progress.save();
    }

    // Double-check that the progress belongs to the correct user
    if (progress.userId.toString() !== userId.toString()) {
      console.error(`Progress userId mismatch! Expected: ${userId}, Found: ${progress.userId}`);
      return res.status(500).json({
        success: false,
        message: 'Progress record does not belong to the current user'
      });
    }

    await progress.updateProgress(videoId, videoTitle, watchTime);

    // Check if course is 100% completed and trigger certificate generation
    if (progress.completionPercentage === 100) {
      try {
        const certificateService = require('../services/certificateService');
        const User = require('../models/User');
        
        // Get user details
        const user = await User.findById(userId);
        if (user) {
          // Check if certificate already exists
          const Certificate = require('../models/Certificate');
          const existingCert = await Certificate.findOne({
            userId,
            playlistId: courseId
          });
          
          if (!existingCert) {
            console.log(`🎓 Course 100% completed, generating certificate for: ${courseId}`);
            const result = await certificateService.issueCertificate(user, courseId);
            if (result.success) {
              console.log(`✅ Certificate generated: ${result.certificate.certificateNumber}`);
            }
          }
        }
      } catch (certError) {
        console.error('Error generating certificate:', certError);
        // Don't fail the main request if certificate generation fails
      }
    }

    res.json({
      success: true,
      message: 'Video marked as completed',
      data: {
        completionPercentage: progress.completionPercentage,
        completedVideos: progress.completedVideos.length,
        totalVideos: progress.totalVideos,
      }
    });
  } catch (error) {
    console.error('Error marking video as completed:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking video as completed'
    });
  }
});

/**
 * Add test score to course progress
 */
const addTestScore = asyncHandler(async (req, res) => {
  const { courseId, assessmentId, score, totalQuestions } = req.body;
  // Ensure we use the correct userId - try both id and _id
  const userId = req.user.id || req.user._id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'User ID not found in request'
    });
  }

  try {
    // Always find progress by userId and courseId to ensure user-specific progress
    let progress = await UserProgress.findOne({ userId, courseId });
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'Course progress not found. Please start watching videos first.'
      });
    }

    // Double-check that the progress belongs to the correct user
    if (progress.userId.toString() !== userId.toString()) {
      console.error(`Progress userId mismatch! Expected: ${userId}, Found: ${progress.userId}`);
      return res.status(500).json({
        success: false,
        message: 'Progress record does not belong to the current user'
      });
    }

    await progress.addTestScore(assessmentId, score, totalQuestions);

    res.json({
      success: true,
      message: 'Test score added successfully',
      data: {
        averageTestScore: progress.averageTestScore,
        totalTests: progress.testScores.length,
      }
    });
  } catch (error) {
    console.error('Error adding test score:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding test score'
    });
  }
});

/**
 * Get user progress statistics
 */
const getProgressStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  try {
    const progressList = await UserProgress.find({ userId });
    
    const stats = {
      totalCourses: progressList.length,
      totalVideosWatched: progressList.reduce((sum, p) => sum + p.completedVideos.length, 0),
      totalWatchTime: progressList.reduce((sum, p) => sum + p.totalWatchTime, 0),
      averageCompletion: progressList.length > 0 
        ? Math.round(progressList.reduce((sum, p) => sum + p.completionPercentage, 0) / progressList.length)
        : 0,
      averageTestScore: progressList.length > 0
        ? Math.round(progressList.reduce((sum, p) => sum + p.averageTestScore, 0) / progressList.length)
        : 0,
      completedCourses: progressList.filter(p => p.completionPercentage === 100).length,
    };

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Error fetching progress stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching progress stats'
    });
  }
});

module.exports = {
  getCourseProgress,
  getAllUserProgress,
  markVideoCompleted,
  addTestScore,
  getProgressStats,
};
