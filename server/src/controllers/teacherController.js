const { asyncHandler } = require('../middlewares/errorHandler');
const Assessment = require('../models/Assessment');
const UserProgress = require('../models/UserProgress');
const Course = require('../models/Course');
const User = require('../models/User');
const CourseKey = require('../models/CourseKey');
const CourseKeyUsage = require('../models/CourseKeyUsage');
const youtubeService = require('../services/youtubeService');

/**
 * Search courses (for teachers to find courses to analyze)
 * Uses YouTube API to search for playlists
 */
const searchCourses = asyncHandler(async (req, res) => {
  const { query, page = 1, limit = 20 } = req.query;
  const searchQuery = query || '';

  if (!searchQuery.trim()) {
    return res.json({
      success: true,
      data: {
        courses: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          totalPages: 0
        }
      }
    });
  }

  try {
    // Use YouTube API to search for playlists
    const maxResults = parseInt(limit);
    const playlists = await youtubeService.searchPlaylists(searchQuery.trim(), maxResults);

    // Transform YouTube playlists to match the expected course format
    const courses = playlists.map(playlist => ({
      id: playlist.playlistId, // Use playlistId as id for now
      playlistId: playlist.playlistId,
      title: playlist.title,
      description: playlist.description || '',
      thumbnail: playlist.thumbnail || '',
      channelTitle: playlist.channelTitle || '',
      totalVideos: 0, // Will be fetched when playlist details are loaded
      tags: [],
      difficulty: '',
      category: '',
      metadata: {
        publishedAt: playlist.publishedAt
      }
    }));

    res.json({
      success: true,
      data: {
        courses,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: courses.length,
          totalPages: Math.ceil(courses.length / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Search courses error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error searching courses. Please check if YouTube API key is configured.'
    });
  }
});

/**
 * Get course analytics - aggregated data for all students
 */
const getCourseAnalytics = asyncHandler(async (req, res) => {
  const { courseId } = req.params;

  try {
    // Get course details
    let course;
    if (courseId.match(/^[0-9a-fA-F]{24}$/)) {
      course = await Course.findById(courseId);
    } else {
      course = await Course.findOne({ playlistId: courseId });
    }

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Get all assessments for this course
    const assessments = await Assessment.find({
      courseId: course.playlistId,
      status: 'completed'
    }).populate('userId', 'name email');

    // Get all user progress for this course
    const progressList = await UserProgress.find({
      courseId: course.playlistId
    }).populate('userId', 'name email');

    // Calculate analytics
    const totalStudents = new Set([
      ...assessments.map(a => a.userId?._id?.toString()),
      ...progressList.map(p => p.userId?._id?.toString())
    ]).size;

    const totalAssessments = assessments.length;
    const averageScore = assessments.length > 0
      ? assessments.reduce((sum, a) => sum + (a.testScore || 0), 0) / assessments.length
      : 0;

    const averageCLI = assessments.length > 0
      ? assessments.reduce((sum, a) => sum + (a.cli || 0), 0) / assessments.length
      : 0;

    // Score distribution
    const scoreDistribution = {
      excellent: assessments.filter(a => (a.testScore || 0) >= 80).length,
      good: assessments.filter(a => (a.testScore || 0) >= 60 && (a.testScore || 0) < 80).length,
      needsImprovement: assessments.filter(a => (a.testScore || 0) < 60).length
    };

    // CLI distribution
    const cliDistribution = {
      low: assessments.filter(a => (a.cli || 0) <= 35).length,
      moderate: assessments.filter(a => (a.cli || 0) > 35 && (a.cli || 0) <= 70).length,
      high: assessments.filter(a => (a.cli || 0) > 70).length
    };

    // Average completion percentage
    const averageCompletion = progressList.length > 0
      ? progressList.reduce((sum, p) => {
          const completion = p.completionPercentage || 
            (p.totalVideos > 0 ? (p.completedVideos?.length || 0) / p.totalVideos * 100 : 0);
          return sum + completion;
        }, 0) / progressList.length
      : 0;

    // Video-wise analytics
    const videoAnalytics = {};
    course.videos?.forEach(video => {
      const videoAssessments = assessments.filter(a => a.videoId === video.videoId);
      const videoProgress = progressList.filter(p => 
        p.completedVideos?.some(v => v.videoId === video.videoId)
      );

      videoAnalytics[video.videoId] = {
        videoId: video.videoId,
        title: video.title,
        totalAssessments: videoAssessments.length,
        completedBy: videoProgress.length,
        averageScore: videoAssessments.length > 0
          ? videoAssessments.reduce((sum, a) => sum + (a.testScore || 0), 0) / videoAssessments.length
          : 0,
        averageCLI: videoAssessments.length > 0
          ? videoAssessments.reduce((sum, a) => sum + (a.cli || 0), 0) / videoAssessments.length
          : 0
      };
    });

    res.json({
      success: true,
      data: {
        course: {
          id: course._id,
          playlistId: course.playlistId,
          title: course.title,
          description: course.description,
          thumbnail: course.thumbnail,
          totalVideos: course.videos?.length || 0
        },
        analytics: {
          totalStudents,
          totalAssessments,
          averageScore: Math.round(averageScore * 100) / 100,
          averageCLI: Math.round(averageCLI * 100) / 100,
          averageCompletion: Math.round(averageCompletion * 100) / 100,
          scoreDistribution,
          cliDistribution
        },
        videoAnalytics: Object.values(videoAnalytics)
      }
    });
  } catch (error) {
    console.error('Get course analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching course analytics'
    });
  }
});

/**
 * Get students enrolled in a course
 */
const getCourseStudents = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const { page = 1, limit = 50, colleges, departments } = req.query;

  try {
    // Get course
    let course;
    if (courseId.match(/^[0-9a-fA-F]{24}$/)) {
      course = await Course.findById(courseId);
    } else {
      course = await Course.findOne({ playlistId: courseId });
    }

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Parse filter arrays
    const collegeFilter = colleges ? (Array.isArray(colleges) ? colleges : [colleges]) : [];
    const departmentFilter = departments ? (Array.isArray(departments) ? departments : [departments]) : [];

    // Build user filter for college and department
    const userFilter = { role: 'student' };
    if (collegeFilter.length > 0) {
      userFilter.college = { $in: collegeFilter };
    }
    if (departmentFilter.length > 0) {
      userFilter.department = { $in: departmentFilter };
    }

    // Get all unique students who have assessments or progress for this course
    const assessments = await Assessment.find({
      courseId: course.playlistId
    }).populate({
      path: 'userId',
      match: userFilter,
      select: 'name email role college department'
    });

    const progressList = await UserProgress.find({
      courseId: course.playlistId
    }).populate({
      path: 'userId',
      match: userFilter,
      select: 'name email role college department'
    });

    // Combine and deduplicate students
    const studentMap = new Map();

    assessments.forEach(a => {
      if (a.userId && a.userId.role === 'student') {
        const userId = a.userId._id.toString();
        if (!studentMap.has(userId)) {
          studentMap.set(userId, {
            userId: userId,
            name: a.userId.name,
            email: a.userId.email,
            college: a.userId.college || '',
            department: a.userId.department || '',
            assessments: [],
            progress: null
          });
        }
        studentMap.get(userId).assessments.push({
          id: a._id,
          videoId: a.videoId,
          videoTitle: a.videoTitle,
          testScore: a.testScore,
          cli: a.cli,
          cliClassification: a.cliClassification,
          createdAt: a.createdAt
        });
      }
    });

    progressList.forEach(p => {
      if (p.userId && p.userId.role === 'student') {
        const userId = p.userId._id.toString();
        if (!studentMap.has(userId)) {
          studentMap.set(userId, {
            userId: userId,
            name: p.userId.name,
            email: p.userId.email,
            college: p.userId.college || '',
            department: p.userId.department || '',
            assessments: [],
            progress: null
          });
        }
        const completionPercentage = p.completionPercentage || 
          (p.totalVideos > 0 ? (p.completedVideos?.length || 0) / p.totalVideos * 100 : 0);
        
        studentMap.get(userId).progress = {
          totalVideos: p.totalVideos,
          completedVideos: p.completedVideos?.length || 0,
          completionPercentage: Math.round(completionPercentage * 100) / 100,
          averageTestScore: p.averageTestScore || 0,
          totalWatchTime: p.totalWatchTime || 0,
          lastUpdated: p.lastUpdated
        };
      }
    });

    // Filter out null users (from populate match)
    const students = Array.from(studentMap.values()).filter(s => s.userId);

    // Calculate summary stats for each student
    const studentsWithStats = students.map(student => {
      const avgScore = student.assessments.length > 0
        ? student.assessments.reduce((sum, a) => sum + (a.testScore || 0), 0) / student.assessments.length
        : 0;

      const avgCLI = student.assessments.length > 0
        ? student.assessments.reduce((sum, a) => sum + (a.cli || 0), 0) / student.assessments.length
        : 0;

      return {
        ...student,
        stats: {
          totalAssessments: student.assessments.length,
          averageScore: Math.round(avgScore * 100) / 100,
          averageCLI: Math.round(avgCLI * 100) / 100
        }
      };
    });

    // Paginate
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedStudents = studentsWithStats.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        students: paginatedStudents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: studentsWithStats.length,
          totalPages: Math.ceil(studentsWithStats.length / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get course students error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching course students'
    });
  }
});

/**
 * Get individual student progress for a course
 */
const getStudentCourseProgress = asyncHandler(async (req, res) => {
  const { courseId, studentId } = req.params;

  try {
    // Get course
    let course;
    if (courseId.match(/^[0-9a-fA-F]{24}$/)) {
      course = await Course.findById(courseId);
    } else {
      course = await Course.findOne({ playlistId: courseId });
    }

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Get student assessments
    const assessments = await Assessment.find({
      courseId: course.playlistId,
      userId: studentId,
      status: 'completed'
    }).sort({ createdAt: -1 });

    // Get student progress
    const progress = await UserProgress.findOne({
      courseId: course.playlistId,
      userId: studentId
    });

    // Get student info
    const student = await User.findById(studentId).select('name email');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Map assessments to videos
    const videoProgress = course.videos?.map(video => {
      const videoAssessments = assessments.filter(a => a.videoId === video.videoId);
      const isCompleted = progress?.completedVideos?.some(v => v.videoId === video.videoId) || false;

      return {
        videoId: video.videoId,
        title: video.title,
        thumbnail: video.thumbnail,
        isCompleted,
        assessments: videoAssessments.map(a => ({
          id: a._id,
          testScore: a.testScore,
          cli: a.cli,
          cliClassification: a.cliClassification,
          confidence: a.confidence,
          timeSpent: a.timeSpent,
          createdAt: a.createdAt
        }))
      };
    }) || [];

    const completionPercentage = progress?.completionPercentage || 
      (course.videos?.length > 0 
        ? (progress?.completedVideos?.length || 0) / course.videos.length * 100 
        : 0);

    res.json({
      success: true,
      data: {
        student: {
          id: student._id,
          name: student.name,
          email: student.email
        },
        course: {
          id: course._id,
          playlistId: course.playlistId,
          title: course.title,
          thumbnail: course.thumbnail
        },
        progress: {
          totalVideos: course.videos?.length || 0,
          completedVideos: progress?.completedVideos?.length || 0,
          completionPercentage: Math.round(completionPercentage * 100) / 100,
          averageTestScore: progress?.averageTestScore || 0,
          totalWatchTime: progress?.totalWatchTime || 0,
          startedAt: progress?.startedAt,
          lastUpdated: progress?.lastUpdated
        },
        videoProgress,
        totalAssessments: assessments.length
      }
    });
  } catch (error) {
    console.error('Get student course progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching student progress'
    });
  }
});

/**
 * Get all unique colleges and departments for filtering
 */
const getCollegesAndDepartments = asyncHandler(async (req, res) => {
  try {
    // Get all unique colleges and departments from students
    const students = await User.find({ 
      role: 'student',
      $or: [
        { college: { $exists: true, $ne: '' } },
        { department: { $exists: true, $ne: '' } }
      ]
    }).select('college department');

    const collegesSet = new Set();
    const departmentsSet = new Set();

    students.forEach(student => {
      if (student.college && student.college.trim()) {
        collegesSet.add(student.college.trim());
      }
      if (student.department && student.department.trim()) {
        departmentsSet.add(student.department.trim());
      }
    });

    const colleges = Array.from(collegesSet).sort();
    const departments = Array.from(departmentsSet).sort();

    res.json({
      success: true,
      data: {
        colleges,
        departments
      }
    });
  } catch (error) {
    console.error('Get colleges and departments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching colleges and departments'
    });
  }
});

/**
 * Generate a course key for a course
 */
const generateCourseKey = asyncHandler(async (req, res) => {
  const { courseId, description, expiresAt, maxStudents } = req.body;
  const teacherId = req.user._id;

  if (!courseId) {
    return res.status(400).json({
      success: false,
      message: 'Course ID is required'
    });
  }

  try {
    // Get course details - first try database, then fetch from YouTube if not found
    let course;
    if (courseId.match(/^[0-9a-fA-F]{24}$/)) {
      course = await Course.findById(courseId);
    } else {
      course = await Course.findOne({ playlistId: courseId });
    }

    // If course not in database, fetch from YouTube API and save it
    if (!course) {
      try {
        const playlistData = await youtubeService.getPlaylistDetails(courseId);
        course = await youtubeService.saveCourse(playlistData);
      } catch (youtubeError) {
        console.error('Error fetching playlist from YouTube:', youtubeError);
        return res.status(404).json({
          success: false,
          message: 'Course not found. Please check if the playlist ID is valid.'
        });
      }
    }

    // Check if teacher already has a key for this course
    const existingKey = await CourseKey.findOne({
      teacherId,
      courseId: course.playlistId,
      isActive: true
    });

    if (existingKey) {
      return res.json({
        success: true,
        data: {
          key: existingKey.key,
          courseKey: {
            id: existingKey._id,
            key: existingKey.key,
            courseId: existingKey.courseId,
            courseTitle: existingKey.courseTitle,
            description: existingKey.description,
            usageCount: existingKey.usageCount,
            createdAt: existingKey.createdAt,
            expiresAt: existingKey.expiresAt
          },
          message: 'Course key already exists for this course'
        }
      });
    }

    // Generate unique key
    const key = await CourseKey.generateUniqueKey();

    // Create course key
    const courseKey = new CourseKey({
      key,
      teacherId,
      courseId: course.playlistId,
      courseTitle: course.title,
      courseThumbnail: course.thumbnail,
      description: description || '',
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      metadata: {
        createdBy: req.user.name,
        maxStudents: maxStudents || null
      }
    });

    await courseKey.save();

    res.status(201).json({
      success: true,
      data: {
        key: courseKey.key,
        courseKey: {
          id: courseKey._id,
          key: courseKey.key,
          courseId: courseKey.courseId,
          courseTitle: courseKey.courseTitle,
          courseThumbnail: courseKey.courseThumbnail,
          description: courseKey.description,
          usageCount: courseKey.usageCount,
          createdAt: courseKey.createdAt,
          expiresAt: courseKey.expiresAt
        }
      }
    });
  } catch (error) {
    console.error('Generate course key error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating course key'
    });
  }
});

/**
 * Get all course keys for a teacher
 */
const getTeacherCourseKeys = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;

  try {
    const courseKeys = await CourseKey.find({ teacherId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        courseKeys: courseKeys.map(ck => ({
          id: ck._id,
          key: ck.key,
          courseId: ck.courseId,
          courseTitle: ck.courseTitle,
          courseThumbnail: ck.courseThumbnail,
          description: ck.description,
          isActive: ck.isActive,
          usageCount: ck.usageCount,
          expiresAt: ck.expiresAt,
          createdAt: ck.createdAt,
          metadata: ck.metadata
        }))
      }
    });
  } catch (error) {
    console.error('Get teacher course keys error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching course keys'
    });
  }
});

/**
 * Get course by key (for students to access)
 */
const getCourseByKey = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const userId = req.user._id;

  if (!key) {
    return res.status(400).json({
      success: false,
      message: 'Course key is required'
    });
  }

  try {
    const courseKey = await CourseKey.findOne({
      key: key.toUpperCase(),
      isActive: true
    });

    if (!courseKey) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired course key'
      });
    }

    // Check if key has expired
    if (courseKey.expiresAt && new Date(courseKey.expiresAt) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'This course key has expired'
      });
    }

    // Check max students limit
    if (courseKey.metadata.maxStudents && courseKey.usageCount >= courseKey.metadata.maxStudents) {
      return res.status(400).json({
        success: false,
        message: 'This course key has reached its maximum student limit'
      });
    }

    // Get course details
    const course = await Course.findOne({ playlistId: courseKey.courseId });
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Track that this user accessed the course using this key
    let keyUsage = await CourseKeyUsage.findOne({
      courseKeyId: courseKey._id,
      userId: userId
    });

    if (!keyUsage) {
      // First time this user accesses via this key
      keyUsage = new CourseKeyUsage({
        courseKeyId: courseKey._id,
        userId: userId,
        courseId: courseKey.courseId,
        firstAccessedAt: new Date(),
        lastAccessedAt: new Date(),
        accessCount: 1
      });
      await keyUsage.save();
      
      // Increment usage count on the course key
      courseKey.usageCount += 1;
      await courseKey.save();
    } else {
      // Update last accessed time and increment access count
      keyUsage.lastAccessedAt = new Date();
      keyUsage.accessCount += 1;
      await keyUsage.save();
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
          metadata: course.metadata
        },
        courseKey: {
          key: courseKey.key,
          description: courseKey.description
        }
      }
    });
  } catch (error) {
    console.error('Get course by key error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching course by key'
    });
  }
});

/**
 * Get analytics for a course key (students who accessed via this key)
 */
const getCourseKeyAnalytics = asyncHandler(async (req, res) => {
  const { keyId } = req.params;
  const teacherId = req.user._id;

  try {
    const courseKey = await CourseKey.findOne({
      _id: keyId,
      teacherId
    });

    if (!courseKey) {
      return res.status(404).json({
        success: false,
        message: 'Course key not found'
      });
    }

    // Get all students who used THIS specific key to access the course
    const keyUsages = await CourseKeyUsage.find({
      courseKeyId: courseKey._id
    }).populate('userId', 'name email college department role');

    // Extract user IDs who used this key
    const keyUserIds = keyUsages
      .filter(ku => ku.userId && ku.userId.role === 'student')
      .map(ku => ku.userId._id);

    if (keyUserIds.length === 0) {
      // No students have used this key yet
      const course = await Course.findOne({ playlistId: courseKey.courseId });
      return res.json({
        success: true,
        data: {
          courseKey: {
            id: courseKey._id,
            key: courseKey.key,
            courseId: courseKey.courseId,
            courseTitle: courseKey.courseTitle,
            description: courseKey.description,
            usageCount: courseKey.usageCount,
            createdAt: courseKey.createdAt,
            expiresAt: courseKey.expiresAt
          },
          course: course ? {
            id: course._id,
            playlistId: course.playlistId,
            title: course.title,
            thumbnail: course.thumbnail,
            totalVideos: course.videos?.length || 0
          } : null,
          students: [],
          totalStudents: 0
        }
      });
    }

    // Get progress for only these students
    const progressList = await UserProgress.find({
      courseId: courseKey.courseId,
      userId: { $in: keyUserIds }
    }).populate('userId', 'name email college department role');

    // Get assessments for only these students
    const assessments = await Assessment.find({
      courseId: courseKey.courseId,
      status: 'completed',
      userId: { $in: keyUserIds }
    }).populate('userId', 'name email college department role');

    // Combine and get unique students (only those who used the key)
    const studentMap = new Map();

    progressList.forEach(p => {
      if (p.userId && p.userId.role === 'student') {
        const userId = p.userId._id.toString();
        if (!studentMap.has(userId)) {
          studentMap.set(userId, {
            userId: userId,
            name: p.userId.name,
            email: p.userId.email,
            college: p.userId.college || '',
            department: p.userId.department || '',
            progress: {
              totalVideos: p.totalVideos,
              completedVideos: p.completedVideos?.length || 0,
              completionPercentage: p.completionPercentage || 0,
              averageTestScore: p.averageTestScore || 0,
              totalWatchTime: p.totalWatchTime || 0,
              lastUpdated: p.lastUpdated
            },
            assessments: []
          });
        }
      }
    });

    assessments.forEach(a => {
      if (a.userId && a.userId.role === 'student') {
        const userId = a.userId._id.toString();
        if (!studentMap.has(userId)) {
          studentMap.set(userId, {
            userId: userId,
            name: a.userId.name,
            email: a.userId.email,
            college: a.userId.college || '',
            department: a.userId.department || '',
            progress: null,
            assessments: []
          });
        }
        studentMap.get(userId).assessments.push({
          id: a._id,
          videoId: a.videoId,
          videoTitle: a.videoTitle,
          testScore: a.testScore,
          cli: a.cli,
          cliClassification: a.cliClassification,
          createdAt: a.createdAt
        });
      }
    });

    // Include all students who used the key, even if they don't have progress yet
    keyUsages.forEach(ku => {
      if (ku.userId && ku.userId.role === 'student') {
        const userId = ku.userId._id.toString();
        if (!studentMap.has(userId)) {
          studentMap.set(userId, {
            userId: userId,
            name: ku.userId.name,
            email: ku.userId.email,
            college: ku.userId.college || '',
            department: ku.userId.department || '',
            progress: null,
            assessments: []
          });
        }
      }
    });

    const students = Array.from(studentMap.values()).filter(s => s.userId);

    // Calculate stats for each student
    const studentsWithStats = students.map(student => {
      const avgScore = student.assessments.length > 0
        ? student.assessments.reduce((sum, a) => sum + (a.testScore || 0), 0) / student.assessments.length
        : 0;

      const avgCLI = student.assessments.length > 0
        ? student.assessments.reduce((sum, a) => sum + (a.cli || 0), 0) / student.assessments.length
        : 0;

      return {
        ...student,
        stats: {
          totalAssessments: student.assessments.length,
          averageScore: Math.round(avgScore * 100) / 100,
          averageCLI: Math.round(avgCLI * 100) / 100
        }
      };
    });

    // Get course details
    const course = await Course.findOne({ playlistId: courseKey.courseId });

    res.json({
      success: true,
      data: {
        courseKey: {
          id: courseKey._id,
          key: courseKey.key,
          courseId: courseKey.courseId,
          courseTitle: courseKey.courseTitle,
          description: courseKey.description,
          usageCount: courseKey.usageCount,
          createdAt: courseKey.createdAt,
          expiresAt: courseKey.expiresAt
        },
        course: course ? {
          id: course._id,
          playlistId: course.playlistId,
          title: course.title,
          thumbnail: course.thumbnail,
          totalVideos: course.videos?.length || 0
        } : null,
        students: studentsWithStats,
        totalStudents: studentsWithStats.length
      }
    });
  } catch (error) {
    console.error('Get course key analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching course key analytics'
    });
  }
});

/**
 * Deactivate a course key
 */
const deactivateCourseKey = asyncHandler(async (req, res) => {
  const { keyId } = req.params;
  const teacherId = req.user._id;

  try {
    const courseKey = await CourseKey.findOne({
      _id: keyId,
      teacherId
    });

    if (!courseKey) {
      return res.status(404).json({
        success: false,
        message: 'Course key not found'
      });
    }

    courseKey.isActive = false;
    await courseKey.save();

    res.json({
      success: true,
      message: 'Course key deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate course key error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deactivating course key'
    });
  }
});

module.exports = {
  searchCourses,
  getCourseAnalytics,
  getCourseStudents,
  getStudentCourseProgress,
  getCollegesAndDepartments,
  generateCourseKey,
  getTeacherCourseKeys,
  getCourseByKey,
  getCourseKeyAnalytics,
  deactivateCourseKey
};

