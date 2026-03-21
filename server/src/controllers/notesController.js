const { validationResult } = require('express-validator');
const Notes = require('../models/Notes');
const notesService = require('../services/notesService');
const { asyncHandler } = require('../middlewares/errorHandler');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

/**
 * Generate notes for a video
 */
const generateNotes = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user._id;
  const { videoData } = req.body;

  if (!videoId) {
    return res.status(400).json({
      success: false,
      message: 'Video ID is required'
    });
  }

  try {
    console.log(`📝 Generating notes for video: ${videoId}`);
    
    // Check if regeneration is requested (force=true in query params or body)
    const forceRegenerate = req.query.force === 'true' || req.body.force === true || req.body.regenerate === true;
    
    // Check if notes already exist
    const existingNotes = await notesService.getNotes(userId, videoId);
    if (existingNotes && !forceRegenerate) {
      return res.json({
        success: true,
        message: 'Notes already exist for this video',
        data: { notes: existingNotes }
      });
    }

    // If force regenerate, delete existing notes first
    if (existingNotes && forceRegenerate) {
      console.log(`🔄 Force regeneration requested, deleting existing notes...`);
      await notesService.deleteNotes(userId, videoId);
      console.log(`✅ Existing notes deleted, regenerating...`);
    }

    // Generate new notes (will use cached transcript from DB)
    const notes = await notesService.generateNotes(userId, videoId, videoData || {});

    res.json({
      success: true,
      message: 'Notes generated successfully',
      data: { notes }
    });
  } catch (error) {
    console.error('Error generating notes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate notes',
      error: error.message
    });
  }
});

/**
 * Get notes for a video
 */
const getNotes = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user._id;

  try {
    const notes = await notesService.getNotes(userId, videoId);

    if (!notes) {
      return res.status(404).json({
        success: false,
        message: 'Notes not found for this video'
      });
    }

    res.json({
      success: true,
      data: { notes }
    });
  } catch (error) {
    console.error('Error getting notes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notes',
      error: error.message
    });
  }
});

/**
 * Get all user notes
 */
const getUserNotes = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 20 } = req.query;

  try {
    const skip = (page - 1) * limit;
    const notes = await notesService.getUserNotes(userId, parseInt(limit), skip);

    res.json({
      success: true,
      data: { notes }
    });
  } catch (error) {
    console.error('Error getting user notes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user notes',
      error: error.message
    });
  }
});

/**
 * Generate and download PDF
 */
const downloadPDF = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user._id;

  try {
    console.log(`📄 Starting PDF download for video: ${videoId}`);
    
    const notes = await notesService.getNotes(userId, videoId);

    if (!notes) {
      return res.status(404).json({
        success: false,
        message: 'Notes not found for this video'
      });
    }

    console.log(`📄 Generating PDF for video: ${videoId}`);

    // Generate PDF with timeout
    const pdfBuffer = await Promise.race([
      generateNotesPDF(notes),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('PDF generation timeout')), 120000) // 2 minutes timeout
      )
    ]);

    // Increment download count
    await notes.incrementDownloadCount();

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${notes.videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_notes.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    console.log(`✅ PDF generated successfully, size: ${pdfBuffer.length} bytes`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    
    if (error.message === 'PDF generation timeout') {
      return res.status(408).json({
        success: false,
        message: 'PDF generation timed out. Please try again.',
        error: 'Timeout'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF',
      error: error.message
    });
  }
});

/**
 * Generate PDF from notes using Puppeteer
 */
async function generateNotesPDF(notes) {
  let browser;
  
  try {
    console.log('🚀 Launching Puppeteer browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
      timeout: 60000 // 60 seconds timeout for browser launch
    });

    console.log('📄 Creating new page...');
    const page = await browser.newPage();
    
    // Set page timeout
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    
    // Generate HTML content
    console.log('📝 Generating HTML content...');
    const htmlContent = generateNotesHTML(notes);
    
    console.log('🌐 Setting page content...');
    await page.setContent(htmlContent, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    console.log('📊 Generating PDF...');
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },
      timeout: 30000
    });

    console.log('✅ PDF generated successfully');
    return pdfBuffer;
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    throw error;
  } finally {
    if (browser) {
      console.log('🔒 Closing browser...');
      await browser.close();
    }
  }
}

/**
 * Generate HTML content for PDF
 */
function generateNotesHTML(notes) {
  const shortNotesWordCount = notes.shortNotes ? notes.shortNotes.split(' ').length : 0;
  const detailedNotesWordCount = notes.detailedNotes ? notes.detailedNotes.split(' ').length : 0;
  const totalWordCount = shortNotesWordCount + detailedNotesWordCount;
  
  // Escape HTML characters to prevent issues
  const escapeHtml = (text) => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
  
  const safeTitle = escapeHtml(notes.videoTitle || 'Untitled Video');
  const safeShortNotes = escapeHtml(notes.shortNotes || 'No short notes available');
  const safeDetailedNotes = escapeHtml(notes.detailedNotes || 'No detailed notes available');
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${safeTitle} - Notes</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                background: #fff;
                font-size: 14px;
            }
            
            .container {
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }
            
            .header {
                text-align: center;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 3px solid #3b82f6;
            }
            
            .header h1 {
                color: #1e40af;
                font-size: 24px;
                margin-bottom: 10px;
            }
            
            .header .meta {
                color: #6b7280;
                font-size: 12px;
            }
            
            .section {
                margin-bottom: 30px;
            }
            
            .section h2 {
                color: #1e40af;
                font-size: 18px;
                margin-bottom: 15px;
                padding-bottom: 5px;
                border-bottom: 2px solid #e5e7eb;
            }
            
            .short-notes, .detailed-notes {
                background: #f8fafc;
                padding: 20px;
                border-radius: 8px;
                border-left: 4px solid #3b82f6;
                margin-bottom: 20px;
                white-space: pre-wrap;
                font-size: 13px;
            }
            
            .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 2px solid #e5e7eb;
                text-align: center;
                color: #6b7280;
                font-size: 12px;
            }
            
            .stats {
                display: flex;
                justify-content: space-around;
                margin-bottom: 20px;
                flex-wrap: wrap;
            }
            
            .stat {
                text-align: center;
                padding: 15px;
                background: #f8fafc;
                border-radius: 6px;
                margin: 5px;
                min-width: 120px;
            }
            
            .stat .value {
                font-size: 20px;
                font-weight: bold;
                color: #1e40af;
            }
            
            .stat .label {
                font-size: 11px;
                color: #6b7280;
                text-transform: uppercase;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${safeTitle}</h1>
                <div class="meta">
                    Generated on ${new Date(notes.createdAt).toLocaleDateString()} | 
                    Duration: ${Math.floor(notes.videoDuration / 60)}:${(notes.videoDuration % 60).toString().padStart(2, '0')}
                </div>
            </div>

            <div class="stats">
                <div class="stat">
                    <div class="value">${notes.estimatedReadTime?.shortNotes || 0}</div>
                    <div class="label">Short Notes (min)</div>
                </div>
                <div class="stat">
                    <div class="value">${notes.estimatedReadTime?.detailedNotes || 0}</div>
                    <div class="label">Detailed Notes (min)</div>
                </div>
                <div class="stat">
                    <div class="value">${totalWordCount}</div>
                    <div class="label">Total Words</div>
                </div>
            </div>

            <div class="section">
                <h2>📝 Short Notes</h2>
                <div class="short-notes">${safeShortNotes}</div>
            </div>

            <div class="section">
                <h2>📚 Detailed Notes</h2>
                <div class="detailed-notes">${safeDetailedNotes}</div>
            </div>

            <div class="footer">
                <p>Generated by Intelligent Learning Assistant (ILA)</p>
                <p>For personal use only</p>
            </div>
        </div>
    </body>
    </html>
  `;
}

/**
 * Delete notes
 */
const deleteNotes = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user._id;

  try {
    const result = await notesService.deleteNotes(userId, videoId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Notes not found for this video'
      });
    }

    res.json({
      success: true,
      message: 'Notes deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notes',
      error: error.message
    });
  }
});

module.exports = {
  generateNotes,
  getNotes,
  getUserNotes,
  downloadPDF,
  deleteNotes
};
