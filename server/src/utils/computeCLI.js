/**
 * Cognitive Load Index (CLI) Computation
 * 
 * Formula: CLI = 0.35*(100-focusPct) + 0.35*confusionPct + 0.2*blinkNorm + 0.1*timePressure
 * 
 * Ranges:
 * - Low Load: 0–35
 * - Moderate Load: 36–70  
 * - High Load: 71–100
 */

/**
 * Normalize blink rate to 0-100 scale
 * @param {number} blinkRate - Blinks per minute
 * @returns {number} Normalized blink rate (0-100)
 */
const normalizeBlinkRate = (blinkRate) => {
  // Normal blink rate: 15-20 per minute
  // High stress: 25+ per minute
  const minBlink = 10;
  const maxBlink = 40;
  
  if (blinkRate < minBlink) return 0;
  if (blinkRate > maxBlink) return 100;
  
  return ((blinkRate - minBlink) / (maxBlink - minBlink)) * 100;
};

/**
 * Calculate time pressure factor
 * @param {number} timeSpent - Time spent on question in seconds
 * @param {number} averageTime - Average time for similar questions
 * @returns {number} Time pressure factor (0-100)
 */
const calculateTimePressure = (timeSpent, averageTime = 30) => {
  if (timeSpent <= averageTime * 0.5) return 0; // Very fast, no pressure
  if (timeSpent >= averageTime * 2) return 100; // Very slow, high pressure
  
  return ((timeSpent - averageTime * 0.5) / (averageTime * 1.5)) * 100;
};

/**
 * Calculate confusion percentage based on metrics
 * @param {Object} metrics - Cognitive metrics
 * @returns {number} Confusion percentage (0-100)
 */
const calculateConfusionPct = (metrics) => {
  const { avgOnScreen, headMovement, eyeGazeStability } = metrics;
  
  // High confusion indicators:
  // - Low on-screen time
  // - High head movement
  // - Low eye gaze stability
  
  const onScreenFactor = (100 - avgOnScreen) / 100;
  const headMovementFactor = headMovement / 100;
  const gazeStabilityFactor = (100 - eyeGazeStability) / 100;
  
  // Weighted average of confusion indicators
  return (onScreenFactor * 0.4 + headMovementFactor * 0.3 + gazeStabilityFactor * 0.3) * 100;
};

/**
 * Compute Cognitive Load Index
 * @param {Object} params - Parameters for CLI calculation
 * @param {number} params.focusPct - Focus percentage (0-100)
 * @param {number} params.blinkRate - Blink rate per minute
 * @param {number} params.timeSpent - Time spent in seconds
 * @param {Object} params.metrics - Additional cognitive metrics
 * @param {number} params.averageTime - Average time for similar tasks
 * @returns {Object} CLI result with classification
 */
const computeCLI = (params) => {
  const {
    focusPct = 85,
    blinkRate = 15,
    timeSpent = 30,
    metrics = {},
    averageTime = 30
  } = params;

  // Calculate individual components
  const focusComponent = 0.35 * (100 - focusPct);
  const confusionPct = calculateConfusionPct({
    avgOnScreen: focusPct,
    headMovement: metrics.headMovement || 0,
    eyeGazeStability: metrics.eyeGazeStability || 85
  });
  const confusionComponent = 0.35 * confusionPct;
  const blinkComponent = 0.2 * normalizeBlinkRate(blinkRate);
  const timePressure = calculateTimePressure(timeSpent, averageTime);
  const timeComponent = 0.1 * timePressure;

  // Calculate final CLI
  const cli = focusComponent + confusionComponent + blinkComponent + timeComponent;
  
  // Classify cognitive load
  let classification;
  if (cli <= 35) {
    classification = 'Low Load';
  } else if (cli <= 70) {
    classification = 'Moderate Load';
  } else {
    classification = 'High Load';
  }

  return {
    cli: Math.round(cli * 100) / 100,
    classification,
    components: {
      focusComponent: Math.round(focusComponent * 100) / 100,
      confusionComponent: Math.round(confusionComponent * 100) / 100,
      blinkComponent: Math.round(blinkComponent * 100) / 100,
      timeComponent: Math.round(timeComponent * 100) / 100
    },
    breakdown: {
      focusPct,
      confusionPct: Math.round(confusionPct * 100) / 100,
      normalizedBlinkRate: Math.round(normalizeBlinkRate(blinkRate) * 100) / 100,
      timePressure: Math.round(timePressure * 100) / 100
    }
  };
};

/**
 * Analyze cognitive load trends over time
 * @param {Array} assessments - Array of assessment data with CLI values
 * @returns {Object} Trend analysis
 */
const analyzeCLITrends = (assessments) => {
  if (assessments.length === 0) {
    return {
      trend: 'insufficient-data',
      averageCLI: 0,
      improvement: 0,
      recommendations: ['Complete more assessments to see trends']
    };
  }

  const cliValues = assessments.map(a => a.cli);
  const averageCLI = cliValues.reduce((sum, cli) => sum + cli, 0) / cliValues.length;
  
  // Calculate trend
  let trend = 'stable';
  let improvement = 0;
  
  if (cliValues.length >= 4) {
    // Use last 3 vs previous 3 for better comparison
    const recent = cliValues.slice(0, 3); // Most recent 3 (sorted desc, so first 3)
    const older = cliValues.slice(3, 6); // Previous 3
    
    if (recent.length >= 2 && older.length >= 2) {
      const recentAvg = recent.reduce((sum, cli) => sum + (cli || 0), 0) / recent.length;
      const olderAvg = older.reduce((sum, cli) => sum + (cli || 0), 0) / older.length;
      improvement = olderAvg - recentAvg; // Positive = improvement (lower CLI is better)
      
      if (improvement > 2) trend = 'improving';
      else if (improvement < -2) trend = 'declining';
    }
  } else if (cliValues.length >= 2) {
    // For fewer assessments, compare first half vs second half
    const midPoint = Math.floor(cliValues.length / 2);
    const recent = cliValues.slice(0, midPoint);
    const older = cliValues.slice(midPoint);
    
    if (recent.length > 0 && older.length > 0) {
      const recentAvg = recent.reduce((sum, cli) => sum + (cli || 0), 0) / recent.length;
      const olderAvg = older.reduce((sum, cli) => sum + (cli || 0), 0) / older.length;
      improvement = olderAvg - recentAvg;
      
      if (improvement > 2) trend = 'improving';
      else if (improvement < -2) trend = 'declining';
    }
  }

  // Generate recommendations based on trend
  const recommendations = [];
  if (trend === 'improving') {
    recommendations.push('Great progress! Your cognitive load is decreasing.');
  } else if (trend === 'declining') {
    recommendations.push('Consider taking breaks between learning sessions.');
    recommendations.push('Try focusing on one topic at a time.');
  } else {
    recommendations.push('Maintain consistent learning habits.');
  }

  return {
    trend,
    averageCLI: Math.round(averageCLI * 100) / 100,
    improvement: Math.round(improvement * 100) / 100,
    recommendations,
    dataPoints: cliValues.length
  };
};

module.exports = {
  computeCLI,
  analyzeCLITrends,
  normalizeBlinkRate,
  calculateTimePressure,
  calculateConfusionPct
};
