import express from 'express';
import { generateShortId, redirectToShortURL, getShortURLAnalytics } from '../controller/url.controller.js';
import { restrictToLogginUserOnly } from '../middleware/auth.middleware.js';
import { urlCreateRateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = express.Router();

router.route('/').get((req, res) => { return res.status(200).json({ msg: "Hello from server" }) }).post(urlCreateRateLimiter, generateShortId);
router.route('/analytics/:shortId').get(restrictToLogginUserOnly, getShortURLAnalytics);
router.route('/:shortId').get(redirectToShortURL);


export default router;
