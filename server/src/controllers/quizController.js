const { asyncHandler } = require('../middlewares/errorHandler');
const Quiz = require('../models/Quiz');
const QuizKey = require('../models/QuizKey');
const QuizAttempt = require('../models/QuizAttempt');
const QuizKeyUsage = require('../models/QuizKeyUsage');
const pdfParserService = require('../services/pdfParserService');
const geminiService = require('../services/geminiService');
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and text files are allowed'), false);
    }
  }
});

/**
 * Create a new quiz
 */
const createQuiz = asyncHandler(async (req, res) => {
  const { title, description, questions, timeLimit, passingScore, allowMultipleAttempts, showResults, scheduledStartTime, scheduledEndTime, metadata } = req.body;
  const teacherId = req.user._id;

  if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Title and at least one question are required'
    });
  }

  try {
    const quiz = new Quiz({
      title,
      description: description || '',
      teacherId,
      questions,
      timeLimit: timeLimit || 0,
      passingScore: passingScore || 60,
      allowMultipleAttempts: allowMultipleAttempts || false,
      showResults: showResults !== undefined ? showResults : true,
      scheduledStartTime: scheduledStartTime ? new Date(scheduledStartTime) : null,
      scheduledEndTime: scheduledEndTime ? new Date(scheduledEndTime) : null,
      metadata: metadata || {}
    });

    await quiz.save();

    res.status(201).json({
      success: true,
      data: {
        quiz: {
          id: quiz._id,
          title: quiz.title,
          description: quiz.description,
          questions: quiz.questions,
          totalPoints: quiz.totalPoints,
          timeLimit: quiz.timeLimit,
          passingScore: quiz.passingScore,
          createdAt: quiz.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating quiz'
    });
  }
});

/**
 * Update a quiz (allows editing any quiz owned by the teacher)
 */
const updateQuiz = asyncHandler(async (req, res) => {
  const { quizId } = req.params;
  const { title, description, questions, timeLimit, passingScore, allowMultipleAttempts, showResults, scheduledStartTime, scheduledEndTime, isDraft, isActive } = req.body;
  const teacherId = req.user._id;

  if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Title and at least one question are required'
    });
  }

  try {
    const quiz = await Quiz.findOne({ _id: quizId, teacherId });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // Update quiz fields
    quiz.title = title;
    quiz.description = description || '';
    quiz.questions = questions;
    quiz.timeLimit = timeLimit || 0;
    quiz.passingScore = passingScore || 60;
    quiz.allowMultipleAttempts = allowMultipleAttempts || false;
    quiz.showResults = showResults !== undefined ? showResults : true;
    quiz.scheduledStartTime = scheduledStartTime ? new Date(scheduledStartTime) : null;
    quiz.scheduledEndTime = scheduledEndTime ? new Date(scheduledEndTime) : null;
    
    if (isDraft !== undefined) {
      quiz.isDraft = isDraft;
    }
    if (isActive !== undefined) {
      quiz.isActive = isActive;
    }

    await quiz.save();

    res.json({
      success: true,
      data: {
        quiz: {
          id: quiz._id,
          title: quiz.title,
          description: quiz.description,
          questions: quiz.questions,
          totalPoints: quiz.totalPoints,
          timeLimit: quiz.timeLimit,
          passingScore: quiz.passingScore,
          isDraft: quiz.isDraft,
          isActive: quiz.isActive,
          updatedAt: quiz.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating quiz'
    });
  }
});

/**
 * Get all quizzes for a teacher
 */
const getTeacherQuizzes = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;

  try {
    const quizzes = await Quiz.find({ teacherId })
      .sort({ createdAt: -1 })
      .select('title description totalPoints timeLimit passingScore isActive createdAt');

    // Get attempt counts for each quiz
    const quizzesWithStats = await Promise.all(quizzes.map(async (quiz) => {
      const attemptCount = await QuizAttempt.countDocuments({ 
        quizId: quiz._id,
        status: 'completed'
      });
      
      const keyCount = await QuizKey.countDocuments({ 
        quizId: quiz._id,
        isActive: true
      });

      return {
        id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        totalPoints: quiz.totalPoints,
        timeLimit: quiz.timeLimit,
        passingScore: quiz.passingScore,
        isActive: quiz.isActive,
        attemptCount,
        keyCount,
        createdAt: quiz.createdAt
      };
    }));

    res.json({
      success: true,
      data: {
        quizzes: quizzesWithStats
      }
    });
  } catch (error) {
    console.error('Get teacher quizzes error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quizzes'
    });
  }
});

/**
 * Get a single quiz by ID
 */
const getQuiz = asyncHandler(async (req, res) => {
  const { quizId } = req.params;
  const userId = req.user._id;
  const userRole = req.user.role;

  try {
    const quiz = await Quiz.findById(quizId);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // Teachers can see all details, students see questions without correct answers
    if (userRole === 'instructor' || userRole === 'admin' || quiz.teacherId.toString() === userId.toString()) {
      // Teacher view - show everything
      res.json({
        success: true,
        data: { quiz }
      });
    } else {
      // Student view - hide correct answers
      const studentQuiz = {
        ...quiz.toObject(),
        questions: quiz.questions.map(q => ({
          _id: q._id,
          question: q.question,
          type: q.type,
          options: q.type === 'multiple-choice' 
            ? q.options.map(opt => ({ text: opt.text })) // Hide isCorrect
            : q.options,
          points: q.points
          // Don't include correctAnswer or explanation
        }))
      };
      res.json({
        success: true,
        data: { quiz: studentQuiz }
      });
    }
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quiz'
    });
  }
});

/**
 * Generate a quiz key
 */
const generateQuizKey = asyncHandler(async (req, res) => {
  const { quizId, description, expiresAt, maxStudents, maxAttempts } = req.body;
  const teacherId = req.user._id;

  if (!quizId) {
    return res.status(400).json({
      success: false,
      message: 'Quiz ID is required'
    });
  }

  try {
    const quiz = await Quiz.findOne({ _id: quizId, teacherId });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // Check if teacher already has an active key for this quiz
    const existingKey = await QuizKey.findOne({
      teacherId,
      quizId,
      isActive: true
    });

    if (existingKey) {
      return res.json({
        success: true,
        data: {
          key: existingKey.key,
          quizKey: {
            id: existingKey._id,
            key: existingKey.key,
            quizId: existingKey.quizId,
            description: existingKey.description,
            usageCount: existingKey.usageCount,
            createdAt: existingKey.createdAt,
            expiresAt: existingKey.expiresAt
          },
          message: 'Quiz key already exists for this quiz'
        }
      });
    }

    // Generate unique key
    const key = await QuizKey.generateUniqueKey();

    // Create quiz key
    const quizKey = new QuizKey({
      key,
      quizId,
      teacherId,
      description: description || '',
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      maxAttempts: maxAttempts || null,
      metadata: {
        createdBy: req.user.name,
        maxStudents: maxStudents || null
      }
    });

    await quizKey.save();

    res.status(201).json({
      success: true,
      data: {
        key: quizKey.key,
        quizKey: {
          id: quizKey._id,
          key: quizKey.key,
          quizId: quizKey.quizId,
          description: quizKey.description,
          usageCount: quizKey.usageCount,
          createdAt: quizKey.createdAt,
          expiresAt: quizKey.expiresAt
        }
      }
    });
  } catch (error) {
    console.error('Generate quiz key error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating quiz key'
    });
  }
});

/**
 * Get quiz by key (for students)
 */
const getQuizByKey = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const userId = req.user._id;

  if (!key) {
    return res.status(400).json({
      success: false,
      message: 'Quiz key is required'
    });
  }

  try {
    const quizKey = await QuizKey.findOne({
      key: key.toUpperCase(),
      isActive: true
    }).populate('quizId');

    if (!quizKey || !quizKey.quizId) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired quiz key'
      });
    }

    // Check if key has expired
    if (quizKey.expiresAt && new Date(quizKey.expiresAt) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'This quiz key has expired'
      });
    }

    // Check max students limit
    if (quizKey.metadata.maxStudents && quizKey.usageCount >= quizKey.metadata.maxStudents) {
      return res.status(400).json({
        success: false,
        message: 'This quiz key has reached its maximum student limit'
      });
    }

    const quiz = quizKey.quizId;

    // Check scheduled start time
    const now = new Date();
    if (quiz.scheduledStartTime && new Date(quiz.scheduledStartTime) > now) {
      return res.status(400).json({
        success: false,
        message: `This quiz is not available yet. It will be available starting ${new Date(quiz.scheduledStartTime).toLocaleString()}`
      });
    }

    // Check scheduled end time
    if (quiz.scheduledEndTime && new Date(quiz.scheduledEndTime) < now) {
      return res.status(400).json({
        success: false,
        message: `This quiz is no longer available. It ended on ${new Date(quiz.scheduledEndTime).toLocaleString()}`
      });
    }

    // Check if student already has an attempt
    const existingAttempt = await QuizAttempt.findOne({
      quizId: quiz._id,
      quizKeyId: quizKey._id,
      userId,
      status: { $in: ['in-progress', 'completed'] }
    });

    // Check if multiple attempts are allowed
    if (existingAttempt && !quiz.allowMultipleAttempts && existingAttempt.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'You have already completed this quiz and multiple attempts are not allowed'
      });
    }

    // Track key usage
    let keyUsage = await QuizKeyUsage.findOne({
      quizKeyId: quizKey._id,
      userId
    });

    if (!keyUsage) {
      keyUsage = new QuizKeyUsage({
        quizKeyId: quizKey._id,
        userId,
        quizId: quiz._id.toString(),
        firstAccessedAt: new Date(),
        lastAccessedAt: new Date(),
        accessCount: 1
      });
      await keyUsage.save();
      
      quizKey.usageCount += 1;
      await quizKey.save();
    } else {
      keyUsage.lastAccessedAt = new Date();
      keyUsage.accessCount += 1;
      await keyUsage.save();
    }

    // Return quiz without correct answers for students
    const studentQuiz = {
      ...quiz.toObject(),
      questions: quiz.questions.map(q => ({
        _id: q._id,
        question: q.question,
        type: q.type,
        options: q.type === 'multiple-choice' 
          ? q.options.map(opt => ({ text: opt.text }))
          : q.options,
        points: q.points
      }))
    };

    res.json({
      success: true,
      data: {
        quiz: studentQuiz,
        quizKey: {
          id: quizKey._id,
          key: quizKey.key,
          description: quizKey.description,
          maxAttempts: quizKey.maxAttempts
        },
        existingAttempt: existingAttempt ? {
          id: existingAttempt._id,
          status: existingAttempt.status,
          score: existingAttempt.score,
          percentage: existingAttempt.percentage
        } : null
      }
    });
  } catch (error) {
    console.error('Get quiz by key error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quiz by key'
    });
  }
});

/**
 * Submit quiz attempt
 */
const submitQuizAttempt = asyncHandler(async (req, res) => {
  const { quizId, quizKeyId, answers, timeSpent } = req.body;
  const userId = req.user._id;

  if (!quizId || !quizKeyId || !answers || !Array.isArray(answers)) {
    return res.status(400).json({
      success: false,
      message: 'Quiz ID, key ID, and answers are required'
    });
  }

  try {
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    const quizKey = await QuizKey.findById(quizKeyId);
    if (!quizKey || !quizKey.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Invalid quiz key'
      });
    }

    // Check if attempt already exists
    let attempt = await QuizAttempt.findOne({
      quizId,
      quizKeyId,
      userId,
      status: 'in-progress'
    });

    if (!attempt) {
      // Check if multiple attempts are allowed
      const completedAttempts = await QuizAttempt.countDocuments({
        quizId,
        quizKeyId,
        userId,
        status: 'completed'
      });

      if (completedAttempts > 0 && !quiz.allowMultipleAttempts) {
        return res.status(400).json({
          success: false,
          message: 'Multiple attempts are not allowed for this quiz'
        });
      }

      if (quizKey.maxAttempts && completedAttempts >= quizKey.maxAttempts) {
        return res.status(400).json({
          success: false,
          message: 'Maximum attempts reached for this quiz'
        });
      }

      attempt = new QuizAttempt({
        quizId,
        quizKeyId,
        userId,
        startedAt: new Date(),
        status: 'in-progress'
      });
    }

    // Grade the answers
    let totalPointsEarned = 0;
    const gradedAnswers = answers.map(answerData => {
      const question = quiz.questions.id(answerData.questionId);
      if (!question) return null;

      let isCorrect = false;
      let earnedPoints = 0;
      const pointsPossible = question.points || 1;

      if (question.type === 'multiple-choice') {
        // Find the selected option - compare by text (normalized)
        const normalizeText = (text) => text.trim().toLowerCase();
        const normalizedAnswer = normalizeText(answerData.answer);
        const selectedOption = question.options.find(opt => 
          normalizeText(opt.text) === normalizedAnswer
        );
        isCorrect = selectedOption ? selectedOption.isCorrect : false;
      } else if (question.type === 'true-false') {
        // Normalize comparison for true-false
        const normalizeAnswer = (ans) => ans.trim().toLowerCase();
        isCorrect = normalizeAnswer(answerData.answer) === normalizeAnswer(question.correctAnswer);
      } else if (question.type === 'short-answer') {
        // Simple case-insensitive comparison for short answer
        const normalizeAnswer = (ans) => ans.trim().toLowerCase();
        isCorrect = normalizeAnswer(answerData.answer) === normalizeAnswer(question.correctAnswer);
      }

      if (isCorrect) {
        earnedPoints = pointsPossible;
        totalPointsEarned += earnedPoints;
      }

      return {
        questionId: answerData.questionId,
        answer: answerData.answer,
        isCorrect,
        pointsEarned: earnedPoints, // Points earned for THIS question only
        pointsPossible: pointsPossible // Points possible for THIS question
      };
    }).filter(a => a !== null);

    attempt.answers = gradedAnswers;
    attempt.pointsEarned = totalPointsEarned;
    attempt.totalPoints = quiz.totalPoints;
    attempt.score = totalPointsEarned;
    attempt.percentage = quiz.totalPoints > 0 ? Math.round((totalPointsEarned / quiz.totalPoints) * 100) : 0;
    attempt.timeSpent = timeSpent || 0;
    attempt.submittedAt = new Date();
    attempt.status = 'completed';
    attempt.passed = attempt.percentage >= quiz.passingScore;

    await attempt.save();

    // Return results based on quiz settings
    const response = {
      success: true,
      data: {
        attempt: {
          id: attempt._id,
          score: attempt.score,
          totalPoints: attempt.totalPoints,
          percentage: attempt.percentage,
          passed: attempt.passed,
          timeSpent: attempt.timeSpent,
          submittedAt: attempt.submittedAt
        }
      }
    };

    if (quiz.showResults) {
      // Include detailed results with correct answers
      response.data.answers = gradedAnswers.map(a => {
        const question = quiz.questions.id(a.questionId);
        return {
          questionId: a.questionId,
          question: question.question,
          yourAnswer: a.answer,
          isCorrect: a.isCorrect,
          correctAnswer: question.type === 'multiple-choice'
            ? question.options.find(opt => opt.isCorrect)?.text
            : question.correctAnswer,
          pointsEarned: a.pointsEarned,
          pointsPossible: a.pointsPossible,
          explanation: question.explanation
        };
      });
    }

    res.json(response);
  } catch (error) {
    console.error('Submit quiz attempt error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting quiz attempt'
    });
  }
});

/**
 * Get quiz analytics
 */
const getQuizAnalytics = asyncHandler(async (req, res) => {
  const { quizId } = req.params;
  const teacherId = req.user._id;

  try {
    const quiz = await Quiz.findOne({ _id: quizId, teacherId });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // Get all attempts for this quiz
    const attempts = await QuizAttempt.find({
      quizId,
      status: 'completed'
    }).populate('userId', 'name email college department');

    // Get all students who used keys for this quiz
    const keyUsages = await QuizKeyUsage.find({
      quizId: quizId.toString()
    }).populate('userId', 'name email college department role');

    const keyUserIds = keyUsages
      .filter(ku => ku.userId && ku.userId.role === 'student')
      .map(ku => ku.userId._id);

    // Filter attempts to only include students who used a key
    const studentAttempts = attempts.filter(a => 
      keyUserIds.some(id => id.toString() === a.userId._id.toString())
    );

    // Calculate statistics
    const totalAttempts = studentAttempts.length;
    const averageScore = totalAttempts > 0
      ? studentAttempts.reduce((sum, a) => sum + a.percentage, 0) / totalAttempts
      : 0;
    const passRate = totalAttempts > 0
      ? (studentAttempts.filter(a => a.passed).length / totalAttempts) * 100
      : 0;

    // Question analysis
    const questionStats = quiz.questions.map(question => {
      const questionAttempts = studentAttempts.filter(a => 
        a.answers.some(ans => ans.questionId.toString() === question._id.toString())
      );
      const correctCount = questionAttempts.filter(a => {
        const answer = a.answers.find(ans => ans.questionId.toString() === question._id.toString());
        return answer && answer.isCorrect;
      }).length;
      
      return {
        questionId: question._id,
        question: question.question,
        correctCount,
        totalAttempts: questionAttempts.length,
        accuracy: questionAttempts.length > 0 ? (correctCount / questionAttempts.length) * 100 : 0
      };
    });

    // Student performance
    const studentMap = new Map();
    studentAttempts.forEach(attempt => {
      const userId = attempt.userId._id.toString();
      if (!studentMap.has(userId)) {
        studentMap.set(userId, {
          userId,
          name: attempt.userId.name,
          email: attempt.userId.email,
          college: attempt.userId.college || '',
          department: attempt.userId.department || '',
          attempts: []
        });
      }
      studentMap.get(userId).attempts.push({
        id: attempt._id,
        score: attempt.score,
        percentage: attempt.percentage,
        passed: attempt.passed,
        timeSpent: attempt.timeSpent,
        submittedAt: attempt.submittedAt
      });
    });

    const students = Array.from(studentMap.values()).map(student => ({
      ...student,
      bestScore: Math.max(...student.attempts.map(a => a.percentage)),
      averageScore: student.attempts.reduce((sum, a) => sum + a.percentage, 0) / student.attempts.length,
      totalAttempts: student.attempts.length
    }));

    res.json({
      success: true,
      data: {
        quiz: {
          id: quiz._id,
          title: quiz.title,
          totalPoints: quiz.totalPoints,
          passingScore: quiz.passingScore,
          totalQuestions: quiz.questions.length
        },
        statistics: {
          totalAttempts,
          uniqueStudents: students.length,
          averageScore: Math.round(averageScore * 100) / 100,
          passRate: Math.round(passRate * 100) / 100
        },
        questionStats,
        students
      }
    });
  } catch (error) {
    console.error('Get quiz analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quiz analytics'
    });
  }
});

/**
 * Get all quiz keys for a teacher
 */
const getTeacherQuizKeys = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;

  try {
    const quizKeys = await QuizKey.find({ teacherId })
      .populate('quizId', 'title totalPoints')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        quizKeys: quizKeys.map(qk => ({
          id: qk._id,
          key: qk.key,
          quizId: qk.quizId._id,
          quizTitle: qk.quizId.title,
          description: qk.description,
          isActive: qk.isActive,
          usageCount: qk.usageCount,
          expiresAt: qk.expiresAt,
          createdAt: qk.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Get teacher quiz keys error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quiz keys'
    });
  }
});

/**
 * Get a specific quiz attempt with full details
 */
const getQuizAttemptDetails = asyncHandler(async (req, res) => {
  const { attemptId } = req.params;
  const userId = req.user._id;

  try {
    const attempt = await QuizAttempt.findOne({
      _id: attemptId,
      userId,
      status: 'completed'
    })
      .populate({
        path: 'quizId',
        select: 'title description questions totalPoints passingScore teacherId',
        populate: {
          path: 'teacherId',
          select: 'name email'
        }
      })
      .populate('quizKeyId', 'key description');

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Quiz attempt not found'
      });
    }

    // Map answers with question details
    const detailedAnswers = attempt.answers.map(answerData => {
      const question = attempt.quizId.questions.id(answerData.questionId);
      if (!question) return null;

      let correctAnswerText = '';
      if (question.type === 'multiple-choice') {
        const correctOption = question.options.find(opt => opt.isCorrect);
        correctAnswerText = correctOption ? correctOption.text.trim() : '';
      } else {
        correctAnswerText = (question.correctAnswer || '').trim();
      }
      
      // Normalize the student's answer for comparison display
      const studentAnswer = (answerData.answer || '').trim();

      return {
        questionId: answerData.questionId,
        question: question.question,
        questionType: question.type,
        yourAnswer: answerData.answer,
        correctAnswer: correctAnswerText,
        isCorrect: answerData.isCorrect,
        pointsEarned: answerData.pointsEarned,
        pointsPossible: answerData.pointsPossible,
        explanation: question.explanation || ''
      };
    }).filter(a => a !== null);

    res.json({
      success: true,
      data: {
        attempt: {
          id: attempt._id,
          quizId: attempt.quizId._id,
          quizTitle: attempt.quizId.title,
          quizDescription: attempt.quizId.description,
          teacherName: attempt.quizId.teacherId?.name || 'Unknown',
          teacherEmail: attempt.quizId.teacherId?.email || '',
          quizKey: attempt.quizKeyId?.key || '',
          score: attempt.score,
          totalPoints: attempt.totalPoints,
          percentage: attempt.percentage,
          passed: attempt.passed,
          timeSpent: attempt.timeSpent,
          submittedAt: attempt.submittedAt,
          passingScore: attempt.quizId.passingScore
        },
        answers: detailedAnswers
      }
    });
  } catch (error) {
    console.error('Get quiz attempt details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quiz attempt details'
    });
  }
});

/**
 * Get student's quiz attempts/history
 */
const getStudentQuizHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  try {
    // Get all completed quiz attempts for this student
    const attempts = await QuizAttempt.find({
      userId,
      status: 'completed'
    })
      .populate({
        path: 'quizId',
        select: 'title description totalPoints passingScore teacherId',
        populate: {
          path: 'teacherId',
          select: 'name email'
        }
      })
      .populate('quizKeyId', 'key description')
      .sort({ submittedAt: -1 });

    const history = attempts.map(attempt => ({
      id: attempt._id,
      quizId: attempt.quizId._id,
      quizTitle: attempt.quizId.title,
      quizDescription: attempt.quizId.description,
      teacherName: attempt.quizId.teacherId?.name || 'Unknown',
      teacherEmail: attempt.quizId.teacherId?.email || '',
      quizKey: attempt.quizKeyId?.key || '',
      score: attempt.score,
      totalPoints: attempt.totalPoints,
      percentage: attempt.percentage,
      passed: attempt.passed,
      timeSpent: attempt.timeSpent,
      submittedAt: attempt.submittedAt,
      passingScore: attempt.quizId.passingScore
    }));

    res.json({
      success: true,
      data: {
        history,
        totalAttempts: history.length,
        passedCount: history.filter(h => h.passed).length,
        averageScore: history.length > 0
          ? Math.round(history.reduce((sum, h) => sum + h.percentage, 0) / history.length)
          : 0
      }
    });
  } catch (error) {
    console.error('Get student quiz history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quiz history'
    });
  }
});

/**
 * Generate quiz questions using Gemini AI
 */
const generateQuestions = asyncHandler(async (req, res) => {
  const { description, numQuestions, difficulty } = req.body;
  const notesFile = req.file;

  if (!description || !numQuestions) {
    return res.status(400).json({
      success: false,
      message: 'Description and number of questions are required'
    });
  }

  if (numQuestions < 1 || numQuestions > 50) {
    return res.status(400).json({
      success: false,
      message: 'Number of questions must be between 1 and 50'
    });
  }

  try {
    let notesText = null;

    // Extract text from uploaded file if provided
    if (notesFile) {
      if (notesFile.mimetype === 'application/pdf') {
        const result = await pdfParserService.parsePDF(notesFile.buffer);
        notesText = result.questions.map(q => q.question).join('\n');
        // Also try to get raw text from PDF for better context
        try {
          const pdfParseModule = require('pdf-parse');
          const pdfParse = pdfParseModule.PDFParse;
          const parser = new pdfParse({ data: notesFile.buffer });
          const pdfResult = await parser.getText();
          const fullText = pdfResult.text || pdfResult;
          // Use full text if available, otherwise use parsed questions
          if (fullText && fullText.length > notesText.length) {
            notesText = fullText;
          }
        } catch (pdfError) {
          console.warn('Could not extract full text from PDF, using parsed questions only');
        }
      } else if (notesFile.mimetype === 'text/plain') {
        notesText = notesFile.buffer.toString('utf-8');
      }
    }

    // Generate questions using Gemini
    const questions = await geminiService.generateQuizQuestions(
      description,
      parseInt(numQuestions),
      difficulty || 'intermediate',
      notesText
    );

    // Format questions for database
    const formattedQuestions = questions.map(q => ({
      question: q.question,
      type: q.type || 'multiple-choice',
      options: q.options || [],
      points: q.points || 1,
      explanation: q.explanation || ''
    }));

    // Map frontend difficulty to model enum values
    const difficultyMap = {
      'beginner': 'easy',
      'intermediate': 'medium',
      'advanced': 'hard'
    };
    const mappedDifficulty = difficultyMap[difficulty?.toLowerCase()] || 'medium';

    // Create a draft quiz with generated questions
    const draftQuiz = new Quiz({
      title: `Draft: ${description.substring(0, 50)}${description.length > 50 ? '...' : ''}`,
      description: `Auto-generated quiz based on: ${description}`,
      teacherId: req.user._id,
      questions: formattedQuestions,
      timeLimit: 0,
      passingScore: 60,
      allowMultipleAttempts: false,
      showResults: true,
      isActive: false,
      isDraft: true,
      metadata: {
        generatedFrom: description,
        difficulty: mappedDifficulty,
        generatedAt: new Date()
      }
    });

    await draftQuiz.save();

    res.json({
      success: true,
      data: {
        quizId: draftQuiz._id,
        questions: formattedQuestions,
        totalQuestions: formattedQuestions.length,
        quiz: {
          id: draftQuiz._id,
          title: draftQuiz.title,
          description: draftQuiz.description,
          questions: draftQuiz.questions,
          totalPoints: draftQuiz.totalPoints,
          timeLimit: draftQuiz.timeLimit,
          passingScore: draftQuiz.passingScore,
          isDraft: draftQuiz.isDraft
        }
      }
    });
  } catch (error) {
    console.error('Generate questions error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating questions'
    });
  }
});

/**
 * Parse PDF and extract quiz questions
 */
const parsePDF = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No PDF file uploaded'
    });
  }

  try {
    const result = await pdfParserService.parsePDF(req.file.buffer);
    
    // Validate questions
    const validation = pdfParserService.validateQuestions(result.questions);
    
    // If no questions were parsed at all, provide helpful error message
    if (result.questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No questions found in PDF. Please check the format.',
        data: {
          questions: [],
          errors: [
            'No questions could be parsed from the PDF.',
            'Expected format:',
            'Question 1: [Question text]',
            'A) [Option A]',
            'B) [Option B]',
            'C) [Option C]',
            'D) [Option D]',
            'Correct Answer: A',
            'Points: 1 (optional)',
            'Explanation: [explanation] (optional)'
          ],
          totalQuestions: 0
        }
      });
    }
    
    if (!validation.isValid) {
      // Add format requirements to errors if there are validation errors
      const formatErrors = [
        ...validation.errors,
        '',
        'Expected PDF format:',
        'Question 1: [Question text]',
        'A) [Option A]',
        'B) [Option B]',
        'C) [Option C]',
        'D) [Option D]',
        'Correct Answer: A',
        'Points: 1 (optional)',
        'Explanation: [explanation] (optional)'
      ];
      
      return res.status(400).json({
        success: false,
        message: 'PDF parsing completed with formatting errors',
        data: {
          questions: result.questions,
          errors: formatErrors,
          totalQuestions: result.totalQuestions
        }
      });
    }

    res.json({
      success: true,
      data: {
        questions: result.questions,
        totalQuestions: result.totalQuestions
      }
    });
  } catch (error) {
    console.error('PDF parsing error:', error);
    
    // Provide more helpful error messages
    let errorMessage = error.message || 'Error parsing PDF';
    let formatErrors = [];
    
    if (error.message && error.message.includes('parse')) {
      formatErrors = [
        'Failed to parse PDF. Please check the format.',
        '',
        'Expected PDF format:',
        'Question 1: [Question text]',
        'A) [Option A]',
        'B) [Option B]',
        'C) [Option C]',
        'D) [Option D]',
        'Correct Answer: A',
        'Points: 1 (optional)',
        'Explanation: [explanation] (optional)'
      ];
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      data: {
        errors: formatErrors.length > 0 ? formatErrors : [errorMessage]
      }
    });
  }
});

module.exports = {
  createQuiz,
  updateQuiz,
  getTeacherQuizzes,
  getQuiz,
  generateQuizKey,
  getQuizByKey,
  submitQuizAttempt,
  getQuizAnalytics,
  getTeacherQuizKeys,
  getStudentQuizHistory,
  getQuizAttemptDetails,
  parsePDF,
  generateQuestions,
  upload
};

