const { computeCLI, analyzeCLITrends } = require('../utils/computeCLI');
const Assessment = require('../models/Assessment');

class CLIService {
  /**
   * Process cognitive metrics and compute CLI
   * @param {Array} metrics - Array of cognitive metrics
   * @param {Object} assessmentData - Assessment data
   * @returns {Object} CLI computation result
   */
  async processMetrics(metrics, assessmentData) {
    try {
      // Handle case where no metrics are provided (fallback to default values)
      if (!metrics || metrics.length === 0) {
        console.log('No cognitive metrics provided, using default values');
        const defaultMetrics = {
          avgOnScreen: 85,
          blinkRatePerMin: 15,
          headMovement: 0,
          eyeGazeStability: 85
        };
        
        const cliResult = computeCLI({
          focusPct: defaultMetrics.avgOnScreen,
          blinkRate: defaultMetrics.blinkRatePerMin,
          timeSpent: assessmentData.timeSpent || 30,
          metrics: defaultMetrics,
          averageTime: 30
        });

        return {
          ...cliResult,
          avgMetrics: defaultMetrics,
          totalMetrics: 0,
          processingTime: new Date().toISOString()
        };
      }

      // Calculate average metrics
      const avgMetrics = this.calculateAverageMetrics(metrics);
      
      // Compute CLI
      const cliResult = computeCLI({
        focusPct: avgMetrics.avgOnScreen,
        blinkRate: avgMetrics.blinkRatePerMin,
        timeSpent: assessmentData.timeSpent || 30,
        metrics: avgMetrics,
        averageTime: 30 // Default average time
      });

      return {
        ...cliResult,
        avgMetrics,
        totalMetrics: metrics.length,
        processingTime: new Date().toISOString()
      };

    } catch (error) {
      console.error('CLI processing error:', error.message);
      console.error('Error details:', error);
      
      // Return default CLI values instead of throwing error
      console.log('Returning default CLI values due to processing error');
      const defaultMetrics = {
        avgOnScreen: 85,
        blinkRatePerMin: 15,
        headMovement: 0,
        eyeGazeStability: 85
      };
      
      const cliResult = computeCLI({
        focusPct: defaultMetrics.avgOnScreen,
        blinkRate: defaultMetrics.blinkRatePerMin,
        timeSpent: assessmentData.timeSpent || 30,
        metrics: defaultMetrics,
        averageTime: 30
      });

      return {
        ...cliResult,
        avgMetrics: defaultMetrics,
        totalMetrics: 0,
        processingTime: new Date().toISOString(),
        error: 'Used default values due to processing error'
      };
    }
  }

  /**
   * Calculate average metrics from raw data
   * @param {Array} metrics - Raw metrics array
   * @returns {Object} Average metrics
   */
  calculateAverageMetrics(metrics) {
    if (metrics.length === 0) {
      return {
        avgOnScreen: 85,
        blinkRatePerMin: 15,
        headMovement: 0,
        eyeGazeStability: 85
      };
    }

    const totals = metrics.reduce((acc, metric) => ({
      avgOnScreen: acc.avgOnScreen + (metric.avgOnScreen || 0),
      blinkRatePerMin: acc.blinkRatePerMin + (metric.blinkRatePerMin || 0),
      headMovement: acc.headMovement + (metric.headMovement || 0),
      eyeGazeStability: acc.eyeGazeStability + (metric.eyeGazeStability || 0)
    }), { avgOnScreen: 0, blinkRatePerMin: 0, headMovement: 0, eyeGazeStability: 0 });

    const count = metrics.length;
    return {
      avgOnScreen: Math.round((totals.avgOnScreen / count) * 100) / 100,
      blinkRatePerMin: Math.round((totals.blinkRatePerMin / count) * 100) / 100,
      headMovement: Math.round((totals.headMovement / count) * 100) / 100,
      eyeGazeStability: Math.round((totals.eyeGazeStability / count) * 100) / 100
    };
  }

  /**
   * Analyze cognitive load trends for a user
   * @param {string} userId - User ID
   * @param {string} courseId - Course ID (optional)
   * @param {number} limit - Number of recent assessments to analyze
   * @returns {Promise<Object>} Trend analysis
   */
  async analyzeUserTrends(userId, courseId = null, limit = 50) {
    try {
      const query = { userId, status: 'completed' };
      if (courseId) {
        query.courseId = courseId;
      }

      // Get more assessments for better trend analysis
      const assessments = await Assessment.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('cli testScore createdAt courseId');

      return analyzeCLITrends(assessments);

    } catch (error) {
      console.error('Trend analysis error:', error.message);
      return {
        trend: 'error',
        averageCLI: 0,
        improvement: 0,
        recommendations: ['Unable to analyze trends at this time']
      };
    }
  }

  /**
   * Get cognitive load insights for dashboard
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Cognitive insights
   */
  async getUserInsights(userId) {
    try {
      const recentAssessments = await Assessment.find({
        userId,
        status: 'completed'
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('cli cliClassification testScore createdAt courseId');

      if (recentAssessments.length === 0) {
        return {
          message: 'No assessment data available',
          insights: []
        };
      }

      // Calculate insights
      const insights = this.generateInsights(recentAssessments);
      
      return {
        totalAssessments: recentAssessments.length,
        insights,
        trends: await this.analyzeUserTrends(userId)
      };

    } catch (error) {
      console.error('User insights error:', error.message);
      return {
        message: 'Unable to generate insights',
        insights: []
      };
    }
  }

  /**
   * Generate insights from assessment data
   * @param {Array} assessments - Assessment data
   * @returns {Array} Generated insights
   */
  generateInsights(assessments) {
    const insights = [];
    
    if (assessments.length === 0) {
      return insights;
    }

    // Helper function to calculate CLI classification from CLI value
    const getCLIClassification = (cli) => {
      if (cli === null || cli === undefined) return null;
      if (cli <= 35) return 'Low Load';
      if (cli <= 70) return 'Moderate Load';
      return 'High Load';
    };

    // Average CLI
    const validCLI = assessments.filter(a => a.cli !== null && a.cli !== undefined);
    if (validCLI.length > 0) {
      const avgCLI = validCLI.reduce((sum, a) => sum + (a.cli || 0), 0) / validCLI.length;
      let cliMessage = `Your average cognitive load index is ${Math.round(avgCLI)}. `;
      if (avgCLI <= 35) {
        cliMessage += 'Great job maintaining low cognitive load!';
      } else if (avgCLI <= 70) {
        cliMessage += 'You are experiencing moderate cognitive load.';
      } else {
        cliMessage += 'Consider taking more breaks to reduce cognitive load.';
      }
      insights.push({
        type: 'average_cli',
        value: Math.round(avgCLI * 100) / 100,
        message: cliMessage
      });
    }

    // Average Test Score
    const validScores = assessments.filter(a => a.testScore !== null && a.testScore !== undefined);
    if (validScores.length > 0) {
      const avgScore = validScores.reduce((sum, a) => sum + (a.testScore || 0), 0) / validScores.length;
      insights.push({
        type: 'average_score',
        value: Math.round(avgScore * 100) / 100,
        message: `Your average test score is ${Math.round(avgScore)}%. ${avgScore >= 80 ? 'Excellent performance! Keep up the great work!' : avgScore >= 60 ? 'Good progress! Keep practicing to improve further.' : 'Keep practicing and reviewing the material to improve your scores.'}`
      });
    }

    // Load distribution - calculate classification from CLI if missing
    const loadDistribution = assessments.reduce((acc, a) => {
      let classification = a.cliClassification;
      if (!classification && a.cli !== null && a.cli !== undefined) {
        classification = getCLIClassification(a.cli);
      }
      if (classification) {
        acc[classification] = (acc[classification] || 0) + 1;
      }
      return acc;
    }, {});

    const dominantLoad = Object.entries(loadDistribution)
      .sort(([,a], [,b]) => b - a)[0];

    if (dominantLoad) {
      const loadType = dominantLoad[0];
      const count = dominantLoad[1];
      const percentage = Math.round((count / assessments.length) * 100);
      insights.push({
        type: 'dominant_load',
        value: loadType,
        message: `You typically experience ${loadType.toLowerCase()} (${percentage}% of your assessments). ${loadType === 'Low Load' ? 'This indicates good focus and manageable learning difficulty.' : loadType === 'Moderate Load' ? 'This suggests a balanced learning experience.' : 'Consider taking breaks and reviewing material at a slower pace.'}`
      });
    }

    // Performance correlation - High CLI vs Low CLI
    const highCLI = assessments.filter(a => a.cli !== null && a.cli !== undefined && a.cli > 70);
    const lowCLI = assessments.filter(a => a.cli !== null && a.cli !== undefined && a.cli <= 35);
    
    if (highCLI.length > 0) {
      const highCLIPerformance = highCLI.reduce((sum, a) => sum + (a.testScore || 0), 0) / highCLI.length;
      insights.push({
        type: 'performance_under_load',
        value: Math.round(highCLIPerformance),
        message: `When experiencing high cognitive load, your average score is ${Math.round(highCLIPerformance)}%. ${highCLIPerformance >= 70 ? 'You maintain good performance even under stress!' : 'Consider practicing relaxation techniques before assessments.'}`
      });
    }

    if (lowCLI.length > 0 && highCLI.length > 0) {
      const lowCLIPerformance = lowCLI.reduce((sum, a) => sum + (a.testScore || 0), 0) / lowCLI.length;
      const highCLIPerformance = highCLI.reduce((sum, a) => sum + (a.testScore || 0), 0) / highCLI.length;
      const difference = lowCLIPerformance - highCLIPerformance;
      if (Math.abs(difference) > 5) {
        insights.push({
          type: 'performance_comparison',
          value: Math.round(difference),
          message: `You perform ${Math.round(difference)}% better when cognitive load is low. This shows the importance of staying focused and relaxed during assessments.`
        });
      }
    }

    // Improvement trend
    if (validCLI.length >= 2) {
      const sortedByDate = [...validCLI].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const midPoint = Math.floor(sortedByDate.length / 2);
      const older = sortedByDate.slice(0, midPoint);
      const recent = sortedByDate.slice(midPoint);
      
      if (older.length > 0 && recent.length > 0) {
        const recentAvg = recent.reduce((sum, a) => sum + (a.cli || 0), 0) / recent.length;
        const olderAvg = older.reduce((sum, a) => sum + (a.cli || 0), 0) / older.length;
        const improvement = olderAvg - recentAvg; // Positive = improvement (lower CLI is better)
        
        if (Math.abs(improvement) > 2) {
          insights.push({
            type: 'improvement_trend',
            value: Math.round(improvement * 100) / 100,
            message: improvement > 0 
              ? `Great progress! Your cognitive load has decreased by ${Math.round(improvement)} points, indicating improved focus and learning efficiency.`
              : `Your cognitive load has increased by ${Math.round(Math.abs(improvement))} points. Consider taking more breaks and reviewing material at a comfortable pace.`
          });
        }
      }
    }

    // Total assessments insight
    insights.push({
      type: 'total_assessments',
      value: assessments.length,
      message: `You've completed ${assessments.length} assessment${assessments.length > 1 ? 's' : ''}. ${assessments.length >= 10 ? 'Excellent consistency! Keep up the regular practice.' : assessments.length >= 5 ? 'Good progress! Continue taking assessments to track your improvement.' : 'Keep taking assessments to build a comprehensive learning profile.'}`
    });

    return insights;
  }

  /**
   * Validate cognitive metrics
   * @param {Object} metrics - Metrics to validate
   * @returns {Object} Validation result
   */
  validateMetrics(metrics) {
    const errors = [];

    if (!metrics.avgOnScreen || metrics.avgOnScreen < 0 || metrics.avgOnScreen > 100) {
      errors.push('avgOnScreen must be between 0 and 100');
    }

    if (!metrics.blinkRatePerMin || metrics.blinkRatePerMin < 0) {
      errors.push('blinkRatePerMin must be a positive number');
    }

    if (metrics.headMovement !== undefined && (metrics.headMovement < 0 || metrics.headMovement > 100)) {
      errors.push('headMovement must be between 0 and 100');
    }

    if (metrics.eyeGazeStability !== undefined && (metrics.eyeGazeStability < 0 || metrics.eyeGazeStability > 100)) {
      errors.push('eyeGazeStability must be between 0 and 100');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get optimal learning recommendations based on CLI
   * @param {number} cli - Cognitive Load Index
   * @param {string} classification - CLI classification
   * @returns {Array} Recommendations
   */
  getLearningRecommendations(cli, classification) {
    const recommendations = [];

    switch (classification) {
      case 'Low Load':
        recommendations.push('You can handle more challenging content');
        recommendations.push('Consider increasing learning pace');
        recommendations.push('Try advanced topics in this subject');
        break;
        
      case 'Moderate Load':
        recommendations.push('Current learning pace is optimal');
        recommendations.push('Continue with similar difficulty content');
        recommendations.push('Take short breaks between sessions');
        break;
        
      case 'High Load':
        recommendations.push('Consider reducing content complexity');
        recommendations.push('Take more frequent breaks');
        recommendations.push('Review foundational concepts');
        recommendations.push('Try shorter learning sessions');
        break;
    }

    return recommendations;
  }
}

module.exports = new CLIService();
