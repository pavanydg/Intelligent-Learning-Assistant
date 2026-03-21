/**
 * Integration Service - Frontend
 * Handles communication with integration API endpoints
 */

import { api } from './api';

export interface IntegrationStatus {
  [key: string]: {
    name: string;
    connected: boolean;
    connectedAt: string | null;
  };
}

export interface ExportOptions {
  courseId?: string;
  forumId?: string;
}

class IntegrationService {
  /**
   * Get integration status for current user
   */
  async getStatus(): Promise<IntegrationStatus> {
    const response = await api.get('/integrations/status');
    return response.data.data;
  }

  /**
   * Get OAuth authorization URL for a provider
   */
  async getAuthUrl(provider: string): Promise<string> {
    const response = await api.get(`/integrations/auth-url/${provider}`);
    return response.data.data.authUrl;
  }

  /**
   * Connect to a provider using OAuth code
   */
  async connectWithCode(provider: string, code: string): Promise<void> {
    await api.post(`/integrations/connect/${provider}`, { code });
  }

  /**
   * Connect to a provider using manual configuration (e.g., Moodle)
   */
  async connectWithConfig(provider: string, config: any): Promise<void> {
    await api.post(`/integrations/connect/${provider}`, { config });
  }

  /**
   * Disconnect from a provider
   */
  async disconnect(provider: string): Promise<void> {
    await api.post(`/integrations/disconnect/${provider}`);
  }

  /**
   * Export notes to external platform
   */
  async exportNotes(videoId: string, provider: string, options?: ExportOptions): Promise<any> {
    const response = await api.post(`/integrations/export/notes/${videoId}`, {
      provider,
      options
    });
    return response.data.data;
  }

  /**
   * Export feedback to external platform
   */
  async exportFeedback(assessmentId: string, provider: string, options?: ExportOptions): Promise<any> {
    const response = await api.post(`/integrations/export/feedback/${assessmentId}`, {
      provider,
      options
    });
    return response.data.data;
  }
}

export default new IntegrationService();

