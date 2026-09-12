import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  getResearchStatus,
  searchGoogleCtrl,
  searchYoutubeCtrl,
  synthesizeResearchCtrl,
} from '../controllers/research.controller';

const router = Router();

// All routes require ERP auth
router.use(authMiddleware);

// GET  /api/research/status       → { google, youtube, ollama }
router.get('/status', getResearchStatus);

// POST /api/research/google       → { results[], query }
router.post('/google', searchGoogleCtrl);

// POST /api/research/youtube      → { results[], query }
router.post('/youtube', searchYoutubeCtrl);

// POST /api/research/synthesize   → { googleResults, youtubeResults, synthesis, query, timestamp, configStatus }
router.post('/synthesize', synthesizeResearchCtrl);

export default router;
