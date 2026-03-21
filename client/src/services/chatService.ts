/**
 * Chat Service - Frontend service for context-aware chatbot
 */

import { chatApi, endpoints, handleApiError } from './api'

export interface ChatMessage {
  id: string
  message: string
  reply: string
  timestamp: Date
  hasContext: boolean
  contextType?: 'transcript' | 'description' | 'topic' | 'none'
}

export interface ChatRequest {
  message: string
  transcript?: string
  description?: string
  topic?: string
  videoId?: string
}

export interface ChatResponse {
  success: boolean
  data: {
    reply: string
    hasContext: boolean
    contextType?: 'transcript' | 'description' | 'topic' | 'none'
  }
}

class ChatService {
  /**
   * Send a chat message with context
   */
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    try {
      // Use chatApi with extended timeout for large prompts
      const response = await chatApi.post<ChatResponse>(endpoints.chat.send, request)
      return response.data
    } catch (error: any) {
      // Handle timeout errors specifically
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        throw new Error('Request took too long. For large prompts with transcripts, this may take up to 5 minutes. Please try again.')
      }
      handleApiError(error)
      throw error
    }
  }

  /**
   * Send a quick message without context (for general questions)
   */
  async sendQuickMessage(message: string): Promise<ChatResponse> {
    try {
      // Use chatApi with extended timeout
      const response = await chatApi.post<ChatResponse>(endpoints.chat.quick, { message })
      return response.data
    } catch (error: any) {
      // Handle timeout errors specifically
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        throw new Error('Request took too long. Please try again.')
      }
      handleApiError(error)
      throw error
    }
  }
}

export const chatService = new ChatService()

