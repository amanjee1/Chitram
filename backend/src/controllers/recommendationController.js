import Work from '../models/Work.js';
import Activity from '../models/Activity.js';
import asyncHandler from '../utils/asyncHandler.js';
import { aiEnabled, averageVectors } from '../services/aiService.js';
import { findSimilarByVector } from '../services/vectorService.js';

// GET /api/recommendations  (personalized feed)
// Strategy:
//  1. Build a "taste vector" by averaging embeddings of works the user liked/saved/viewed
//     (plus stated category preferences as a fallback signal).
//  2. Vector-search for similar works the user hasn't already engaged with.
//  3. If AI is unavailable or the user has no history, fall back to a popularity feed
//     filtered by the user's preferred categories.
export const getRecommendations = asyncHandler(async (req, res) => {
  const limit = Math.min(40, parseInt(req.query.limit, 10) || 20);
  const user = req.user;

  // Works the user has engaged with (to seed taste + exclude from results).
  const engagement = await Activity.find({
    user: user._id,
    type: { $in: ['like', 'save', 'view'] },
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .select('work')
    .lean();

  const engagedIds = [...new Set(engagement.map((a) => a.work?.toString()).filter(Boolean))];

  if (aiEnabled() && engagedIds.length) {
    const seedWorks = await Work.find({ _id: { $in: engagedIds }, embedding: { $exists: true } })
      .select('+embedding')
      .limit(30)
      .lean();

    const taste = averageVectors(seedWorks.map((w) => w.embedding));
    if (taste) {
      const items = await findSimilarByVector(taste, {
        limit,
        excludeIds: engagedIds,
      });
      if (items.length) {
        return res.json({ success: true, strategy: 'ai-personalized', items });
      }
    }
  }

  // ----- Fallback: popularity within preferred categories -----
  const filter = { isPublic: true, _id: { $nin: engagedIds }, owner: { $ne: user._id } };
  if (user.preferences && user.preferences.length) {
    filter.category = { $in: user.preferences };
  }
  let items = await Work.find(filter)
    .sort({ likeCount: -1, viewCount: -1, createdAt: -1 })
    .limit(limit)
    .populate('owner', 'name username avatar');

  // If preferences yielded nothing, broaden to global trending.
  if (!items.length) {
    items = await Work.find({ isPublic: true, owner: { $ne: user._id } })
      .sort({ likeCount: -1, viewCount: -1 })
      .limit(limit)
      .populate('owner', 'name username avatar');
  }

  res.json({ success: true, strategy: 'trending-fallback', items });
});
