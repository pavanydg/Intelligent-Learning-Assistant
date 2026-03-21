/**
 * Proctoring Service
 * Analyzes assessment behavior to detect suspicious activity
 */

class ProctoringService {
  /**
   * Analyze proctoring data and generate integrity score
   * @param {Object} metrics - Proctoring metrics
   * @returns {Object} Analysis result with flags and integrity score
   */
  analyzeProctoringData(metrics) {
    const flags = [];
    let integrityScore = 100;

    // Check off-screen time (suspicious if >30 seconds total)
    if (metrics.offScreenTime > 30) {
      flags.push('Frequent absence from screen');
      integrityScore -= 15;
    }

    // Check no-face frames (suspicious if >20% of frames)
    if (metrics.noFaceFrames > 0 && metrics.totalFrames > 0) {
      const noFacePercentage = (metrics.noFaceFrames / metrics.totalFrames) * 100;
      if (noFacePercentage > 20) {
        flags.push('Face not detected frequently');
        integrityScore -= 10;
      }
    }

    // Check gaze deviation (suspicious if average deviation >30%)
    if (metrics.gazeDeviation > 30) {
      flags.push('Unusual eye movement patterns');
      integrityScore -= 10;
    }

    // Check paste events (suspicious if >1)
    if (metrics.pasteEvents > 1) {
      flags.push('Possible external source (paste detected)');
      integrityScore -= 20;
    }

    // Check copy events (suspicious if >0)
    if (metrics.copyEvents > 0) {
      flags.push('Copy activity detected');
      integrityScore -= 15;
    }

    // Check abnormal typing pattern (too fast = <50ms average delay)
    if (metrics.avgKeyDelay > 0 && metrics.avgKeyDelay < 50) {
      flags.push('Abnormal typing pattern (too fast)');
      integrityScore -= 10;
    }

    // Check backspace rate (suspicious if >30 per minute)
    if (metrics.backspaceRate > 30) {
      flags.push('Unusual editing pattern');
      integrityScore -= 5;
    }

    // Check tab switches (suspicious if >3)
    if (metrics.tabSwitches > 3) {
      flags.push('Multiple tab/window switches');
      integrityScore -= 15;
    }

    // Ensure score doesn't go below 0
    integrityScore = Math.max(0, integrityScore);

    return {
      flags,
      integrityScore: Math.round(integrityScore),
      severity: this.getSeverity(integrityScore)
    };
  }

  /**
   * Get severity level based on integrity score
   * @param {number} score - Integrity score (0-100)
   * @returns {string} Severity level
   */
  getSeverity(score) {
    if (score >= 85) return 'low';
    if (score >= 60) return 'medium';
    return 'high';
  }

  /**
   * Aggregate proctoring metrics from multiple submissions
   * @param {Array} metricsArray - Array of metric objects
   * @returns {Object} Aggregated metrics
   */
  aggregateMetrics(metricsArray) {
    if (!metricsArray || metricsArray.length === 0) {
      return {
        offScreenTime: 0,
        noFaceFrames: 0,
        totalFrames: 0,
        gazeDeviation: 0,
        avgKeyDelay: 0,
        pasteEvents: 0,
        backspaceRate: 0,
        tabSwitches: 0,
        copyEvents: 0
      };
    }

    const totals = metricsArray.reduce((acc, m) => ({
      offScreenTime: acc.offScreenTime + (m.offScreenTime || 0),
      noFaceFrames: acc.noFaceFrames + (m.noFaceFrames || 0),
      totalFrames: acc.totalFrames + (m.totalFrames || 0),
      gazeDeviation: acc.gazeDeviation + (m.gazeDeviation || 0),
      avgKeyDelay: acc.avgKeyDelay + (m.avgKeyDelay || 0),
      pasteEvents: acc.pasteEvents + (m.pasteEvents || 0),
      backspaceRate: acc.backspaceRate + (m.backspaceRate || 0),
      tabSwitches: acc.tabSwitches + (m.tabSwitches || 0),
      copyEvents: acc.copyEvents + (m.copyEvents || 0)
    }), {
      offScreenTime: 0,
      noFaceFrames: 0,
      totalFrames: 0,
      gazeDeviation: 0,
      avgKeyDelay: 0,
      pasteEvents: 0,
      backspaceRate: 0,
      tabSwitches: 0,
      copyEvents: 0
    });

    const count = metricsArray.length;

    return {
      offScreenTime: totals.offScreenTime,
      noFaceFrames: totals.noFaceFrames,
      totalFrames: totals.totalFrames,
      gazeDeviation: totals.totalFrames > 0 ? totals.gazeDeviation / count : 0,
      avgKeyDelay: totals.avgKeyDelay / count,
      pasteEvents: totals.pasteEvents,
      backspaceRate: totals.backspaceRate / count,
      tabSwitches: totals.tabSwitches,
      copyEvents: totals.copyEvents
    };
  }

  /**
   * Process and analyze proctoring metrics for an assessment
   * @param {Array} proctoringMetrics - Array of proctoring metric submissions
   * @returns {Object} Analysis result
   */
  processAssessmentProctoring(proctoringMetrics) {
    const aggregated = this.aggregateMetrics(proctoringMetrics);
    const analysis = this.analyzeProctoringData(aggregated);

    return {
      metrics: aggregated,
      ...analysis
    };
  }
}

module.exports = new ProctoringService();


