const geminiService = require('./geminiService');
const Question = require('../models/Question');

// Generate questions for a specific video
const generateVideoQuestions = async (transcript, videoId, courseId, difficulty = 'intermediate', sourceLanguage = 'en') => {
  try {
    console.log(`Generating ${difficulty} MCQ questions for video: ${videoId} (language: ${sourceLanguage})`);
    
    const questions = await geminiService.generateQuestions(transcript, difficulty, 5, sourceLanguage);
    
    // Save questions to database
    const savedQuestions = [];
    for (const q of questions) {
      try {
        // Normalize correctAnswer - if it's "Option A" format, extract the actual option text
        let correctAnswer = q.correctAnswer || '';
        const options = q.options || [];
        
        // If correctAnswer is in "Option A" or "A" format, find the actual option text
        if (correctAnswer && options.length > 0) {
          const optionMatch = correctAnswer.match(/^option\s*([A-D])/i) || correctAnswer.match(/^([A-D])\)?\s*$/i);
          if (optionMatch) {
            const optionIndex = optionMatch[1].charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
            if (optionIndex >= 0 && optionIndex < options.length) {
              const optionText = typeof options[optionIndex] === 'string' 
                ? options[optionIndex] 
                : (options[optionIndex].text || options[optionIndex]);
              correctAnswer = optionText;
              console.log(`✅ Normalized correctAnswer from "${q.correctAnswer}" to "${correctAnswer}"`);
            }
          }
        }
        
        // If still no correctAnswer, try to find it from options with isCorrect flag
        if (!correctAnswer && options.length > 0) {
          const correctOption = options.find(opt => {
            if (typeof opt === 'object' && opt !== null) {
              return opt.isCorrect === true || opt.isCorrect === 'true';
            }
            return false;
          });
          if (correctOption) {
            correctAnswer = correctOption.text || String(correctOption);
            console.log(`✅ Extracted correctAnswer from options: "${correctAnswer}"`);
          }
        }
        
        // Normalize options to strings
        const normalizedOptions = options.map(opt => {
          if (typeof opt === 'string') {
            return opt;
          } else if (opt && typeof opt === 'object') {
            return opt.text || opt.option || String(opt);
          }
          return String(opt);
        });
        
        const question = new Question({
          courseId,
          videoId,
          question: q.question,
          options: normalizedOptions,
          correctAnswer: correctAnswer,
          explanation: q.explanation || '',
          difficulty: q.difficulty || difficulty,
          topic: extractTopic(transcript),
          isActive: true, // Explicitly set isActive
          metadata: {
            generatedBy: 'gemini',
            confidence: 0.9,
            type: (q.type && q.type.toLowerCase() === 'mcq') ? 'mcq' : 'mcq', // Force MCQ type
            attempts: 0,
            correctAttempts: 0
          }
        });
        
        const saved = await question.save();
        savedQuestions.push(saved);
        
        // Debug: Verify correctAnswer was saved correctly
        const savedObj = saved.toObject ? saved.toObject() : saved;
        console.log(`✅ Saved question ${savedQuestions.length}/${questions.length}:`, {
          id: saved._id,
          correctAnswer: savedObj.correctAnswer,
          optionsCount: savedObj.options?.length || 0,
          metadataType: savedObj.metadata?.type || 'NOT SET'
        });
      } catch (saveError) {
        console.error(`❌ Error saving question:`, saveError.message);
        // Continue with other questions even if one fails
      }
    }
    
    console.log(`✅ Generated and saved ${savedQuestions.length}/${questions.length} questions successfully`);
    
    if (savedQuestions.length === 0) {
      throw new Error('Failed to save any questions to database');
    }
    
    return savedQuestions;
  } catch (error) {
    console.error('Error generating video questions:', error);
    return generateFallbackVideoQuestions(transcript, videoId, courseId, difficulty);
  }
};

// Generate comprehensive course test
const generateCourseTest = async (courseTranscripts, courseId, difficulty = 'intermediate') => {
  try {
    console.log(`Generating comprehensive course test for course: ${courseId}`);
    
    const questions = await geminiService.generateCourseTest(courseTranscripts, difficulty);

      // Save questions to database
    const savedQuestions = await Promise.all(
      questions.map(async (q) => {
        const question = new Question({
          courseId,
          videoId: 'course-test', // Special identifier for course tests
          question: q.question,
          options: q.options || [],
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || '',
          difficulty: q.difficulty || difficulty,
          topic: q.topic || 'General',
          metadata: {
            generatedBy: 'gemini',
            confidence: 0.9,
            type: q.type,
            isCourseTest: true
          }
        });
        
        return await question.save();
      })
    );
    
    console.log(`Generated ${savedQuestions.length} course test questions successfully`);
      return savedQuestions;
    } catch (error) {
    console.error('Error generating course test:', error);
    return generateFallbackCourseTest(courseTranscripts, courseId, difficulty);
  }
};

// Extract topic from transcript
const extractTopic = (transcript) => {
  const commonTopics = [
    'programming', 'javascript', 'python', 'react', 'nodejs', 'database',
    'web development', 'data structures', 'algorithms', 'machine learning',
    'artificial intelligence', 'cloud computing', 'devops', 'security'
  ];
  
  const lowerTranscript = transcript.toLowerCase();
  const foundTopic = commonTopics.find(topic => 
    lowerTranscript.includes(topic)
  );
  
  return foundTopic || 'General';
};

// Fallback video questions when Gemini API fails - ALL MCQ only
const generateFallbackVideoQuestions = async (transcript, videoId, courseId, difficulty) => {
  console.log('Using fallback for video questions (MCQ only)');
  
  // Handle invalid courseId
  const validCourseId = courseId && courseId !== 'temp' ? courseId : `playlist_${videoId}`;
  
  // Extract some context from transcript if available
  const transcriptWords = transcript ? transcript.split(' ').slice(0, 20).join(' ') : '';
  const hasContent = transcriptWords.length > 10;
  
  // Create more video-specific fallback questions - ALL MCQ only
  const fallbackQuestions = [
    {
      question: hasContent ? `Based on the video content about "${transcriptWords}", what is the main topic being discussed?` : 'What is the main topic covered in this video?',
      options: ['Fundamental concepts', 'Advanced techniques', 'Practical applications', 'All of the above'],
      correctAnswer: 'All of the above',
      explanation: 'Educational videos typically cover multiple aspects of a topic.',
      type: 'mcq'
    },
    {
      question: hasContent ? `What key concepts from "${transcriptWords}" should you focus on?` : 'Which learning approach would be most effective for this content?',
      options: ['Passive listening', 'Active note-taking', 'Interactive practice', 'Combination of methods'],
      correctAnswer: 'Combination of methods',
      explanation: 'A combination of learning methods ensures better understanding.',
      type: 'mcq'
    },
    {
      question: hasContent ? `How would you apply the concepts from "${transcriptWords}" in practice?` : 'What should you do after watching this video to reinforce learning?',
      options: ['Move to next video', 'Take a break', 'Practice the concepts', 'Skip to assessment'],
      correctAnswer: 'Practice the concepts',
      explanation: 'Practice helps solidify understanding and retention.',
      type: 'mcq'
    },
    {
      question: hasContent ? `What is the best way to understand the content from "${transcriptWords}"?` : 'What is the best way to understand the video content?',
      options: ['Watching once', 'Taking notes while watching', 'Skipping sections', 'Only reading subtitles'],
      correctAnswer: 'Taking notes while watching',
      explanation: 'Active engagement through note-taking helps improve comprehension and retention.',
      type: 'mcq'
    },
    {
      question: hasContent ? `Which skill is most important when learning from this video about "${transcriptWords}"?` : 'Which skill is most important when learning from educational videos?',
      options: ['Fast reading', 'Critical thinking', 'Memorization', 'Multi-tasking'],
      correctAnswer: 'Critical thinking',
      explanation: 'Critical thinking enables deeper understanding and practical application of the content.',
      type: 'mcq'
    }
  ];
  
  const savedFallbackQuestions = [];
  for (const q of fallbackQuestions) {
    try {
      const question = new Question({
        courseId: validCourseId,
        videoId,
        question: q.question,
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty,
        topic: extractTopic(transcript),
        isActive: true, // Explicitly set isActive
        metadata: {
          generatedBy: 'fallback',
          confidence: 0.5,
          type: q.type || 'mcq', // Ensure type is set
          attempts: 0,
          correctAttempts: 0
        }
      });
      
      const saved = await question.save();
      savedFallbackQuestions.push(saved);
      console.log(`✅ Saved fallback question ${savedFallbackQuestions.length}/${fallbackQuestions.length}: ${saved._id}`);
    } catch (saveError) {
      console.error(`❌ Error saving fallback question:`, saveError.message);
      // Continue with other questions even if one fails
    }
  }
  
  console.log(`✅ Generated and saved ${savedFallbackQuestions.length}/${fallbackQuestions.length} fallback questions`);
  return savedFallbackQuestions;
};

// Fallback course test when Gemini API fails
const generateFallbackCourseTest = async (courseTranscripts, courseId, difficulty) => {
  console.log('Using fallback for course test');
  
  const questions = [];
  for (let i = 0; i < 20; i++) {
    const question = new Question({
      courseId,
      videoId: 'course-test',
      question: `Course question ${i + 1}: What have you learned from this course?`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'The correct answer would be based on the course content.',
      explanation: 'This question tests overall course understanding.',
      difficulty,
      topic: 'General',
          metadata: {
        generatedBy: 'fallback',
        confidence: 0.5,
        type: 'mcq',
        isCourseTest: true
      }
    });
    
    questions.push(await question.save());
  }
  
  return questions;
};

// Get questions for a video
const getVideoQuestions = async (videoId, difficulty = 'intermediate') => {
  try {
    const questions = await Question.find({
      videoId,
      difficulty,
      isActive: true
    }).sort({ createdAt: -1 });
    
    return questions;
    } catch (error) {
    console.error('Error fetching video questions:', error);
    return [];
  }
};

// Get course test questions
const getCourseTestQuestions = async (courseId, difficulty = 'intermediate') => {
  try {
    const questions = await Question.find({
        courseId,
      'metadata.isCourseTest': true,
      difficulty,
        isActive: true
    }).sort({ createdAt: -1 });
    
    return questions;
    } catch (error) {
    console.error('Error fetching course test questions:', error);
      return [];
    }
};

// Update question statistics
const updateQuestionStats = async (questionId, isCorrect) => {
  try {
    // Check if questionId is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      console.log('Skipping stats update for fallback question:', questionId);
      return;
    }

    const question = await Question.findById(questionId);
    if (question) {
      question.metadata.attempts += 1;
      if (isCorrect) {
        question.metadata.correctAttempts += 1;
      }
      await question.save();
    }
    } catch (error) {
    console.error('Error updating question stats:', error);
  }
};

// Get questions for assessment (compatibility method)
const getQuestionsForAssessment = async (courseId, videoId, numQuestions = 5, difficulty = 'intermediate') => {
  try {
    console.log(`Getting ${numQuestions} MCQ questions for assessment: ${videoId}`);
    
    // Get existing MCQ questions from database first (only MCQ type)
    let questions = await Question.find({
      videoId,
      difficulty,
      isActive: { $ne: false } // Match true or undefined (default)
    }).limit(numQuestions * 3); // Get extra to ensure we have enough MCQs
    
    console.log(`📊 Found ${questions.length} total questions in database for videoId: ${videoId}, difficulty: ${difficulty}`);
    
    // Filter to ensure all are MCQs and have options
    questions = questions.filter(q => {
      // Convert Mongoose document to plain object if needed
      const qObj = q.toObject ? q.toObject() : q;
      const metadataType = qObj.metadata?.type || qObj.type;
      const hasOptions = qObj.options && Array.isArray(qObj.options) && qObj.options.length >= 4;
      
      // If type is explicitly set to non-MCQ, filter it out
      // Otherwise, if it has 4+ options, treat it as MCQ (for backward compatibility)
      const isMcq = (metadataType === 'mcq' || !metadataType) && hasOptions;
      
      if (!isMcq && questions.length > 0) {
        console.log(`⚠️ Filtered out non-MCQ: videoId=${qObj.videoId}, metadataType=${metadataType || 'undefined (assuming MCQ if has options)'}, type=${qObj.type || 'none'}, options=${qObj.options?.length || 0}`);
      }
      return isMcq;
    }).slice(0, numQuestions);
    
    console.log(`📊 Filtered to ${questions.length} valid MCQ questions`);

    // If not enough questions in database, generate new ones
    if (questions.length < numQuestions) {
      console.log(`Not enough questions in database (${questions.length}/${numQuestions}), generating new ones...`);
      
      // Get transcript to generate questions (will use cache if available)
      const assemblyaiService = require('./assemblyaiService');
      const transcriptData = await assemblyaiService.getTranscriptWithFallback(videoId);
      
      console.log('Transcript data for question generation:', {
        hasTranscript: transcriptData?.hasTranscript,
        wordCount: transcriptData?.wordCount,
        language: transcriptData?.language,
        transcriptLength: transcriptData?.transcript?.length
      });
      
      if (transcriptData && transcriptData.hasTranscript && transcriptData.transcript && transcriptData.transcript.length > 100) {
        console.log('Generating questions from transcript...');
        try {
          const newQuestions = await generateVideoQuestions(transcriptData.transcript, videoId, courseId, difficulty, transcriptData.language);
          console.log(`Generated ${newQuestions.length} new questions from transcript`);
          
          // Debug: Log the structure of saved questions
          if (newQuestions.length > 0) {
            console.log(`🔍 Debug - First saved question structure:`, {
              hasMetadata: !!newQuestions[0].metadata,
              metadataType: newQuestions[0].metadata?.type,
              directType: newQuestions[0].type,
              hasOptions: !!newQuestions[0].options,
              optionsLength: newQuestions[0].options?.length,
              questionId: newQuestions[0]._id
            });
          }
          
          // Re-query database immediately to get all questions including newly saved ones
          // This ensures we get the properly structured Mongoose documents
          const allQuestions = await Question.find({
            videoId,
            difficulty,
            isActive: { $ne: false }
          }).limit(numQuestions * 3);
          
          console.log(`📊 Re-queried ${allQuestions.length} questions from database`);
          
          // Filter to only MCQs with options
          const validMcqs = allQuestions.filter(q => {
            // Convert Mongoose document to plain object if needed
            const qObj = q.toObject ? q.toObject() : q;
            const metadataType = qObj.metadata?.type || qObj.type;
            const hasOptions = qObj.options && Array.isArray(qObj.options) && qObj.options.length >= 4;
            
            // If type is explicitly set to non-MCQ, filter it out
            // Otherwise, if it has 4+ options, treat it as MCQ (for backward compatibility)
            const isMcq = (metadataType === 'mcq' || !metadataType) && hasOptions;
            
            if (!isMcq) {
              console.warn(`⚠️ Filtered out non-MCQ question: id=${qObj._id}, metadataType=${metadataType || 'undefined'}, type=${qObj.type || 'undefined'}, options=${qObj.options?.length || 0}`);
            }
            return isMcq;
          });
          
          questions = validMcqs.slice(0, numQuestions);
          console.log(`✅ Retrieved ${questions.length} MCQ questions from database after generation`);
    } catch (error) {
          console.error('Error generating questions from transcript:', error);
          console.log('Falling back to fallback questions due to generation error');
          const fallbackQuestions = generateFallbackQuestions('General educational content', difficulty);
          questions = fallbackQuestions.slice(0, numQuestions);
        }
      } else {
        console.log('No valid transcript available, using fallback questions');
        console.log('Transcript status:', {
          hasTranscript: transcriptData?.hasTranscript,
          transcriptLength: transcriptData?.transcript?.length,
          isLongEnough: transcriptData?.transcript?.length > 100
        });
        // Generate fallback questions if no transcript
        const fallbackQuestions = generateFallbackQuestions('General educational content', difficulty);
        questions = fallbackQuestions.slice(0, numQuestions);
      }
    }

    return questions;
    } catch (error) {
    console.error('Error getting questions for assessment:', error);
      return [];
    }
};

// Generate fallback questions when no transcript is available
const generateFallbackQuestions = (transcript, difficulty = 'intermediate') => {
  const mongoose = require('mongoose');
  
  // Generate unique ObjectIds for each question
  const generateUniqueId = (index) => {
    const baseId = '507f1f77bcf86cd7994390';
    return new mongoose.Types.ObjectId(baseId + (10 + index).toString());
  };
  
  // Create diverse fallback questions - ALL MCQ only
  const fallbackQuestions = [
    {
      _id: generateUniqueId(1),
      question: 'What is the primary focus of this educational video?',
      type: 'mcq',
      options: ['Conceptual understanding', 'Practical implementation', 'Problem-solving techniques', 'All of the above'],
      correctAnswer: 'All of the above',
      explanation: 'Educational videos typically cover multiple learning aspects to provide comprehensive understanding.',
      difficulty: difficulty,
      topic: 'Learning Objectives',
      metadata: { type: 'mcq', generatedBy: 'fallback' }
    },
    {
      _id: generateUniqueId(2),
      question: 'Which learning approach would be most effective for this content?',
      type: 'mcq',
      options: ['Passive listening', 'Active note-taking', 'Interactive practice', 'Combination of methods'],
      correctAnswer: 'Combination of methods',
      explanation: 'A combination of learning methods ensures better retention and understanding of complex topics.',
      difficulty: difficulty,
      topic: 'Learning Methods',
      metadata: { type: 'mcq', generatedBy: 'fallback' }
    },
    {
      _id: generateUniqueId(3),
      question: 'What should be your next step after completing this video?',
      type: 'mcq',
      options: ['Move to the next topic', 'Practice with exercises', 'Review key concepts', 'Apply knowledge practically'],
      correctAnswer: 'Apply knowledge practically',
      explanation: 'Practical application helps solidify understanding and builds real-world skills.',
      difficulty: difficulty,
      topic: 'Learning Progression',
      metadata: { type: 'mcq', generatedBy: 'fallback' }
    },
    {
      _id: generateUniqueId(4),
      question: 'What is the best way to reinforce learning from this video?',
      type: 'mcq',
      options: ['Watching the video again', 'Taking notes and practicing', 'Skipping to next video', 'Only reading the transcript'],
      correctAnswer: 'Taking notes and practicing',
      explanation: 'Active learning through note-taking and practice helps reinforce understanding and improve retention.',
      difficulty: difficulty,
      topic: 'Learning Reinforcement',
      metadata: { type: 'mcq', generatedBy: 'fallback' }
    },
    {
      _id: generateUniqueId(5),
      question: 'Which skill is most important when learning from educational videos?',
      type: 'mcq',
      options: ['Memorization', 'Critical thinking', 'Speed watching', 'Multi-tasking'],
      correctAnswer: 'Critical thinking',
      explanation: 'Critical thinking allows you to understand, analyze, and apply the concepts presented in the video effectively.',
      difficulty: difficulty,
      topic: 'Learning Skills',
      metadata: { type: 'mcq', generatedBy: 'fallback' }
    }
  ];

  return fallbackQuestions;
};

// Generate question preview (compatibility method)
const generateQuestionPreview = (question) => {
    return {
      id: question._id || question.id || 'fallback',
      question: question.question,
      type: question.metadata?.type || question.type || 'mcq',
      options: question.options || [],
      difficulty: question.difficulty || 'intermediate',
      topic: question.topic || 'General'
    };
};

module.exports = {
  generateVideoQuestions,
  generateCourseTest,
  getVideoQuestions,
  getCourseTestQuestions,
  updateQuestionStats,
  getQuestionsForAssessment,
  generateQuestionPreview,
  generateFallbackQuestions
};