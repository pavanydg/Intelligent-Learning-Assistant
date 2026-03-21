const { asyncHandler } = require('../middlewares/errorHandler');
const Classroom = require('../models/Classroom');
const Announcement = require('../models/Announcement');
const User = require('../models/User');

/**
 * Create a new classroom
 */
const createClassroom = asyncHandler(async (req, res) => {
  const { name, description, settings, metadata } = req.body;
  const teacherId = req.user._id || req.user.id;

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Classroom name is required'
    });
  }

  const classroom = new Classroom({
    name: name.trim(),
    description: description?.trim() || '',
    teacherId,
    settings: settings || {},
    metadata: metadata || {}
  });

  await classroom.save();

  res.status(201).json({
    success: true,
    message: 'Classroom created successfully',
    data: {
      classroom: {
        id: classroom._id,
        name: classroom.name,
        description: classroom.description,
        joinCode: classroom.joinCode,
        teacherId: classroom.teacherId,
        students: classroom.students,
        settings: classroom.settings,
        metadata: classroom.metadata,
        createdAt: classroom.createdAt
      }
    }
  });
});

/**
 * Get all classrooms for a teacher
 */
const getTeacherClassrooms = asyncHandler(async (req, res) => {
  const teacherId = req.user._id || req.user.id;

  const classrooms = await Classroom.find({ teacherId })
    .populate('students.studentId', 'name email')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: {
      classrooms: classrooms.map(c => ({
        id: c._id,
        name: c.name,
        description: c.description,
        joinCode: c.joinCode,
        studentCount: c.students.length,
        students: c.students,
        isActive: c.isActive,
        settings: c.settings,
        metadata: c.metadata,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }))
    }
  });
});

/**
 * Get all classrooms a student has joined
 */
const getStudentClassrooms = asyncHandler(async (req, res) => {
  const studentId = req.user._id || req.user.id;

  const classrooms = await Classroom.find({
    'students.studentId': studentId,
    isActive: true
  })
    .populate('teacherId', 'name email')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: {
      classrooms: classrooms.map(c => ({
        id: c._id,
        name: c.name,
        description: c.description,
        teacherName: c.teacherId?.name || 'Unknown',
        teacherEmail: c.teacherId?.email || '',
        joinedAt: c.students.find(s => s.studentId.toString() === studentId.toString())?.joinedAt,
        studentCount: c.students.length,
        metadata: c.metadata,
        createdAt: c.createdAt
      }))
    }
  });
});

/**
 * Get a single classroom by ID
 */
const getClassroom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id || req.user.id;
  const userRole = req.user.role;

  const classroom = await Classroom.findById(id)
    .populate('teacherId', 'name email')
    .populate('students.studentId', 'name email college department');

  if (!classroom) {
    return res.status(404).json({
      success: false,
      message: 'Classroom not found'
    });
  }

  // Check if user has access - convert both to strings for comparison
  const userIdStr = userId?.toString();
  const isTeacher = classroom.teacherId._id.toString() === userIdStr;
  const isStudent = classroom.students.some(s => s.studentId._id.toString() === userIdStr);

  if (!isTeacher && !isStudent && userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'You do not have access to this classroom'
    });
  }

  res.json({
    success: true,
    data: {
      classroom: {
        id: classroom._id,
        name: classroom.name,
        description: classroom.description,
        joinCode: isTeacher ? classroom.joinCode : undefined, // Only show to teacher
        teacherId: classroom.teacherId._id,
        teacherName: classroom.teacherId.name,
        teacherEmail: classroom.teacherId.email,
        students: classroom.students.map(s => ({
          studentId: s.studentId._id,
          name: s.studentId.name,
          email: s.studentId.email,
          college: s.studentId.college || '',
          department: s.studentId.department || '',
          joinedAt: s.joinedAt
        })),
        isActive: classroom.isActive,
        settings: classroom.settings,
        metadata: classroom.metadata,
        linkedCourses: classroom.linkedCourses || [],
        linkedQuizzes: classroom.linkedQuizzes || [],
        createdAt: classroom.createdAt,
        updatedAt: classroom.updatedAt
      }
    }
  });
});

/**
 * Join a classroom using join code
 */
const joinClassroom = asyncHandler(async (req, res) => {
  const { joinCode } = req.body;
  const studentId = req.user._id || req.user.id;

  if (!joinCode || !joinCode.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Join code is required'
    });
  }

  const classroom = await Classroom.findOne({ 
    joinCode: joinCode.trim().toUpperCase(),
    isActive: true
  });

  if (!classroom) {
    return res.status(404).json({
      success: false,
      message: 'Invalid join code or classroom not found'
    });
  }

  // Check if student is already in the classroom
  const alreadyJoined = classroom.students.some(
    s => s.studentId.toString() === studentId.toString()
  );

  if (alreadyJoined) {
    return res.status(400).json({
      success: false,
      message: 'You are already a member of this classroom'
    });
  }

  // Check if classroom allows joining
  if (!classroom.settings.allowStudentJoin) {
    return res.status(403).json({
      success: false,
      message: 'This classroom is not accepting new students'
    });
  }

  // Check max students limit
  if (classroom.settings.maxStudents && classroom.students.length >= classroom.settings.maxStudents) {
    return res.status(403).json({
      success: false,
      message: 'This classroom has reached its maximum capacity'
    });
  }

  // Get student info
  const student = await User.findById(studentId);
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }

  // Add student to classroom
  classroom.students.push({
    studentId: student._id,
    name: student.name,
    email: student.email,
    joinedAt: new Date()
  });

  await classroom.save();

  res.json({
    success: true,
    message: 'Successfully joined classroom',
    data: {
      classroom: {
        id: classroom._id,
        name: classroom.name,
        description: classroom.description,
        teacherName: (await User.findById(classroom.teacherId))?.name || 'Unknown'
      }
    }
  });
});

/**
 * Leave a classroom
 */
const leaveClassroom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const studentId = req.user._id || req.user.id;

  const classroom = await Classroom.findById(id);

  if (!classroom) {
    return res.status(404).json({
      success: false,
      message: 'Classroom not found'
    });
  }

  // Remove student from classroom
  classroom.students = classroom.students.filter(
    s => s.studentId.toString() !== studentId.toString()
  );

  await classroom.save();

  res.json({
    success: true,
    message: 'Successfully left classroom'
  });
});

/**
 * Update classroom (teacher only)
 */
const updateClassroom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const teacherId = req.user._id || req.user.id;
  const { name, description, settings, metadata, isActive } = req.body;

  const classroom = await Classroom.findById(id);

  if (!classroom) {
    return res.status(404).json({
      success: false,
      message: 'Classroom not found'
    });
  }

  // Convert both to strings for comparison
  const teacherIdStr = teacherId?.toString();
  if (classroom.teacherId.toString() !== teacherIdStr) {
    return res.status(403).json({
      success: false,
      message: 'You are not authorized to update this classroom'
    });
  }

  if (name) classroom.name = name.trim();
  if (description !== undefined) classroom.description = description.trim();
  if (settings) classroom.settings = { ...classroom.settings, ...settings };
  if (metadata) classroom.metadata = { ...classroom.metadata, ...metadata };
  if (isActive !== undefined) classroom.isActive = isActive;

  await classroom.save();

  res.json({
    success: true,
    message: 'Classroom updated successfully',
    data: {
      classroom: {
        id: classroom._id,
        name: classroom.name,
        description: classroom.description,
        joinCode: classroom.joinCode,
        settings: classroom.settings,
        metadata: classroom.metadata,
        isActive: classroom.isActive
      }
    }
  });
});

/**
 * Delete classroom (teacher only)
 */
const deleteClassroom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const teacherId = req.user._id || req.user.id;

  const classroom = await Classroom.findById(id);

  if (!classroom) {
    return res.status(404).json({
      success: false,
      message: 'Classroom not found'
    });
  }

  // Convert both to strings for comparison
  const teacherIdStr = teacherId?.toString();
  if (classroom.teacherId.toString() !== teacherIdStr) {
    return res.status(403).json({
      success: false,
      message: 'You are not authorized to delete this classroom'
    });
  }

  // Delete all announcements for this classroom
  await Announcement.deleteMany({ classroomId: id });

  // Delete classroom
  await Classroom.findByIdAndDelete(id);

  res.json({
    success: true,
    message: 'Classroom deleted successfully'
  });
});

/**
 * Create an announcement
 */
const createAnnouncement = asyncHandler(async (req, res) => {
  const { classroomId, title, content, isPinned, metadata } = req.body;
  const authorId = req.user._id || req.user.id;
  const authorName = req.user.name || 'Unknown';

  if (!classroomId || !title || !content) {
    return res.status(400).json({
      success: false,
      message: 'Classroom ID, title, and content are required'
    });
  }

  // Verify user is the teacher of this classroom
  const classroom = await Classroom.findById(classroomId);
  if (!classroom) {
    return res.status(404).json({
      success: false,
      message: 'Classroom not found'
    });
  }

  // Convert both to strings for comparison
  const authorIdStr = authorId?.toString();
  if (classroom.teacherId.toString() !== authorIdStr) {
    return res.status(403).json({
      success: false,
      message: 'Only the teacher can create announcements'
    });
  }

  const announcement = new Announcement({
    classroomId,
    title: title.trim(),
    content: content.trim(),
    authorId,
    authorName,
    isPinned: isPinned || false,
    metadata: metadata || {}
  });

  await announcement.save();

  res.status(201).json({
    success: true,
    message: 'Announcement created successfully',
    data: {
      announcement: {
        id: announcement._id,
        title: announcement.title,
        content: announcement.content,
        authorName: announcement.authorName,
        isPinned: announcement.isPinned,
        metadata: announcement.metadata,
        createdAt: announcement.createdAt
      }
    }
  });
});

/**
 * Get announcements for a classroom
 */
const getAnnouncements = asyncHandler(async (req, res) => {
  const { classroomId } = req.params;
  const userId = req.user._id || req.user.id;
  const userRole = req.user.role;

  // Verify user has access to this classroom
  const classroom = await Classroom.findById(classroomId);
  if (!classroom) {
    return res.status(404).json({
      success: false,
      message: 'Classroom not found'
    });
  }

  // Convert both to strings for comparison
  const userIdStr = userId?.toString();
  const isTeacher = classroom.teacherId.toString() === userIdStr;
  const isStudent = classroom.students.some(s => s.studentId.toString() === userIdStr);

  if (!isTeacher && !isStudent && userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'You do not have access to this classroom'
    });
  }

  // Get announcements, sorted by pinned first, then by date
  const announcements = await Announcement.find({ classroomId })
    .sort({ isPinned: -1, createdAt: -1 });

  res.json({
    success: true,
    data: {
      announcements: announcements.map(a => ({
        id: a._id,
        title: a.title,
        content: a.content,
        authorName: a.authorName,
        authorId: a.authorId,
        isPinned: a.isPinned,
        metadata: a.metadata,
        attachments: a.attachments,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt
      }))
    }
  });
});

/**
 * Update an announcement
 */
const updateAnnouncement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const authorId = req.user._id || req.user.id;
  const { title, content, isPinned, metadata } = req.body;

  const announcement = await Announcement.findById(id);
  if (!announcement) {
    return res.status(404).json({
      success: false,
      message: 'Announcement not found'
    });
  }

  // Convert both to strings for comparison
  const authorIdStr = authorId?.toString();
  if (announcement.authorId.toString() !== authorIdStr) {
    return res.status(403).json({
      success: false,
      message: 'You are not authorized to update this announcement'
    });
  }

  if (title) announcement.title = title.trim();
  if (content) announcement.content = content.trim();
  if (isPinned !== undefined) announcement.isPinned = isPinned;
  if (metadata) announcement.metadata = { ...announcement.metadata, ...metadata };

  await announcement.save();

  res.json({
    success: true,
    message: 'Announcement updated successfully',
    data: {
      announcement: {
        id: announcement._id,
        title: announcement.title,
        content: announcement.content,
        isPinned: announcement.isPinned,
        metadata: announcement.metadata
      }
    }
  });
});

/**
 * Delete an announcement
 */
const deleteAnnouncement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const authorId = req.user._id || req.user.id;

  const announcement = await Announcement.findById(id);
  if (!announcement) {
    return res.status(404).json({
      success: false,
      message: 'Announcement not found'
    });
  }

  // Convert both to strings for comparison
  const authorIdStr = authorId?.toString();
  if (announcement.authorId.toString() !== authorIdStr) {
    return res.status(403).json({
      success: false,
      message: 'You are not authorized to delete this announcement'
    });
  }

  await Announcement.findByIdAndDelete(id);

  res.json({
    success: true,
    message: 'Announcement deleted successfully'
  });
});

/**
 * Link a course to a classroom
 */
const linkCourse = asyncHandler(async (req, res) => {
  const { classroomId } = req.params;
  const { courseId } = req.body; // YouTube playlist ID
  const teacherId = req.user._id || req.user.id;
  const authorId = req.user._id || req.user.id;

  if (!courseId) {
    return res.status(400).json({
      success: false,
      message: 'Course ID is required'
    });
  }

  const classroom = await Classroom.findById(classroomId);
  if (!classroom) {
    return res.status(404).json({
      success: false,
      message: 'Classroom not found'
    });
  }

  // Verify user is the teacher
  const teacherIdStr = teacherId?.toString();
  if (classroom.teacherId.toString() !== teacherIdStr) {
    return res.status(403).json({
      success: false,
      message: 'Only the teacher can link courses to this classroom'
    });
  }

  // Check if course is already linked
  const alreadyLinked = classroom.linkedCourses.some(c => c.courseId === courseId);
  if (alreadyLinked) {
    return res.status(400).json({
      success: false,
      message: 'This course is already linked to the classroom'
    });
  }

  // Get course details
  const Course = require('../models/Course');
  const course = await Course.findOne({ playlistId: courseId });
  if (!course) {
    return res.status(404).json({
      success: false,
      message: 'Course not found'
    });
  }

  // Get or create course key
  const CourseKey = require('../models/CourseKey');
  let courseKey = await CourseKey.findOne({
    teacherId,
    courseId,
    isActive: true
  });

  if (!courseKey) {
    // Generate new course key
    const key = await CourseKey.generateUniqueKey();
    courseKey = new CourseKey({
      key,
      teacherId,
      courseId,
      courseTitle: course.title,
      courseThumbnail: course.thumbnail,
      description: `Course key for ${classroom.name}`
    });
    await courseKey.save();
  }

  // Add course to classroom
  classroom.linkedCourses.push({
    courseId,
    courseKey: courseKey.key,
    courseTitle: course.title,
    courseThumbnail: course.thumbnail
  });
  await classroom.save();

  // Create announcement
  const announcement = new Announcement({
    classroomId,
    title: `New Course: ${course.title}`,
    content: `A new course has been added to this classroom.\n\nCourse: ${course.title}\n\nTo access this course, use the following code:\n\n**Course Code: ${courseKey.key}**\n\nYou can use this code on the Search page to access the course.`,
    authorId,
    authorName: req.user.name || 'Teacher',
    isPinned: false,
    metadata: {
      type: 'course',
      courseId,
      courseKey: courseKey.key
    }
  });
  await announcement.save();

  res.json({
    success: true,
    message: 'Course linked successfully',
    data: {
      course: {
        courseId,
        courseKey: courseKey.key,
        courseTitle: course.title,
        courseThumbnail: course.thumbnail
      },
      announcement: {
        id: announcement._id,
        title: announcement.title
      }
    }
  });
});

/**
 * Link a quiz to a classroom
 */
const linkQuiz = asyncHandler(async (req, res) => {
  const { classroomId } = req.params;
  const { quizId } = req.body;
  const teacherId = req.user._id || req.user.id;
  const authorId = req.user._id || req.user.id;

  if (!quizId) {
    return res.status(400).json({
      success: false,
      message: 'Quiz ID is required'
    });
  }

  const classroom = await Classroom.findById(classroomId);
  if (!classroom) {
    return res.status(404).json({
      success: false,
      message: 'Classroom not found'
    });
  }

  // Verify user is the teacher
  const teacherIdStr = teacherId?.toString();
  if (classroom.teacherId.toString() !== teacherIdStr) {
    return res.status(403).json({
      success: false,
      message: 'Only the teacher can link quizzes to this classroom'
    });
  }

  // Get quiz details
  const Quiz = require('../models/Quiz');
  const quiz = await Quiz.findById(quizId);
  if (!quiz) {
    return res.status(404).json({
      success: false,
      message: 'Quiz not found'
    });
  }

  // Verify quiz belongs to teacher
  if (quiz.teacherId.toString() !== teacherIdStr) {
    return res.status(403).json({
      success: false,
      message: 'You can only link your own quizzes'
    });
  }

  // Get or create quiz key
  const QuizKey = require('../models/QuizKey');
  let quizKey = await QuizKey.findOne({
    teacherId,
    quizId,
    isActive: true
  });

  if (!quizKey) {
    // Generate new quiz key
    const key = await QuizKey.generateUniqueKey();
    quizKey = new QuizKey({
      key,
      teacherId,
      quizId,
      description: `Quiz key for ${classroom.name}`
    });
    await quizKey.save();
  }

  // Add quiz to classroom only if not already in linkedQuizzes
  const alreadyInLinkedQuizzes = classroom.linkedQuizzes.some(q => q.quizId.toString() === quizId);
  if (!alreadyInLinkedQuizzes) {
    classroom.linkedQuizzes.push({
      quizId,
      quizKey: quizKey.key,
      quizTitle: quiz.title
    });
    await classroom.save();
  }

  // Create announcement
  const announcement = new Announcement({
    classroomId,
    title: `New Quiz: ${quiz.title}`,
    content: `A new quiz has been added to this classroom.\n\nQuiz: ${quiz.title}\n\nTo access this quiz, use the following code:\n\n**Quiz Code: ${quizKey.key}**\n\nYou can use this code on the Quiz page to take the quiz.`,
    authorId,
    authorName: req.user.name || 'Teacher',
    isPinned: false,
    metadata: {
      type: 'quiz',
      quizId: quizId.toString(),
      quizKey: quizKey.key
    }
  });
  await announcement.save();

  res.json({
    success: true,
    message: 'Quiz linked successfully',
    data: {
      quiz: {
        quizId,
        quizKey: quizKey.key,
        quizTitle: quiz.title
      },
      announcement: {
        id: announcement._id,
        title: announcement.title
      }
    }
  });
});

/**
 * Unlink a course from a classroom
 */
const unlinkCourse = asyncHandler(async (req, res) => {
  const { classroomId } = req.params;
  const { courseKey } = req.body;
  const teacherId = req.user._id || req.user.id;

  if (!courseKey) {
    return res.status(400).json({
      success: false,
      message: 'Course key is required'
    });
  }

  const classroom = await Classroom.findById(classroomId);
  if (!classroom) {
    return res.status(404).json({
      success: false,
      message: 'Classroom not found'
    });
  }

  // Verify user is the teacher
  const teacherIdStr = teacherId?.toString();
  if (classroom.teacherId.toString() !== teacherIdStr) {
    return res.status(403).json({
      success: false,
      message: 'Only the teacher can unlink courses from this classroom'
    });
  }

  // Find and remove the course from linkedCourses
  const courseIndex = classroom.linkedCourses.findIndex(
    course => course.courseKey === courseKey
  );

  if (courseIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Course not found in this classroom'
    });
  }

  const removedCourse = classroom.linkedCourses[courseIndex];
  classroom.linkedCourses.splice(courseIndex, 1);
  await classroom.save();

  // Optionally delete related announcements (optional - you may want to keep them for history)
  // For now, we'll leave announcements as they provide historical context

  res.json({
    success: true,
    message: 'Course unlinked successfully',
    data: {
      course: {
        courseId: removedCourse.courseId,
        courseKey: removedCourse.courseKey,
        courseTitle: removedCourse.courseTitle
      }
    }
  });
});

/**
 * Unlink a quiz from a classroom
 */
const unlinkQuiz = asyncHandler(async (req, res) => {
  const { classroomId } = req.params;
  const { quizKey } = req.body;
  const teacherId = req.user._id || req.user.id;

  if (!quizKey) {
    return res.status(400).json({
      success: false,
      message: 'Quiz key is required'
    });
  }

  const classroom = await Classroom.findById(classroomId);
  if (!classroom) {
    return res.status(404).json({
      success: false,
      message: 'Classroom not found'
    });
  }

  // Verify user is the teacher
  const teacherIdStr = teacherId?.toString();
  if (classroom.teacherId.toString() !== teacherIdStr) {
    return res.status(403).json({
      success: false,
      message: 'Only the teacher can unlink quizzes from this classroom'
    });
  }

  // Find and remove the quiz from linkedQuizzes
  const quizIndex = classroom.linkedQuizzes.findIndex(
    quiz => quiz.quizKey === quizKey
  );

  if (quizIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Quiz not found in this classroom'
    });
  }

  const removedQuiz = classroom.linkedQuizzes[quizIndex];
  classroom.linkedQuizzes.splice(quizIndex, 1);
  await classroom.save();

  // Optionally delete related announcements (optional - you may want to keep them for history)
  // For now, we'll leave announcements as they provide historical context

  res.json({
    success: true,
    message: 'Quiz unlinked successfully',
    data: {
      quiz: {
        quizId: removedQuiz.quizId,
        quizKey: removedQuiz.quizKey,
        quizTitle: removedQuiz.quizTitle
      }
    }
  });
});

module.exports = {
  createClassroom,
  getTeacherClassrooms,
  getStudentClassrooms,
  getClassroom,
  joinClassroom,
  leaveClassroom,
  updateClassroom,
  deleteClassroom,
  createAnnouncement,
  getAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
  linkCourse,
  linkQuiz,
  unlinkCourse,
  unlinkQuiz
};

