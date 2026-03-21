/**
 * Chat Service - Context-Aware Educational Chatbot
 * Uses Google Gemini 1.5 Flash for intelligent, context-aware responses
 */

const geminiService = require('./geminiService');
const Transcript = require('../models/Transcript');

class ChatService {
  constructor() {
    this.systemPrompt = `You are ILA's (Intelligent Learning Assistant) educational chatbot, designed to help students with their learning needs.

Your role:
- Provide clear, accurate, and student-friendly explanations
- Answer questions about the provided context (transcript, description, or topic) when relevant
- Answer general questions on any topic using your knowledge when the question is not related to the context
- Break down complex concepts into simpler terms
- Use examples and analogies when helpful
- Be concise but comprehensive
- Encourage learning and curiosity

Guidelines:
- Always prioritize accuracy over speed
- If you're unsure about something, say so rather than guessing
- When context is provided and the question relates to it, use the context as the primary source of truth
- When the question is unrelated to the context, answer using your general knowledge without forcing topic relevance
- Make explanations accessible to learners at different levels
- Format responses clearly with proper structure when needed
- You can answer questions on any topic - programming, science, history, general knowledge, etc.`;

    this.maxContextLength = 30000; // Maximum characters to include from transcript
  }

  /**
   * Get transcript for a video (if available)
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<string|null>} Transcript text or null
   */
  async getVideoTranscript(videoId) {
    if (!videoId) return null;

    try {
      const transcriptDoc = await Transcript.findOne({ videoId });
      if (transcriptDoc && transcriptDoc.transcript && transcriptDoc.transcript.length > 50) {
        // Truncate if too long to fit in context window
        const transcript = transcriptDoc.transcript;
        if (transcript.length > this.maxContextLength) {
          return transcript.substring(0, this.maxContextLength) + '... [truncated]';
        }
        return transcript;
      }
      return null;
    } catch (error) {
      console.error('Error fetching transcript for chat:', error);
      return null;
    }
  }

  /**
   * Build context-aware prompt for Gemini
   * @param {Object} params - Chat parameters
   * @param {string} params.message - User's question
   * @param {string} [params.transcript] - Video transcript
   * @param {string} [params.description] - Video description
   * @param {string} [params.topic] - Video topic
   * @param {string} [params.videoId] - Video ID (to fetch transcript)
   * @returns {Promise<string>} Formatted prompt
   */
  async buildPrompt({ message, transcript, description, topic, videoId }) {
    // Try to get transcript if videoId is provided but transcript is not
    let finalTranscript = transcript;
    if (!finalTranscript && videoId) {
      finalTranscript = await this.getVideoTranscript(videoId);
    }

    // Build context section
    let contextSection = '';
    let hasContext = false;

    if (finalTranscript) {
      contextSection = `VIDEO TRANSCRIPT (Available Context):
${finalTranscript}

`;
      hasContext = true;
    } else if (description) {
      contextSection = `VIDEO DESCRIPTION (Available Context):
${description}

`;
      hasContext = true;
    } else if (topic) {
      contextSection = `VIDEO TOPIC (Available Context):
${topic}

`;
      hasContext = true;
    }

    // Build the full prompt with intelligent context handling
    let prompt;
    
    if (hasContext) {
      // When context is available, check if question is related
      prompt = `${this.systemPrompt}

${contextSection}STUDENT QUESTION:
${message}

Instructions:
- First, determine if the question is related to the context provided above
- If the question IS related to the context: Use the context as the primary source and provide a detailed answer based on it. You can supplement with your knowledge if needed.
- If the question is NOT related to the context (e.g., asking about a completely different topic): Answer the question using your general knowledge without forcing it to relate to the context. The student may be asking a general question while watching a video.
- Be helpful and answer any question the student asks, whether it's related to the context or not.`;
    } else {
      // No context available - answer as general assistant
      prompt = `${this.systemPrompt}

STUDENT QUESTION:
${message}

Please provide a helpful, accurate answer to the student's question using your knowledge.`;
    }

    return prompt;
  }

  /**
   * Generate chat response using Gemini
   * @param {Object} params - Chat parameters
   * @param {string} params.message - User's question
   * @param {string} [params.transcript] - Video transcript
   * @param {string} [params.description] - Video description
   * @param {string} [params.topic] - Video topic
   * @param {string} [params.videoId] - Video ID
   * @returns {Promise<Object>} Chat response
   */
  async generateResponse({ message, transcript, description, topic, videoId }) {
    try {
      // Validate input
      if (!message || message.trim().length === 0) {
        throw new Error('Message is required');
      }

      // Build context-aware prompt
      const prompt = await this.buildPrompt({
        message: message.trim(),
        transcript,
        description,
        topic,
        videoId
      });

      // Generate response using Gemini with extended timeout for large prompts
      // Calculate timeout based on prompt size (larger prompts need more time)
      const promptLength = prompt.length;
      let timeout = 120000; // Default 2 minutes
      
      if (promptLength > 50000) {
        timeout = 300000; // 5 minutes for very large prompts (50k+ chars)
      } else if (promptLength > 20000) {
        timeout = 240000; // 4 minutes for large prompts (20k-50k chars)
      } else if (promptLength > 10000) {
        timeout = 180000; // 3 minutes for medium-large prompts (10k-20k chars)
      }
      
      console.log(`🤖 Generating chat response with Gemini... (prompt: ${promptLength} chars, timeout: ${timeout/1000}s)`);
      const response = await geminiService.generateContent(prompt, { timeout });

      return {
        success: true,
        reply: response.trim(),
        hasContext: !!(transcript || description || topic || videoId),
        contextType: transcript || videoId ? 'transcript' : description ? 'description' : topic ? 'topic' : 'none'
      };
    } catch (error) {
      console.error('Chat service error:', error);
      
      // Handle 503 Service Unavailable / Overloaded errors (already retried by geminiService)
      if (error.message && (
        error.message.includes('overloaded') || 
        error.message.includes('503') ||
        error.message.includes('Service Unavailable') ||
        error.message.includes('try again in a few moments')
      )) {
        throw new Error('The AI service is currently busy. Please try again in a few moments.');
      }
      
      // Network errors
      if (error.message && error.message.includes('Network error')) {
        throw new Error('Unable to connect to the AI service. Please check your internet connection and try again.');
      }
      
      // API key errors
      if (error.message && (error.message.includes('API key') || error.message.includes('API_KEY_INVALID'))) {
        throw new Error('Chat service is not configured. Please set GEMINI_API_KEY in environment variables.');
      }
      
      // Quota/rate limit errors
      if (error.message && (error.message.includes('quota') || error.message.includes('rate limit') || error.message.includes('429'))) {
        throw new Error('Chat service is temporarily unavailable due to rate limits. Please try again in a moment.');
      }

      // Re-throw with original message if it's already a user-friendly error
      if (error.message && (
        error.message.includes('Network error') || 
        error.message.includes('Invalid Gemini') || 
        error.message.includes('quota') ||
        error.message.includes('overloaded') ||
        error.message.includes('currently busy')
      )) {
        throw error;
      }

      throw new Error(`Failed to generate chat response: ${error.message || 'Unknown error occurred'}`);
    }
  }

  /**
   * Generate a quick response (without context) - for general questions
   * @param {string} message - User's question
   * @returns {Promise<Object>} Chat response
   */
  async generateQuickResponse(message) {
    return this.generateResponse({ message });
  }
}

module.exports = new ChatService();

