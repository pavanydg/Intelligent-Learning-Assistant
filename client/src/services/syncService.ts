/**
 * Sync Service - Frontend
 * Handles cross-device synchronization
 */

import { api } from './api';

export interface SyncProgress {
  playlistId: string;
  playlistTitle: string;
  lastSyncedAt: string;
  videos: {
    videoId: string;
    lastPosition: number;
    completionPercentage: number;
  }[];
}

export interface LastPosition {
  lastPosition: number;
  completionPercentage: number;
  watchTime: number;
  lastSyncedAt?: string;
}

class SyncService {
  /**
   * Sync video progress
   */
  async syncProgress(
    playlistId: string,
    videoId: string,
    progressData: {
      progress?: number;
      lastPosition: number;
      watchTime?: number;
      totalDuration?: number;
      completionPercentage?: number;
      isCompleted?: boolean;
      videoTitle?: string;
      videoThumbnail?: string;
      playlistTitle?: string;
      playlistThumbnail?: string;
    }
  ): Promise<void> {
    await api.put(`/sync/progress/${playlistId}/video/${videoId}`, progressData);
  }

  /**
   * Get last synced position for a video
   */
  async getLastPosition(playlistId: string, videoId: string): Promise<LastPosition> {
    const response = await api.get(`/sync/position/${playlistId}/video/${videoId}`);
    return response.data.data;
  }

  /**
   * Get all synced progress
   */
  async getAllProgress(): Promise<SyncProgress[]> {
    const response = await api.get('/sync/progress');
    return response.data.data;
  }
}

export default new SyncService();

