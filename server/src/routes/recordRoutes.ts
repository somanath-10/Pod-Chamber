import express from 'express';
import { startRecording, uploadPart, completeRecording, listVideos, getVideoUrl } from '../controller/record.js';
import { handleEmailRecording } from '../utils/email.js';

const router = express.Router();

// 1. Start multipart upload
router.post('/start', startRecording);

// 2. Upload part
router.post('/upload', express.raw({ type: '*/*', limit: '100mb' }), uploadPart);

// 3. Complete upload
router.post('/complete', completeRecording);

// 4. List videos
router.get('/list', listVideos);

// 5. Get video pre-signed URL
router.get('/url', getVideoUrl);

// 6. Send email with video link
router.post('/email', handleEmailRecording);

export default router;
