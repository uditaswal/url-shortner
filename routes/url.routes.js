import express from 'express';
import { generateShortId, redirectToShortURL, getShortURLAnalytics } from '../controller/url.controller.js';

const router = express.Router();

router.route('/').get((req, res) => { return res.status(200).json({ msg: "Hello from server" }) }).post(generateShortId);

router.route('/:shortId').get(redirectToShortURL);
router.route('/analytics/:shortId').get(getShortURLAnalytics);


export default router;