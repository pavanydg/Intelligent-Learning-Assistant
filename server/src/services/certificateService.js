const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const puppeteer = require('puppeteer');
const Certificate = require('../models/Certificate');
const PlaylistProgress = require('../models/PlaylistProgress');
const youtubeService = require('./youtubeService');

class CertificateService {
  async checkEligibility(userId, playlistId) {
    // Check UserProgress (course progress) instead of PlaylistProgress
    const UserProgress = require('../models/UserProgress');
    const progress = await UserProgress.findOne({ userId, courseId: playlistId });
    
    if (!progress) return { eligible: false, reason: 'No progress found' };

    const totalVideos = progress.totalVideos || 0;
    const completedVideos = progress.completedVideos?.length || 0;

    if (totalVideos === 0) return { eligible: false, reason: 'No videos found in course progress' };
    if (completedVideos < totalVideos) return { eligible: false, reason: 'Course not fully completed' };

    const startedAt = progress.startedAt || progress.createdAt;
    const completedAt = progress.lastUpdated;
    const watchedDurationSeconds = progress.totalWatchTime || 0;

    // Fetch playlist title and total duration from saved course if available
    let playlistTitle = progress.courseTitle || playlistId;
    let totalDurationSeconds = 0;
    try {
      const course = await require('../models/Course').findOne({ playlistId });
      if (course) {
        playlistTitle = course.title || playlistTitle;
        totalDurationSeconds = (course.metadata?.totalDurationSeconds) || 0;
        if (!totalDurationSeconds && Array.isArray(course.videos)) {
          totalDurationSeconds = course.videos.reduce((acc, v) => acc + youtubeService.parseDuration(v.duration || 'PT0S'), 0);
        }
      }
    } catch {}

    return { eligible: true, totalVideos, completedVideos, startedAt, completedAt, watchedDurationSeconds, playlistTitle, totalDurationSeconds };
  }

  generateCertificateNumber(userId, playlistId) {
    const seed = `${userId}-${playlistId}-${Date.now()}`;
    return 'ILA-' + crypto.createHash('sha256').update(seed).digest('hex').slice(0, 12).toUpperCase();
  }

  generateVerificationHash(userId, playlistId, certificateNumber) {
    const seed = `${userId}:${playlistId}:${certificateNumber}`;
    return crypto.createHash('sha256').update(seed).digest('hex');
  }

  async generateCertificatePDF(data) {
    const certDir = path.join(__dirname, '../../temp/certificates');
    if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });

    const fileName = `${data.userId}_${data.playlistId}_${Date.now()}.pdf`;
    const filePath = path.join(certDir, fileName);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    try {
      const page = await browser.newPage();
      await page.setContent(this.buildCertificateHTML(data), { waitUntil: 'domcontentloaded' });
      await page.pdf({ path: filePath, format: 'A4', printBackground: true });
      return filePath;
    } finally {
      await browser.close();
    }
  }

  buildCertificateHTML(data) {
    const formatDuration = (sec) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      return `${h}h ${m}m ${s}s`;
    };

    const issueDate = new Date(data.issuedAt).toLocaleDateString();
    const startDate = data.startedAt ? new Date(data.startedAt).toLocaleDateString() : '-';
    const endDate = data.completedAt ? new Date(data.completedAt).toLocaleDateString() : '-';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Certificate of Completion</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1f2937; margin: 0; }
    .page { padding: 48px; position: relative; height: 1123px; box-sizing: border-box; }
    .border { position: absolute; inset: 24px; border: 8px double #1f2937; border-radius: 12px; }
    .header { text-align: center; margin-top: 80px; }
    .title { font-size: 36px; letter-spacing: 3px; color: #111827; font-weight: 800; }
    .subtitle { font-size: 14px; color: #6b7280; margin-top: 6px; }
    .recipient { margin-top: 60px; text-align: center; }
    .name { font-size: 28px; font-weight: 700; color: #0f766e; }
    .text { font-size: 16px; margin-top: 8px; }
    .course { margin-top: 24px; text-align: center; font-size: 18px; font-weight: 600; }
    .meta { margin: 36px auto 0; width: 80%; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 14px; }
    .meta div { background: #f8fafc; padding: 12px 16px; border-radius: 8px; }
    .footer { position: absolute; bottom: 80px; left: 0; right: 0; display: flex; justify-content: space-around; align-items: center; }
    .sign { text-align: center; }
    .line { height: 1px; width: 240px; background: #1f2937; margin-bottom: 8px; }
    .code { text-align: center; margin-top: 24px; font-size: 12px; color: #6b7280; }
  </style>
  </head>
  <body>
    <div class="page">
      <div class="border"></div>
      <div class="header">
        <div class="title">Certificate of Completion</div>
        <div class="subtitle">Intelligent Learning Assistant (ILA)</div>
      </div>
      <div class="recipient">
        <div class="text">This is to certify that</div>
        <div class="name">${data.userName}</div>
        <div class="text">has successfully completed the playlist</div>
      </div>
      <div class="course">${data.playlistTitle}</div>
      <div class="meta">
        <div><strong>Issued On:</strong> ${issueDate}</div>
        <div><strong>Certificate No:</strong> ${data.certificateNumber}</div>
        <div><strong>Started:</strong> ${startDate}</div>
        <div><strong>Completed:</strong> ${endDate}</div>
        <div><strong>Total Videos:</strong> ${data.totalVideos}</div>
        <div><strong>Completed Videos:</strong> ${data.completedVideos}</div>
        <div><strong>Total Duration:</strong> ${formatDuration(data.totalDurationSeconds)}</div>
        <div><strong>Watched Duration:</strong> ${formatDuration(data.watchedDurationSeconds)}</div>
      </div>
      <div class="footer">
        <div class="sign">
          <div class="line"></div>
          <div>Instructor</div>
        </div>
        <div class="sign">
          <div class="line"></div>
          <div>Authorized Signatory</div>
        </div>
      </div>
      <div class="code">Verification Hash: ${data.verificationHash.slice(0, 16)}... — Verify via ILA Dashboard</div>
    </div>
  </body>
</html>`;
  }

  async issueCertificate(user, playlistId) {
    const eligibility = await this.checkEligibility(user._id, playlistId);
    if (!eligibility.eligible) {
      return { success: false, reason: eligibility.reason };
    }

    const certificateNumber = this.generateCertificateNumber(user._id.toString(), playlistId);
    const verificationHash = this.generateVerificationHash(user._id.toString(), playlistId, certificateNumber);

    const data = {
      userId: user._id.toString(),
      userName: user.name || user.email || 'Learner',
      playlistId,
      playlistTitle: eligibility.playlistTitle,
      totalVideos: eligibility.totalVideos,
      completedVideos: eligibility.completedVideos,
      totalDurationSeconds: eligibility.totalDurationSeconds,
      watchedDurationSeconds: eligibility.watchedDurationSeconds,
      startedAt: eligibility.startedAt,
      completedAt: eligibility.completedAt,
      issuedAt: new Date(),
      certificateNumber,
      verificationHash
    };

    const certificatePath = await this.generateCertificatePDF(data);

    const cert = new Certificate({
      userId: user._id,
      playlistId,
      playlistTitle: data.playlistTitle,
      userName: data.userName,
      issuedAt: data.issuedAt,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
      totalVideos: data.totalVideos,
      completedVideos: data.completedVideos,
      totalDurationSeconds: data.totalDurationSeconds,
      watchedDurationSeconds: data.watchedDurationSeconds,
      certificatePath,
      certificateNumber,
      verificationHash,
      metadata: { theme: 'classic' }
    });
    await cert.save();

    // Mark course as completed in completed courses
    try {
      const completedCourseService = require('./completedCourseService');
      await completedCourseService.markCourseCompleted(user._id, playlistId, cert);
    } catch (error) {
      console.error('Error marking course as completed:', error);
      // Don't fail certificate generation if this fails
    }

    return { success: true, certificate: cert };
  }

  async listUserCertificates(userId) {
    return Certificate.find({ userId }).sort({ createdAt: -1 });
  }

  async getCertificateById(id, userId) {
    return Certificate.findOne({ _id: id, userId });
  }
}

module.exports = new CertificateService();


