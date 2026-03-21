const pdfParseModule = require('pdf-parse');
const fs = require('fs').promises;

// pdf-parse exports an object with PDFParse as a property (the actual function)
const pdfParse = pdfParseModule.PDFParse;

class PDFParserService {
  /**
   * Clean text by removing page numbers, navigation text, and other artifacts
   */
  cleanText(text) {
    // Remove page navigation text like "-- 2 of 4 -- Quiz: Strings in Python"
    text = text.replace(/--\s*\d+\s+of\s+\d+\s+--[^\n]*/gi, '');
    
    // Remove standalone page numbers
    text = text.replace(/^\s*\d+\s*$/gm, '');
    
    // Remove "0 of X questions answered" type text
    text = text.replace(/\d+\s+of\s+\d+\s+questions?\s+answered/gi, '');
    
    // Remove "Cancel" and "Submit Quiz" buttons text
    text = text.replace(/Cancel\s*Submit\s*Quiz/gi, '');
    
    // Remove multiple consecutive newlines (more than 2)
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // Remove lines that are just dashes or separators
    text = text.replace(/^[-=\s]{3,}$/gm, '');
    
    return text.trim();
  }

  /**
   * Parse PDF and extract quiz questions
   * Expected PDF format:
   * 
   * Question 1: [Question text]
   * A) [Option A]
   * B) [Option B]
   * C) [Option C]
   * D) [Option D]
   * Correct Answer: [A/B/C/D]
   * Points: [number] (optional, defaults to 1)
   * Explanation: [explanation text] (optional)
   * 
   * Question 2: ...
   */
  async parsePDF(buffer) {
    try {
      // PDFParse is a class that needs to be instantiated with options
      const parser = new pdfParse({ data: buffer });
      const result = await parser.getText();
      let text = result.text || result;
      
      // Clean up the text - remove page numbers, navigation text, etc.
      text = this.cleanText(text);
      
      // Split by question markers
      const questionBlocks = this.extractQuestionBlocks(text);
      
      const questions = questionBlocks.map((block, index) => {
        return this.parseQuestionBlock(block, index + 1);
      }).filter(q => q !== null);

      return {
        success: true,
        questions,
        totalQuestions: questions.length
      };
    } catch (error) {
      console.error('PDF parsing error:', error);
      throw new Error('Failed to parse PDF: ' + error.message);
    }
  }

  /**
   * Extract question blocks from text
   */
  extractQuestionBlocks(text) {
    // Split by "Question" followed by a number
    const questionRegex = /Question\s+\d+[:.]/gi;
    const matches = [...text.matchAll(questionRegex)];
    
    if (matches.length === 0) {
      // Try alternative format: Q1, Q2, etc.
      const altRegex = /Q\d+[:.]/gi;
      const altMatches = [...text.matchAll(altRegex)];
      if (altMatches.length > 0) {
        return this.splitByPattern(text, altRegex);
      }
      // If no pattern found, try to split by numbered questions
      return this.splitByNumberedQuestions(text);
    }
    
    return this.splitByPattern(text, questionRegex);
  }

  splitByPattern(text, regex) {
    const blocks = [];
    const matches = [...text.matchAll(regex)];
    
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i < matches.length - 1 ? matches[i + 1].index : text.length;
      blocks.push(text.substring(start, end).trim());
    }
    
    return blocks;
  }

  splitByNumberedQuestions(text) {
    // Try to find numbered questions (1., 2., etc.)
    const numberedRegex = /^\d+[\.\)]\s+/gm;
    const matches = [...text.matchAll(numberedRegex)];
    
    if (matches.length > 0) {
      return this.splitByPattern(text, numberedRegex);
    }
    
    // Last resort: split by double newlines
    return text.split(/\n\s*\n/).filter(block => block.trim().length > 0);
  }

  /**
   * Parse a single question block
   */
  parseQuestionBlock(block, questionNumber) {
    try {
      // Clean up the block
      block = block.trim();
      if (!block) return null;

      // Extract question text (first line after "Question X:" or just the first line)
      let questionMatch = block.match(/(?:Question\s+\d+[:.]|Q\d+[:.]|^\d+[\.\)]\s+)(.+?)(?=\n[A-Z][\)\.]|$)/is);
      let questionText = '';
      
      if (questionMatch) {
        questionText = questionMatch[1].trim();
      } else {
        // Try to find question text before options
        const lines = block.split('\n').filter(l => l.trim());
        if (lines.length < 3) return null;
        
        // Find where options start (line starting with A), B), etc.)
        let optionStartIndex = -1;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          // Skip navigation text
          if (line.match(/^--\s*\d+\s+of\s+\d+\s+--/i) || 
              line.match(/^\d+\s+of\s+\d+\s+questions?\s+answered/i)) {
            continue;
          }
          if (/^[A-D][\)\.]\s/.test(line)) {
            optionStartIndex = i;
            break;
          }
        }
        
        if (optionStartIndex > 0) {
          // Get question text lines, filtering out navigation text
          const questionLines = lines.slice(0, optionStartIndex).filter(line => {
            const trimmed = line.trim();
            return !trimmed.match(/^--\s*\d+\s+of\s+\d+\s+--/i) &&
                   !trimmed.match(/^\d+\s+of\s+\d+\s+questions?\s+answered/i) &&
                   !trimmed.match(/^(Cancel|Submit\s+Quiz)$/i);
          });
          questionText = questionLines.join(' ').trim();
        } else {
          questionText = lines[0].trim();
        }
      }
      
      // Clean question text of any remaining navigation artifacts
      questionText = questionText.replace(/--\s*\d+\s+of\s+\d+\s+--[^\n]*/gi, '').trim();
      
      if (!questionText) return null;

      // Extract options (A), B), C), D) or A. B. C. D.)
      // First, find all option markers
      const lines = block.split('\n');
      const options = [];
      const optionMap = new Map(); // Map to store option letter -> option object
      let currentOption = null;
      
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        
        // Skip empty lines
        if (!line) continue;
        
        // Skip lines that look like navigation/page numbers
        if (line.match(/^--\s*\d+\s+of\s+\d+\s+--/i) || 
            line.match(/^\d+\s+of\s+\d+\s+questions?\s+answered/i) ||
            line.match(/^(Cancel|Submit\s+Quiz)$/i)) {
          continue;
        }
        
        // Check if line starts with an option marker (A), B), etc.)
        const optionMatch = line.match(/^([A-Z])[\)\.]\s*(.+)$/);
        if (optionMatch) {
          // Save previous option if exists
          if (currentOption) {
            const optionText = currentOption.text.trim();
            // Clean up option text - remove navigation artifacts
            const cleanedText = optionText.replace(/--\s*\d+\s+of\s+\d+\s+--[^\n]*/gi, '').trim();
            if (cleanedText) {
              const optionObj = {
                text: cleanedText,
                isCorrect: false
              };
              options.push(optionObj);
              optionMap.set(currentOption.letter, optionObj);
            }
          }
          // Start new option
          let optionText = optionMatch[2].trim();
          // Clean up immediately
          optionText = optionText.replace(/--\s*\d+\s+of\s+\d+\s+--[^\n]*/gi, '').trim();
          currentOption = {
            letter: optionMatch[1],
            text: optionText
          };
        } else if (currentOption && !line.match(/^(Correct|Points?|Explanation)/i)) {
          // Skip navigation text
          if (line.match(/^--\s*\d+\s+of\s+\d+\s+--/i) || 
              line.match(/^\d+\s+of\s+\d+\s+questions?\s+answered/i)) {
            continue;
          }
          // Continue current option text (multi-line option)
          currentOption.text += ' ' + line;
        } else if (line.match(/^(Correct|Points?|Explanation)/i)) {
          // Save current option and stop
          if (currentOption) {
            const optionText = currentOption.text.trim();
            const cleanedText = optionText.replace(/--\s*\d+\s+of\s+\d+\s+--[^\n]*/gi, '').trim();
            if (cleanedText) {
              const optionObj = {
                text: cleanedText,
                isCorrect: false
              };
              options.push(optionObj);
              optionMap.set(currentOption.letter, optionObj);
            }
            currentOption = null;
          }
          break;
        }
      }
      
      // Don't forget the last option
      if (currentOption) {
        const optionText = currentOption.text.trim();
        const cleanedText = optionText.replace(/--\s*\d+\s+of\s+\d+\s+--[^\n]*/gi, '').trim();
        if (cleanedText) {
          const optionObj = {
            text: cleanedText,
            isCorrect: false
          };
          options.push(optionObj);
          optionMap.set(currentOption.letter, optionObj);
        }
      }

      if (options.length < 2) {
        console.warn(`Question ${questionNumber}: Not enough options found`);
        return null;
      }

      // Extract correct answer
      const correctAnswerMatch = block.match(/Correct\s+Answer[:\s]+([A-Z])/i);
      const correctAnswer = correctAnswerMatch ? correctAnswerMatch[1].toUpperCase() : null;
      
      if (correctAnswer && optionMap.has(correctAnswer)) {
        // Mark the correct option using the map
        optionMap.get(correctAnswer).isCorrect = true;
      } else if (correctAnswer) {
        // Try to find by index if letter not found in map
        const correctIndex = correctAnswer.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
        if (options[correctIndex]) {
          options[correctIndex].isCorrect = true;
        }
      } else {
        // If no correct answer specified, mark first as correct (user can edit)
        if (options.length > 0) {
          options[0].isCorrect = true;
        }
      }

      // Extract points
      const pointsMatch = block.match(/Points?[:\s]+(\d+)/i);
      const points = pointsMatch ? parseInt(pointsMatch[1]) : 1;

      // Extract explanation
      const explanationMatch = block.match(/Explanation[:\s]+(.+?)(?=\n\n|$)/is);
      const explanation = explanationMatch ? explanationMatch[1].trim() : '';

      return {
        question: questionText,
        type: 'multiple-choice',
        options: options,
        points: points,
        explanation: explanation
      };
    } catch (error) {
      console.error(`Error parsing question ${questionNumber}:`, error);
      return null;
    }
  }

  /**
   * Validate parsed questions
   */
  validateQuestions(questions) {
    const errors = [];
    
    questions.forEach((q, index) => {
      if (!q.question || q.question.trim().length === 0) {
        errors.push(`Question ${index + 1}: Missing question text`);
      }
      if (!q.options || q.options.length < 2) {
        errors.push(`Question ${index + 1}: Need at least 2 options`);
      }
      const hasCorrect = q.options.some(opt => opt.isCorrect);
      if (!hasCorrect) {
        errors.push(`Question ${index + 1}: No correct answer specified`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = new PDFParserService();

