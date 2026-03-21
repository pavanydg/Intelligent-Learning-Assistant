/**
 * Proctoring Service - Frontend
 * Handles proctoring metrics submission
 */

import { api } from './api';

export interface ProctoringMetrics {
  offScreenTime?: number;
  noFaceFrames?: number;
  totalFrames?: number;
  gazeDeviation?: number;
  avgKeyDelay?: number;
  pasteEvents?: number;
  backspaceRate?: number;
  tabSwitches?: number;
  copyEvents?: number;
}

export interface ProctoringResults {
  assessmentId: string;
  integrityScore: number;
  flags: string[];
  metrics: ProctoringMetrics;
  severity: 'low' | 'medium' | 'high';
}

class ProctoringService {
  /**
   * Submit proctoring metrics
   */
  async submitMetrics(assessmentId: string, metrics: ProctoringMetrics): Promise<void> {
    await api.post(`/proctoring/metrics/${assessmentId}`, metrics);
  }

  /**
   * Get proctoring results
   */
  async getResults(assessmentId: string): Promise<ProctoringResults> {
    const response = await api.get(`/proctoring/results/${assessmentId}`);
    return response.data.data;
  }
}

export default new ProctoringService();

