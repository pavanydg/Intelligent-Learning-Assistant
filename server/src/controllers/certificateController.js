const { asyncHandler } = require('../middlewares/errorHandler');
const certificateService = require('../services/certificateService');
const path = require('path');
const fs = require('fs');

const issueCertificate = asyncHandler(async (req, res) => {
  console.log('🎓 Certificate issuance request:', {
    userId: req.user?._id,
    playlistId: req.params.playlistId,
    hasUser: !!req.user
  });

  const user = req.user;
  const { playlistId } = req.params;

  if (!user) {
    return res.status(401).json({ success: false, message: 'User not authenticated' });
  }

  const result = await certificateService.issueCertificate(user, playlistId);
  if (!result.success) {
    return res.status(400).json({ success: false, message: result.reason || 'Not eligible' });
  }

  res.json({ success: true, data: { certificate: result.certificate } });
});

const listCertificates = asyncHandler(async (req, res) => {
  const certs = await certificateService.listUserCertificates(req.user._id);
  res.json({ success: true, data: { certificates: certs } });
});

const downloadCertificate = asyncHandler(async (req, res) => {
  // Normalize id: sometimes clients accidentally pass an object string like "[object Object]"
  const rawId = req.params.id || '';
  const hexMatch = rawId.match(/[a-fA-F0-9]{24}/);
  const id = hexMatch ? hexMatch[0] : rawId;

  const cert = await certificateService.getCertificateById(id, req.user._id);
  if (!cert) return res.status(404).json({ success: false, message: 'Certificate not found' });

  const filePath = cert.certificatePath;
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Certificate file missing' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${cert.playlistTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_certificate.pdf"`);
  fs.createReadStream(filePath).pipe(res);
});

module.exports = {
  issueCertificate,
  listCertificates,
  downloadCertificate
};


