const geminiService = require('./geminiService');

// Generate short notes (concise bullet points)
const generateShortNotes = async (transcript) => {
  try {
    console.log('Generating short notes...');
    const shortNotes = await geminiService.generateShortNotes(transcript);
    console.log('Short notes generated successfully');
    return shortNotes;
  } catch (error) {
    console.error('Error generating short notes:', error);
    return generateFallbackShortNotes(transcript);
  }
};

// Generate detailed notes (enhanced with extra content)
const generateDetailedNotes = async (transcript) => {
  try {
    console.log('Generating detailed notes...');
    const detailedNotes = await geminiService.generateDetailedNotes(transcript);
    console.log('Detailed notes generated successfully');
    return detailedNotes;
  } catch (error) {
    console.error('Error generating detailed notes:', error);
    return generateFallbackDetailedNotes(transcript);
  }
};

// Fallback short notes when Gemini API fails
const generateFallbackShortNotes = (transcript) => {
  console.log('Using fallback for short notes');
  
  // Simple extraction of key points
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const keyPoints = sentences.slice(0, 6).map(sentence => 
    `• ${sentence.trim()}`
  );
  
  return keyPoints.join('\n');
};

// Fallback detailed notes when Gemini API fails
const generateFallbackDetailedNotes = (transcript) => {
  console.log('Using fallback for detailed notes');
  
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const mainContent = sentences.slice(0, 8).join('. ');
  
  return `## Video Summary\n\n${mainContent}\n\n## Key Takeaways\n\n• Review the main concepts discussed\n• Practice the techniques shown\n• Apply the knowledge in real scenarios`;
};

// Generate both short and detailed notes
const generateAllNotes = async (transcript) => {
  try {
    console.log('Generating all notes for transcript...');
    
    const [shortNotes, detailedNotes] = await Promise.all([
      generateShortNotes(transcript),
      generateDetailedNotes(transcript)
    ]);
    
    return {
      shortNotes,
      detailedNotes,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating all notes:', error);
    return {
      shortNotes: generateFallbackShortNotes(transcript),
      detailedNotes: generateFallbackDetailedNotes(transcript),
      generatedAt: new Date().toISOString(),
      fallback: true
    };
  }
};

module.exports = {
  generateShortNotes,
  generateDetailedNotes,
  generateAllNotes
};
