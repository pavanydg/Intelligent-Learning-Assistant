const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const config = require('../config/env');
const Transcript = require('../models/Transcript');

class AssemblyAIService {
  constructor() {
    this.apiKey = config.assemblyaiApiKey;
    this.baseUrl = 'https://api.assemblyai.com/v2';
    
    if (!this.apiKey) {
      console.warn('⚠️  ASSEMBLYAI_API_KEY not found in environment variables');
    } else {
      console.log('✅ AssemblyAI API key found, initializing service...');
    }
  }

  /**
   * Extract audio from YouTube video using yt-dlp
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<string>} Path to extracted audio file
   */
  async extractAudioFromYouTube(videoId) {
    return new Promise((resolve, reject) => {
      const tempDir = path.join(__dirname, '../../temp');
      
      // Create temp directory if it doesn't exist
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const audioPath = path.join(tempDir, `${videoId}.mp3`);
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

      console.log(`Extracting audio from YouTube video: ${videoId}`);

      // Try different yt-dlp commands based on system
      const ytdlpCommands = [
        'yt-dlp',           // Global installation
        'python -m yt_dlp', // Python module
        'python3 -m yt_dlp' // Python3 module
      ];

      // Auto-detect FFmpeg or use audio-only formats
      let ffmpegPath = null;
      
      // Try to find FFmpeg in PATH first
      try {
        const { execSync } = require('child_process');
        if (process.platform === 'win32') {
          try {
            const ffmpegLocation = execSync('where.exe ffmpeg', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n')[0];
            if (ffmpegLocation && fs.existsSync(ffmpegLocation)) {
              ffmpegPath = path.dirname(ffmpegLocation);
              console.log(`✅ Found ffmpeg in PATH: ${ffmpegPath}`);
            }
          } catch (e) {
            // FFmpeg not in PATH, try common locations
          }
        }
      } catch (e) {
        // Continue to try hardcoded paths
      }
      
      // If not found in PATH, try common installation locations
      if (!ffmpegPath) {
        const possiblePaths = [
          'C:\\ffmpeg\\ffmpeg-8.0-essentials_build\\bin',
          'C:\\Program Files\\ffmpeg\\bin',
          'C:\\ffmpeg\\bin',
          path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\WinGet\\Packages', 'yt-dlp.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-N-121583-g4348bde2d2-win64-gpl', 'bin')
        ];
        
        for (const testPath of possiblePaths) {
          if (testPath && fs.existsSync(testPath)) {
            const ffmpegExe = path.join(testPath, 'ffmpeg.exe');
            if (fs.existsSync(ffmpegExe)) {
              ffmpegPath = testPath;
              console.log(`✅ Found ffmpeg at: ${ffmpegPath}`);
              break;
            }
          }
        }
      }
      
      // If FFmpeg not found, we'll download audio-only formats that don't need conversion
      if (!ffmpegPath) {
        console.warn('⚠️  FFmpeg not found. Will download audio-only format without conversion.');
      }

      let ytdlpProcess = null;
      let commandUsed = '';
      const baseOutputPath = path.join(tempDir, `${videoId}`);

      // Try each command until one works
      for (const cmd of ytdlpCommands) {
        try {
          const [command, ...args] = cmd.split(' ');
          let fullArgs = [];
          
          if (ffmpegPath && fs.existsSync(ffmpegPath)) {
            // If FFmpeg is available, extract audio and convert to MP3
            fullArgs = [
              ...args,
              '--extract-audio',
              '--audio-format', 'mp3',
              '--ffmpeg-location', ffmpegPath,
              '--output', audioPath,
              youtubeUrl
            ];
          } else {
            // If no FFmpeg, download audio-only format directly (webm, m4a, opus, etc.)
            // These formats don't need conversion and AssemblyAI can accept them
            console.log('⚠️  No ffmpeg found, downloading audio-only format without conversion');
            fullArgs = [
              ...args,
              '--format', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio[ext=opus]/bestaudio',
              '--output', `${baseOutputPath}.%(ext)s`,
              youtubeUrl
            ];
          }

          console.log(`Trying command: ${command} ${fullArgs.join(' ')}`);
          
          ytdlpProcess = spawn(command, fullArgs);
          commandUsed = cmd;
          break;
        } catch (error) {
          console.log(`Command ${cmd} failed, trying next...`);
          continue;
        }
      }

      if (!ytdlpProcess) {
        reject(new Error('yt-dlp not found in any of the expected locations'));
        return;
      }

      let stderrOutput = '';
      let stdoutOutput = '';

      ytdlpProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdoutOutput += output;
        console.log(`yt-dlp stdout: ${output}`);
      });

      ytdlpProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderrOutput += output;
        console.error(`yt-dlp stderr: ${output}`);
      });

      ytdlpProcess.on('close', (code) => {
        // Check for output file - it might be .mp3 or .webm/.m4a/.opus depending on format
        const possibleExtensions = ['.mp3', '.webm', '.m4a', '.opus', '.ogg'];
        let foundAudioPath = null;
        
        // First check if the expected MP3 file exists
        if (fs.existsSync(audioPath)) {
          foundAudioPath = audioPath;
        } else {
          // If MP3 doesn't exist, check for other audio formats (when downloaded without conversion)
          for (const ext of possibleExtensions.slice(1)) { // Skip .mp3, already checked
            const testPath = baseOutputPath + ext;
            if (fs.existsSync(testPath)) {
              foundAudioPath = testPath;
              console.log(`📁 Found audio file in ${ext} format: ${foundAudioPath}`);
              break;
            }
          }
        }
        
        if (code === 0 && foundAudioPath) {
          console.log(`✅ Audio file ready: ${foundAudioPath} (${path.extname(foundAudioPath)})`);
          resolve(foundAudioPath);
        } else if (foundAudioPath) {
          // File was downloaded but process exited with error (likely conversion failed)
          // Use the downloaded file anyway - AssemblyAI can handle webm/m4a/opus
          console.log(`⚠️  yt-dlp exited with code ${code}, but audio file was downloaded. Using: ${foundAudioPath}`);
          resolve(foundAudioPath);
        } else {
          console.error(`yt-dlp process exited with code ${code} using command: ${commandUsed}`);
          
          // Provide more detailed error message
          let errorMessage = `Failed to extract audio from YouTube video. `;
          if (stderrOutput.includes('NoneType')) {
            errorMessage += `The video may be unavailable, private, or have restricted access. `;
          } else if (stderrOutput.includes('Private video')) {
            errorMessage += `This video is private and cannot be accessed. `;
          } else if (stderrOutput.includes('Video unavailable')) {
            errorMessage += `This video is unavailable or has been removed. `;
          } else if (stderrOutput.includes('Sign in to confirm your age')) {
            errorMessage += `This video requires age verification and cannot be accessed. `;
          }
          errorMessage += `Error details: ${stderrOutput.trim() || 'Unknown error'}`;
          
          reject(new Error(errorMessage));
        }
      });

      ytdlpProcess.on('error', (error) => {
        console.error(`yt-dlp error with ${commandUsed}: ${error}`);
        reject(new Error(`yt-dlp not found or failed to execute with command: ${commandUsed}`));
      });
    });
  }

  /**
   * Upload audio file to AssemblyAI
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<string>} Upload URL
   */
  async uploadAudio(audioPath) {
    try {
      console.log(`Uploading audio file: ${audioPath}`);
      
      const audioBuffer = fs.readFileSync(audioPath);
      
      const response = await axios.post(`${this.baseUrl}/upload`, audioBuffer, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/octet-stream'
        }
      });

      console.log('Audio uploaded successfully');
      return response.data.upload_url;
    } catch (error) {
      console.error('Error uploading audio:', error.response?.data || error.message);
      throw new Error('Failed to upload audio to AssemblyAI');
    }
  }

  /**
   * Create transcription request with AssemblyAI
   * @param {string} audioUrl - Uploaded audio URL
   * @returns {Promise<string>} Transcript ID
   */
  async createTranscript(audioUrl) {
    try {
      console.log('Creating transcription request...');
      
      const response = await axios.post(`${this.baseUrl}/transcript`, {
        audio_url: audioUrl,
        language_detection: true,
        summarization: true,
        summary_model: 'informative',
        summary_type: 'paragraph',
        auto_highlights: true,
        sentiment_analysis: true
      }, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      console.log(`Transcription request created: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      console.error('Error creating transcription:', error.response?.data || error.message);
      throw new Error('Failed to create transcription request');
    }
  }

  /**
   * Poll for transcription completion
   * @param {string} transcriptId - Transcript ID
   * @returns {Promise<Object>} Completed transcript data
   */
  async pollTranscript(transcriptId) {
    const maxAttempts = 60; // 5 minutes max (5 second intervals)
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        console.log(`Polling transcript ${transcriptId} (attempt ${attempts + 1}/${maxAttempts})`);
        
        const response = await axios.get(`${this.baseUrl}/transcript/${transcriptId}`, {
          headers: {
            'Authorization': this.apiKey
          }
        });

        const data = response.data;
        console.log(`Transcript status: ${data.status}`);

        if (data.status === 'completed') {
          console.log('Transcription completed successfully');
          return data;
        } else if (data.status === 'error') {
          throw new Error(`Transcription failed: ${data.error}`);
        }

        // Wait 5 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;

      } catch (error) {
        console.error('Error polling transcript:', error.response?.data || error.message);
        throw new Error('Failed to poll transcription status');
      }
    }

    throw new Error('Transcription timeout - took too long to complete');
  }

  /**
   * Get transcript for a YouTube video using AssemblyAI
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Transcript data
   */
  async getTranscript(videoId) {
    try {
      if (!this.apiKey) {
        throw new Error('AssemblyAI API key not configured');
      }

      console.log(`Getting transcript for video: ${videoId}`);

      // Cache: check existing transcript first
      try {
        const cached = await Transcript.findOne({ videoId });
        if (cached && cached.transcript && cached.transcript.length > 50) {
          console.log('✅ Using cached transcript from database');
          await cached.touchLastUsed();
          return {
            transcript: cached.transcript,
            language: cached.language || 'en',
            wordCount: cached.wordCount || (cached.transcript.split(' ').length),
            duration: cached.duration || 0,
            hasTranscript: true,
            summary: '',
            highlights: [],
            sentiment: [],
            source: cached.source || 'cache'
          };
        }
      } catch (cacheErr) {
        console.warn('⚠️ Transcript cache lookup failed:', cacheErr.message);
      }

      // Step 1: Extract audio from YouTube
      const audioPath = await this.extractAudioFromYouTube(videoId);

      // Step 2: Upload audio to AssemblyAI
      const uploadUrl = await this.uploadAudio(audioPath);

      // Step 3: Create transcription request
      const transcriptId = await this.createTranscript(uploadUrl);

      // Step 4: Poll for completion
      const result = await this.pollTranscript(transcriptId);

      // Step 5: Clean up temporary audio file
      try {
        fs.unlinkSync(audioPath);
        console.log('Temporary audio file cleaned up');
      } catch (cleanupError) {
        console.warn('Failed to clean up temporary file:', cleanupError.message);
      }

      // Step 6: Format result for ILA
      const transcriptData = {
        transcript: result.text,
        language: result.language_code || 'en',
        wordCount: result.text.split(' ').length,
        duration: result.audio_duration || 0,
        hasTranscript: true,
        summary: result.summary || '',
        highlights: result.auto_highlights?.results || [],
        sentiment: result.sentiment_analysis_results || [],
        source: 'assemblyai'
      };

      console.log('AssemblyAI transcript processed successfully:', {
        wordCount: transcriptData.wordCount,
        language: transcriptData.language,
        hasSummary: !!transcriptData.summary,
        duration: transcriptData.duration
      });

      // Save/update cache
      try {
        const savedTranscript = await Transcript.findOneAndUpdate(
          { videoId },
          {
            videoId,
            transcript: transcriptData.transcript,
            language: transcriptData.language,
            wordCount: transcriptData.wordCount,
            duration: transcriptData.duration,
            source: 'assemblyai',
            'metadata.lastUsedAt': new Date()
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log('🗄️ Transcript cached in database:', {
          videoId: savedTranscript.videoId,
          transcriptLength: savedTranscript.transcript.length,
          wordCount: savedTranscript.wordCount,
          language: savedTranscript.language
        });
      } catch (saveErr) {
        console.warn('⚠️ Failed to cache transcript:', saveErr.message);
      }

      return transcriptData;

    } catch (error) {
      console.error('AssemblyAI transcript error:', error.message);
      throw new Error(`Failed to get transcript: ${error.message}`);
    }
  }

  /**
   * Get transcript with fallback to YouTube API
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Transcript data
   */
  async getTranscriptWithFallback(videoId) {
    try {
      // Try AssemblyAI first
      return await this.getTranscript(videoId);
    } catch (error) {
      console.error('AssemblyAI failed, trying YouTube fallback:', error.message);
      
      // Fallback to YouTube transcript API
      const transcriptData = await this.getYouTubeTranscriptFallback(videoId);

      // Validate transcript before caching (only cache valid transcripts)
      if (transcriptData && transcriptData.transcript && 
          transcriptData.transcript.trim().length >= 50 && 
          transcriptData.wordCount >= 10) {
        // Save/update cache from fallback (only if valid)
        try {
          const savedTranscript = await Transcript.findOneAndUpdate(
            { videoId },
            {
              videoId,
              transcript: transcriptData.transcript,
              language: transcriptData.language,
              wordCount: transcriptData.wordCount,
              duration: transcriptData.duration,
              source: transcriptData.source || 'youtube_fallback',
              'metadata.lastUsedAt': new Date()
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          console.log('🗄️ Transcript (fallback) cached in database:', {
            videoId: savedTranscript.videoId,
            transcriptLength: savedTranscript.transcript.length,
            wordCount: savedTranscript.wordCount,
            language: savedTranscript.language,
            source: savedTranscript.source
          });
        } catch (saveErr) {
          console.warn('⚠️ Failed to cache fallback transcript:', saveErr.message);
        }
      } else {
        console.warn('⚠️ Skipping cache for invalid fallback transcript');
      }

      return transcriptData;
    }
  }

  /**
   * Get YouTube transcript as fallback (no audio extraction needed)
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Transcript data
   */
  async getYouTubeTranscriptFallback(videoId) {
    try {
      console.log('Using YouTube transcript API as fallback...');
      const { YoutubeTranscript } = require('youtube-transcript');
      
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      
      if (!transcript || transcript.length === 0) {
        throw new Error('YouTube transcript API returned empty transcript array. This video may not have captions available.');
      }
      
      const fullTranscript = transcript
        .map(segment => segment.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Detect language from transcript
      const detectedLanguage = this.detectLanguage(fullTranscript);

      const wordCount = fullTranscript.split(' ').length;
      
      console.log('YouTube transcript fallback successful:', {
        wordCount: wordCount,
        language: detectedLanguage,
        transcriptLength: fullTranscript.length
      });

      // Validate transcript has meaningful content
      if (!fullTranscript || fullTranscript.length < 50 || wordCount < 10) {
        console.error('❌ YouTube transcript too short or empty:', {
          transcriptLength: fullTranscript.length,
          wordCount: wordCount,
          preview: fullTranscript.substring(0, 50)
        });
        throw new Error(`YouTube transcript is too short (${wordCount} words, ${fullTranscript.length} chars). This video may not have captions available.`);
      }

      return {
        transcript: fullTranscript,
        language: detectedLanguage,
        wordCount: wordCount,
        duration: fullTranscript.length,
        hasTranscript: true,
        summary: '',
        source: 'youtube_fallback'
      };
    } catch (fallbackError) {
      console.error('YouTube fallback also failed:', fallbackError.message);
      throw new Error('Both AssemblyAI and YouTube transcript failed');
    }
  }

  /**
   * Verify transcript storage and integrity
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Verification result
   */
  async verifyTranscriptStorage(videoId) {
    try {
      const transcript = await Transcript.findOne({ videoId });
      
      if (!transcript) {
        return {
          exists: false,
          message: 'Transcript not found in database'
        };
      }

      const verification = {
        exists: true,
        videoId: transcript.videoId,
        transcriptLength: transcript.transcript.length,
        wordCount: transcript.wordCount,
        language: transcript.language,
        source: transcript.source,
        createdAt: transcript.createdAt,
        lastUsed: transcript.metadata.lastUsedAt,
        isValid: transcript.transcript.length > 50 && transcript.wordCount > 10,
        issues: []
      };

      // Check for potential issues
      if (transcript.transcript.length < 50) {
        verification.issues.push('Transcript too short');
      }
      if (transcript.wordCount < 10) {
        verification.issues.push('Word count too low');
      }
      if (!transcript.language) {
        verification.issues.push('Language not detected');
      }

      return verification;
    } catch (error) {
      console.error('Error verifying transcript storage:', error);
      return {
        exists: false,
        error: error.message
      };
    }
  }

  /**
   * Get audio duration in seconds
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<number>} Duration in seconds
   */
  async getAudioDuration(audioPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          console.error('Error getting audio duration:', err);
          reject(err);
          return;
        }
        const duration = metadata.format.duration || 0;
        resolve(Math.floor(duration));
      });
    });
  }

  /**
   * Split audio file into chunks (10-15 minutes each)
   * @param {string} audioPath - Path to source audio file
   * @param {number} chunkDurationMinutes - Duration of each chunk in minutes (default: 12)
   * @returns {Promise<Array>} Array of chunk info: [{ index, path, startTime, endTime }]
   */
  async chunkAudio(audioPath, chunkDurationMinutes = 12) {
    try {
      console.log(`🎵 Starting audio chunking: ${audioPath}`);
      
      // Get audio duration
      const totalDuration = await this.getAudioDuration(audioPath);
      const chunkDurationSeconds = chunkDurationMinutes * 60;
      const chunksDir = path.join(path.dirname(audioPath), 'chunks');
      
      // Create chunks directory
      if (!fs.existsSync(chunksDir)) {
        fs.mkdirSync(chunksDir, { recursive: true });
      }

      // Calculate number of chunks needed
      const numChunks = Math.ceil(totalDuration / chunkDurationSeconds);
      console.log(`📊 Total duration: ${totalDuration}s, splitting into ${numChunks} chunks of ~${chunkDurationMinutes} minutes each`);

      const chunks = [];
      const baseName = path.basename(audioPath, path.extname(audioPath));

      // Generate chunks using ffmpeg
      for (let i = 0; i < numChunks; i++) {
        const startTime = i * chunkDurationSeconds;
        const endTime = Math.min((i + 1) * chunkDurationSeconds, totalDuration);
        const chunkPath = path.join(chunksDir, `${baseName}_chunk_${i}.mp3`);

        await new Promise((resolve, reject) => {
          ffmpeg(audioPath)
            .setStartTime(startTime)
            .setDuration(endTime - startTime)
            .audioBitrate(64) // Low bitrate for smaller files
            .audioCodec('libmp3lame')
            .on('start', (commandLine) => {
              console.log(`🎬 Creating chunk ${i + 1}/${numChunks}: ${commandLine}`);
            })
            .on('end', () => {
              console.log(`✅ Chunk ${i + 1}/${numChunks} created: ${chunkPath}`);
              resolve();
            })
            .on('error', (err) => {
              console.error(`❌ Error creating chunk ${i + 1}:`, err.message);
              reject(err);
            })
            .save(chunkPath);
        });

        chunks.push({
          chunkIndex: i,
          path: chunkPath,
          startTime: startTime,
          endTime: endTime,
          duration: endTime - startTime
        });
      }

      console.log(`✅ Audio chunking completed: ${chunks.length} chunks created`);
      return chunks;
    } catch (error) {
      console.error('❌ Error chunking audio:', error);
      throw new Error(`Failed to chunk audio: ${error.message}`);
    }
  }

  /**
   * Upload a single audio chunk to AssemblyAI
   * @param {string} chunkPath - Path to chunk audio file
   * @returns {Promise<string>} Upload URL
   */
  async uploadChunk(chunkPath) {
    try {
      console.log(`📤 Uploading chunk: ${chunkPath}`);
      
      const audioBuffer = fs.readFileSync(chunkPath);
      
      const response = await axios.post(`${this.baseUrl}/upload`, audioBuffer, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/octet-stream'
        },
        timeout: 300000 // 5 minutes timeout for large chunks
      });

      console.log(`✅ Chunk uploaded successfully: ${path.basename(chunkPath)}`);
      return response.data.upload_url;
    } catch (error) {
      console.error(`❌ Error uploading chunk ${chunkPath}:`, error.response?.data || error.message);
      throw new Error(`Failed to upload chunk: ${error.message}`);
    }
  }

  /**
   * Create transcription request for a chunk
   * @param {string} audioUrl - Uploaded chunk audio URL
   * @param {Object} options - Additional options (chunkIndex, startTime, etc.)
   * @returns {Promise<string>} Transcript ID for this chunk
   */
  async createChunkTranscript(audioUrl, options = {}) {
    try {
      console.log(`🎙️ Creating transcription request for chunk ${options.chunkIndex || 'unknown'}...`);
      
      const response = await axios.post(`${this.baseUrl}/transcript`, {
        audio_url: audioUrl,
        language_detection: true,
        // Disable expensive features for chunks to save time/cost
        summarization: false,
        auto_highlights: false,
        sentiment_analysis: false
      }, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ Transcription request created for chunk ${options.chunkIndex || 'unknown'}: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      console.error(`❌ Error creating chunk transcription:`, error.response?.data || error.message);
      throw new Error(`Failed to create chunk transcription request: ${error.message}`);
    }
  }

  /**
   * Poll for chunk transcription completion
   * @param {string} transcriptId - Transcript ID for the chunk
   * @param {number} maxWaitTime - Maximum wait time in milliseconds (default: 10 minutes)
   * @returns {Promise<Object>} Completed transcript data for the chunk
   */
  async pollChunkTranscript(transcriptId, maxWaitTime = 600000) {
    const pollInterval = 10000; // Poll every 10 seconds
    const startTime = Date.now();
    let attempts = 0;

    while (Date.now() - startTime < maxWaitTime) {
      try {
        attempts++;
        console.log(`🔍 Polling chunk transcript ${transcriptId} (attempt ${attempts})...`);
        
        const response = await axios.get(`${this.baseUrl}/transcript/${transcriptId}`, {
          headers: {
            'Authorization': this.apiKey
          }
        });

        const data = response.data;
        console.log(`📊 Chunk transcript ${transcriptId} status: ${data.status}`);

        if (data.status === 'completed') {
          console.log(`✅ Chunk transcription completed: ${transcriptId}`);
          return {
            transcriptId: transcriptId,
            text: data.text || '',
            language: data.language_code || 'en',
            confidence: data.confidence || 0,
            words: data.words || [],
            completed: true
          };
        } else if (data.status === 'error') {
          throw new Error(`Chunk transcription failed: ${data.error}`);
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));

      } catch (error) {
        if (error.response?.status === 404) {
          throw new Error(`Chunk transcript ${transcriptId} not found`);
        }
        console.error(`❌ Error polling chunk transcript:`, error.response?.data || error.message);
        // Continue polling on transient errors
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error(`Chunk transcription timeout after ${maxWaitTime}ms for transcript ${transcriptId}`);
  }

  /**
   * Clean up chunk files
   * @param {Array} chunks - Array of chunk objects with path property
   */
  async cleanupChunks(chunks) {
    try {
      console.log(`🧹 Cleaning up ${chunks.length} chunk files...`);
      for (const chunk of chunks) {
        try {
          if (fs.existsSync(chunk.path)) {
            fs.unlinkSync(chunk.path);
            console.log(`✅ Deleted chunk file: ${chunk.path}`);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to delete chunk ${chunk.path}:`, error.message);
        }
      }
      // Try to remove chunks directory if empty
      const chunksDir = path.dirname(chunks[0]?.path);
      if (chunksDir && fs.existsSync(chunksDir)) {
        try {
          const files = fs.readdirSync(chunksDir);
          if (files.length === 0) {
            fs.rmdirSync(chunksDir);
            console.log(`✅ Removed empty chunks directory: ${chunksDir}`);
          }
        } catch (error) {
          // Directory not empty or already removed, ignore
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error during chunk cleanup:`, error.message);
    }
  }

  /**
   * Detect language from transcript text
   * @param {string} text - Transcript text
   * @returns {string} Detected language code
   */
  detectLanguage(text) {
    const languagePatterns = {
      'en': /[a-zA-Z]/g,
      'hi': /[\u0900-\u097F]/g,
      'zh': /[\u4E00-\u9FFF]/g,
      'ja': /[\u3040-\u309F\u30A0-\u30FF]/g,
      'ko': /[\uAC00-\uD7AF]/g,
      'ar': /[\u0600-\u06FF]/g,
      'es': /[ñáéíóúü]/gi,
      'fr': /[àâäéèêëïîôöùûüÿç]/gi,
      'de': /[äöüß]/gi,
      'ru': /[\u0400-\u04FF]/g,
      'pt': /[ãõç]/gi,
      'it': /[àèéìíîòóù]/gi,
    };

    const scores = {};
    
    for (const [lang, pattern] of Object.entries(languagePatterns)) {
      const matches = text.match(pattern);
      scores[lang] = matches ? matches.length : 0;
    }

    const detectedLang = Object.entries(scores).reduce((a, b) => 
      scores[a[0]] > scores[b[0]] ? a : b
    )[0];

    return scores[detectedLang] > 0 ? detectedLang : 'en';
  }
}

module.exports = new AssemblyAIService();
