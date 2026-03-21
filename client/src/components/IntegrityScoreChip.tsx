/**
 * Integrity Score Chip Component
 * Displays assessment integrity score with color coding
 */

interface IntegrityScoreChipProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const IntegrityScoreChip: React.FC<IntegrityScoreChipProps> = ({ 
  score, 
  size = 'md',
  showLabel = true 
}) => {
  const getColor = (score: number) => {
    if (score >= 85) return 'bg-green-100 text-green-800 border-green-300';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  const getIcon = (score: number) => {
    if (score >= 85) return '🟢';
    if (score >= 60) return '🟡';
    return '🔴';
  };

  const getLabel = (score: number) => {
    if (score >= 85) return 'High Integrity';
    if (score >= 60) return 'Moderate Integrity';
    return 'Low Integrity';
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${getColor(score)} ${sizeClasses[size]}`}
      title={`Integrity Score: ${score}/100`}
    >
      <span>{getIcon(score)}</span>
      <span className="font-semibold">{score}</span>
      {showLabel && (
        <span className="hidden sm:inline">{getLabel(score)}</span>
      )}
    </div>
  );
};

export default IntegrityScoreChip;


