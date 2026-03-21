const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { issueCertificate, listCertificates, downloadCertificate } = require('../controllers/certificateController');

const router = express.Router();

router.use(authenticateToken);

// Issue certificate for a completed playlist
router.post('/issue/:playlistId', issueCertificate);

// List user's certificates
router.get('/my', listCertificates);

// Download certificate by id
router.get('/:id/download', downloadCertificate);

module.exports = router;




