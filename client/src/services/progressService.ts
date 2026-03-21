import { api } from './api';

export interface VideoProgress {
  videoId: string;
  title: string;
  completedAt: string;
  watchTime: number;
}

export interface TestScore {
  assessmentId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  completedAt: string;
}

export interface CourseProgress {
  courseId: string;
  courseTitle: string;
  totalVideos: number;
  completedVideos: VideoProgress[];
  completionPercentage: number;
  testScores: TestScore[];
  averageTestScore: number;
  lastWatchedVideo?: {
    videoId: string;
    title: string;
    watchedAt: string;
  };
  totalWatchTime: number;
  startedAt: string;
  lastUpdated: string;
}

export interface ProgressStats {
  totalCourses: number;
  totalVideosWatched: number;
  totalWatchTime: number;
  averageCompletion: number;
  averageTestScore: number;
  completedCourses: number;
}

export const progressService = {
  // Get progress for a specific course
  async getCourseProgress(courseId: string): Promise<CourseProgress> {
    const response = await api.get(`/progress/course/${courseId}`);
    return response.data.data.progress;
  },

  // Get all user progress
  async getAllProgress(): Promise<CourseProgress[]> {
    const response = await api.get('/progress/all');
    return response.data.data.progress;
  },

  // Get user progress statistics
  async getProgressStats(): Promise<ProgressStats> {
    const response = await api.get('/progress/stats');
    return response.data.data.stats;
  },

  // Mark video as completed
  async markVideoCompleted(
    courseId: string,
    videoId: string,
    videoTitle: string,
    watchTime: number = 0
  ): Promise<{
    completionPercentage: number;
    completedVideos: number;
    totalVideos: number;
  }> {
    const response = await api.post('/progress/mark-video-completed', {
      courseId,
      videoId,
      videoTitle,
      watchTime,
    });
    return response.data.data;
  },

  // Add test score to course progress
  async addTestScore(
    courseId: string,
    assessmentId: string,
    score: number,
    totalQuestions: number
  ): Promise<{
    averageTestScore: number;
    totalTests: number;
  }> {
    const response = await api.post('/progress/add-test-score', {
      courseId,
      assessmentId,
      score,
      totalQuestions,
    });
    return response.data.data;
  },
};
