const { validationResult } = require('express-validator');
const youtubeService = require('../services/youtubeService');
const transcriptService = require('../services/transcriptService');
const summaryService = require('../services/summaryService');
const questionService = require('../services/questionService');
const { asyncHandler } = require('../middlewares/errorHandler');
const SavedPlaylist = require('../models/SavedPlaylist');
const Course = require('../models/Course');

/**
 * Search for YouTube playlists
 */
const searchPlaylists = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { query, maxResults = 10 } = req.query;

  if (!query || query.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Search query must be at least 2 characters long'
    });
  }

  const playlists = await youtubeService.searchPlaylists(query.trim(), parseInt(maxResults));

  res.json({
    success: true,
    data: {
      playlists,
      query: query.trim(),
      totalResults: playlists.length
    }
  });
});

/**
 * Get playlist details and save to database
 */
const getPlaylistDetails = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!playlistId) {
    return res.status(400).json({
      success: false,
      message: 'Playlist ID is required'
    });
  }

  // Get playlist details from YouTube
  const playlistData = await youtubeService.getPlaylistDetails(playlistId);

  // Save to database
  const course = await youtubeService.saveCourse(playlistData);

  res.json({
    success: true,
    data: {
      course: {
        id: course._id,
        playlistId: course.playlistId,
        title: course.title,
        description: course.description,
        thumbnail: course.thumbnail,
        channelTitle: course.channelTitle,
        videos: course.videos,
        tags: course.tags,
        metadata: course.metadata,
        createdAt: course.createdAt
      }
    }
  });
});

/**
 * Get video transcript
 */
const getVideoTranscript = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { summarize = false } = req.query;

  if (!videoId) {
    return res.status(400).json({
      success: false,
      message: 'Video ID is required'
    });
  }

  const transcriptData = await transcriptService.getTranscript(
    videoId,
    summarize === 'true'
  );

  res.json({
    success: true,
    data: transcriptData
  });
});

/**
 * Get course by ID or playlist ID
 */
const getCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;

  const Course = require('../models/Course');
  
  // Try to find by MongoDB ObjectId first, then by playlistId
  let course;
  try {
    // Check if it's a valid ObjectId (24 character hex string)
    if (courseId.match(/^[0-9a-fA-F]{24}$/)) {
      course = await Course.findById(courseId);
    } else {
      // If not a valid ObjectId, search by playlistId
      course = await Course.findOne({ playlistId: courseId });
    }
  } catch (error) {
    // If ObjectId parsing fails, search by playlistId
    course = await Course.findOne({ playlistId: courseId });
  }

  if (!course) {
    return res.status(404).json({
      success: false,
      message: 'Course not found'
    });
  }

  res.json({
    success: true,
    data: {
      course: {
        id: course._id,
        playlistId: course.playlistId,
        title: course.title,
        description: course.description,
        thumbnail: course.thumbnail,
        channelTitle: course.channelTitle,
        videos: course.videos,
        tags: course.tags,
        difficulty: course.difficulty,
        category: course.category,
        metadata: course.metadata,
        createdAt: course.createdAt
      }
    }
  });
});

/**
 * Get all courses with pagination and filtering
 */
const getCourses = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    category,
    difficulty,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const Course = require('../models/Course');
  
  // Build query
  const query = { isActive: true };
  
  if (search) {
    query.$text = { $search: search };
  }
  
  if (category) {
    query.category = category;
  }
  
  if (difficulty) {
    query.difficulty = difficulty;
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  // Execute query with pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const courses = await Course.find(query)
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit))
    .select('-videos.transcript'); // Exclude transcripts for list view

  const totalCourses = await Course.countDocuments(query);

  res.json({
    success: true,
    data: {
      courses: courses.map(course => ({
        id: course._id,
        playlistId: course.playlistId,
        title: course.title,
        description: course.description,
        thumbnail: course.thumbnail,
        channelTitle: course.channelTitle,
        tags: course.tags,
        difficulty: course.difficulty,
        category: course.category,
        metadata: course.metadata,
        createdAt: course.createdAt
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCourses / parseInt(limit)),
        totalCourses,
        hasNext: skip + courses.length < totalCourses,
        hasPrev: parseInt(page) > 1
      }
    }
  });
});

/**
 * Get video details
 */
const getVideoDetails = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    return res.status(400).json({
      success: false,
      message: 'Video ID is required'
    });
  }

  try {
    // First try to find the video in our database
    const Course = require('../models/Course');
    const course = await Course.findOne({
      'videos.videoId': videoId
    });

    if (course) {
      // Find the specific video in the course
      const video = course.videos.find(v => v.videoId === videoId);
      if (video) {
        return res.json({
          success: true,
          data: {
            video: {
              id: video.videoId,
              title: video.title,
              thumbnail: video.thumbnail,
              duration: video.duration,
              description: video.description
            }
          }
        });
      }
    }

    // If not found in database, try to fetch from YouTube API
    try {
      const videoDetails = await youtubeService.getVideoDetails(videoId);
      res.json({
        success: true,
        data: {
          video: videoDetails
        }
      });
    } catch (youtubeError) {
      // Fallback to basic info if YouTube API fails
      res.json({
        success: true,
        data: {
          video: {
            id: videoId,
            title: 'Video Title',
            thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            duration: '10:30',
            description: 'Video description'
          }
        }
      });
    }
  } catch (error) {
    console.error('Error fetching video details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching video details'
    });
  }
});

/**
 * Search courses by tags or content
 */
const searchCourses = asyncHandler(async (req, res) => {
  const { q: query, limit = 10 } = req.query;

  if (!query || query.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Search query must be at least 2 characters long'
    });
  }

  const Course = require('../models/Course');
  
  const courses = await Course.find({
    isActive: true,
    $text: { $search: query.trim() }
  })
  .sort({ score: { $meta: 'textScore' } })
  .limit(parseInt(limit))
  .select('-videos.transcript');

  res.json({
    success: true,
    data: {
      courses: courses.map(course => ({
        id: course._id,
        playlistId: course.playlistId,
        title: course.title,
        description: course.description,
        thumbnail: course.thumbnail,
        channelTitle: course.channelTitle,
        tags: course.tags,
        difficulty: course.difficulty,
        category: course.category,
        metadata: course.metadata
      })),
      query: query.trim(),
      totalResults: courses.length
    }
  });
});

/**
 * Save playlist to user's library
 */
const savePlaylist = asyncHandler(async (req, res) => {
  const { playlistId, title, description, thumbnail } = req.body
  const userId = req.user.id

  // Check if playlist already saved
  const existingPlaylist = await SavedPlaylist.findOne({ 
    userId, 
    playlistId 
  })

  if (existingPlaylist) {
    return res.status(400).json({
      success: false,
      message: 'Playlist already saved'
    })
  }

  // Save playlist
  const savedPlaylist = await SavedPlaylist.create({
    userId,
    playlistId,
    title,
    description,
    thumbnail,
    savedAt: new Date()
  })

  res.json({
    success: true,
    data: {
      savedPlaylist
    }
  })
})

/**
 * Get video context (which playlist/course it belongs to)
 */
const getVideoContext = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    return res.status(400).json({
      success: false,
      message: 'Video ID is required'
    });
  }

  try {
    // Try to find which course contains this video
    const Course = require('../models/Course');
    const course = await Course.findOne({
      'videos.videoId': videoId
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Video not found in any course'
      });
    }

    // Find the video index in the course
    const videoIndex = course.videos.findIndex(v => v.videoId === videoId);

    res.json({
      success: true,
      data: {
        playlist: {
          id: course.playlistId,
          title: course.title,
          videos: course.videos.map(v => ({
            videoId: v.videoId,
            title: v.title,
            thumbnail: v.thumbnail,
            duration: v.duration,
            description: v.description
          }))
        },
        currentIndex: videoIndex
      }
    });
  } catch (error) {
    console.error('Error fetching video context:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching video context'
    });
  }
});

/**
 * Get video with AI-generated content (notes and questions)
 */
const getVideoWithContent = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { difficulty = 'intermediate' } = req.query;

  if (!videoId) {
    return res.status(400).json({
      success: false,
      message: 'Video ID is required'
    });
  }

  try {
    console.log(`Generating AI content for video: ${videoId}`);
    
    // Get transcript
    const transcript = await transcriptService.getTranscript(videoId);
    if (!transcript) {
      return res.status(404).json({
        success: false,
        message: 'Transcript not available for this video'
      });
    }

    // Generate notes and questions in parallel
    const [notes, questions] = await Promise.all([
      summaryService.generateAllNotes(transcript),
      questionService.generateVideoQuestions(transcript, videoId, null, difficulty)
    ]);

    res.json({
      success: true,
      data: {
        videoId,
        transcript,
        notes: {
          short: notes.shortNotes,
          detailed: notes.detailedNotes,
          generatedAt: notes.generatedAt,
          fallback: notes.fallback || false
        },
        questions: questions.map(q => ({
          id: q._id,
          question: q.question,
          type: q.metadata.type,
          options: q.options,
          difficulty: q.difficulty,
          topic: q.topic
        })),
        totalQuestions: questions.length
      }
    });
  } catch (error) {
    console.error('Error generating video content:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating AI content for video'
    });
  }
});

/**
 * Generate comprehensive course test
 */
const generateCourseTest = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const { difficulty = 'intermediate' } = req.body;

  if (!courseId) {
    return res.status(400).json({
      success: false,
      message: 'Course ID is required'
    });
  }

  try {
    console.log(`Generating course test for course: ${courseId}`);
    
    // Get course and all video transcripts
    const course = await Course.findOne({ playlistId: courseId });
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Get all video transcripts
    const transcripts = [];
    for (const video of course.videos) {
      try {
        const transcript = await transcriptService.getTranscript(video.videoId);
        if (transcript) {
          transcripts.push(transcript);
        }
      } catch (error) {
        console.log(`Transcript not available for video: ${video.videoId}`);
      }
    }

    if (transcripts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No transcripts available for course videos'
      });
    }

    // Generate comprehensive test
    const questions = await questionService.generateCourseTest(transcripts, courseId, difficulty);

    res.json({
      success: true,
      data: {
        courseId,
        courseTitle: course.title,
        questions: questions.map(q => ({
          id: q._id,
          question: q.question,
          type: q.metadata.type,
          options: q.options,
          difficulty: q.difficulty,
          topic: q.topic
        })),
        totalQuestions: questions.length,
        difficulty
      }
    });
  } catch (error) {
    console.error('Error generating course test:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating course test'
    });
  }
});

/**
 * Get video notes only
 */
const getVideoNotes = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    return res.status(400).json({
      success: false,
      message: 'Video ID is required'
    });
  }

  try {
    const transcript = await transcriptService.getTranscript(videoId);
    if (!transcript) {
      return res.status(404).json({
        success: false,
        message: 'Transcript not available for this video'
      });
    }

    const notes = await summaryService.generateAllNotes(transcript);

    res.json({
      success: true,
      data: {
        videoId,
        notes: {
          short: notes.shortNotes,
          detailed: notes.detailedNotes,
          generatedAt: notes.generatedAt,
          fallback: notes.fallback || false
        }
      }
    });
  } catch (error) {
    console.error('Error generating video notes:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating video notes'
    });
  }
});

/**
 * Get video questions only
 */
const getVideoQuestions = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { difficulty = 'intermediate' } = req.query;

  if (!videoId) {
    return res.status(400).json({
      success: false,
      message: 'Video ID is required'
    });
  }

  try {
    const transcript = await transcriptService.getTranscript(videoId);
    if (!transcript) {
      return res.status(404).json({
        success: false,
        message: 'Transcript not available for this video'
      });
    }

    const questions = await questionService.generateVideoQuestions(transcript, videoId, null, difficulty);

    res.json({
      success: true,
      data: {
        videoId,
        questions: questions.map(q => ({
          id: q._id,
          question: q.question,
          type: q.metadata.type,
          options: q.options,
          difficulty: q.difficulty,
          topic: q.topic
        })),
        totalQuestions: questions.length,
        difficulty
      }
    });
  } catch (error) {
    console.error('Error generating video questions:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating video questions'
    });
  }
});

module.exports = {
  searchPlaylists,
  getPlaylistDetails,
  getVideoTranscript,
  getCourse,
  getCourses,
  getVideoDetails,
  searchCourses,
  savePlaylist,
  getVideoContext,
  getVideoWithContent,
  generateCourseTest,
  getVideoNotes,
  getVideoQuestions
};
