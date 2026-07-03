import Work, { CATEGORIES } from '../models/Work.js';
import Comment from '../models/Comment.js';
import Activity from '../models/Activity.js';
import Board from '../models/Board.js';
import User from '../models/User.js';
import cloudinary from '../config/cloudinary.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  aiEnabled,
  buildEmbeddingText,
  generateEmbedding,
} from '../services/aiService.js';
import { moderateContent } from '../services/moderationService.js';
import { findSimilarByVector } from '../services/vectorService.js';

const logActivity = (type, workId, userId) =>
  Activity.create({ type, work: workId, user: userId || null }).catch(() => {});

// Generate and store a text embedding for the work to power similarity search and recommendations.
// Best-effort: failures never block the upload.
const enrichWorkWithAI = async (work) => {
  if (!aiEnabled()) return;
  const embedding = await generateEmbedding(buildEmbeddingText(work.toObject()));
  if (embedding) work.embedding = embedding;
  await work.save();
};

// POST /api/works  (multipart for images: field "image"; or JSON for writing)
export const createWork = asyncHandler(async (req, res) => {
  const { title, description, category, type, textContent } = req.body;
  if (!title) throw ApiError.badRequest('title is required');

  const workType = type || (req.file ? 'image' : 'writing');
  if (!['image', 'writing'].includes(workType)) throw ApiError.badRequest('type must be image or writing');

  if (workType === 'image' && !req.file) throw ApiError.badRequest('image file is required for image works');
  if (workType === 'writing' && !textContent) throw ApiError.badRequest('textContent is required for writing works');

  let tags = req.body.tags;
  if (typeof tags === 'string') tags = tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);

  // Content moderation — block policy violations before any DB write.
  const mod = moderateContent({ title, description, tags, textContent });
  if (mod.status === 'blocked') throw ApiError.badRequest(mod.reason);

  const work = await Work.create({
    title,
    description,
    type: workType,
    category: CATEGORIES.includes(category) ? category : 'other',
    textContent: workType === 'writing' ? textContent : '',
    tags: Array.isArray(tags) ? tags : [],
    license: req.body.license || 'free',
    owner: req.user._id,
    mediaUrl: req.file?.path || '',
    mediaPublicId: req.file?.filename || '',
    thumbnailUrl: req.file?.path || '',
    width: req.file?.width,
    height: req.file?.height,
  });

  // Enrich with AI in the background; respond immediately.
  enrichWorkWithAI(work).catch((e) => console.warn('[ai] enrich failed:', e.message));

  res.status(201).json({ success: true, work });
});

// GET /api/works  (public feed, paginated + filterable)
export const getWorks = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
  const sort = req.query.sort === 'popular' ? { likeCount: -1 } : { createdAt: -1 };

  const filter = { isPublic: true };
  if (req.query.category && CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.owner) filter.owner = req.query.owner;

  const [items, total] = await Promise.all([
    Work.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('owner', 'name username avatar'),
    Work.countDocuments(filter),
  ]);

  res.json({ success: true, page, limit, total, totalPages: Math.ceil(total / limit), items });
});

// GET /api/works/:id
export const getWork = asyncHandler(async (req, res) => {
  const work = await Work.findById(req.params.id).populate('owner', 'name username avatar bio');
  if (!work) throw ApiError.notFound('Work not found');

  // Count a view (not for the owner viewing their own work).
  if (!req.user || req.user._id.toString() !== work.owner._id.toString()) {
    work.viewCount += 1;
    await work.save();
    logActivity('view', work._id, req.user?._id);
  }

  res.json({ success: true, work });
});

// PUT /api/works/:id  (owner only — req.resource set by authorizeOwnership)
export const updateWork = asyncHandler(async (req, res) => {
  const work = req.resource;
  const { title, description, category, textContent, isPublic } = req.body;

  if (title !== undefined) work.title = title;
  if (description !== undefined) work.description = description;
  if (category !== undefined && CATEGORIES.includes(category)) work.category = category;
  if (textContent !== undefined && work.type === 'writing') work.textContent = textContent;
  if (isPublic !== undefined) work.isPublic = isPublic;
  if (req.body.license !== undefined) work.license = req.body.license;
  if (req.body.tags !== undefined) {
    let tags = req.body.tags;
    if (typeof tags === 'string') tags = tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    work.tags = Array.isArray(tags) ? tags : work.tags;
  }

  await work.save();
  // Refresh embedding to reflect edits.
  enrichWorkWithAI(work).catch(() => {});

  res.json({ success: true, work });
});

// DELETE /api/works/:id  (owner only)
export const deleteWork = asyncHandler(async (req, res) => {
  const work = req.resource;
  if (work.mediaPublicId) {
    await cloudinary.uploader.destroy(work.mediaPublicId).catch(() => {});
  }
  await Promise.all([
    Comment.deleteMany({ work: work._id }),
    Activity.deleteMany({ work: work._id }),
    Board.updateMany({ works: work._id }, { $pull: { works: work._id } }),
  ]);
  await work.deleteOne();
  res.json({ success: true, message: 'Work deleted' });
});

// POST /api/works/:id/like  (toggle)
export const toggleLike = asyncHandler(async (req, res) => {
  const work = await Work.findById(req.params.id);
  if (!work) throw ApiError.notFound('Work not found');

  const uid = req.user._id.toString();
  const liked = work.likes.some((id) => id.toString() === uid);
  if (liked) {
    work.likes = work.likes.filter((id) => id.toString() !== uid);
  } else {
    work.likes.push(req.user._id);
  }
  await work.save();
  logActivity(liked ? 'unlike' : 'like', work._id, req.user._id);

  res.json({ success: true, liked: !liked, likeCount: work.likeCount });
});

// POST /api/works/:id/save  (toggle bookmark)
export const toggleSave = asyncHandler(async (req, res) => {
  const work = await Work.findById(req.params.id);
  if (!work) throw ApiError.notFound('Work not found');

  const uid = req.user._id.toString();
  const saved = work.savedBy.some((id) => id.toString() === uid);
  if (saved) {
    work.savedBy = work.savedBy.filter((id) => id.toString() !== uid);
  } else {
    work.savedBy.push(req.user._id);
  }
  await work.save();
  logActivity(saved ? 'unsave' : 'save', work._id, req.user._id);

  res.json({ success: true, saved: !saved, saveCount: work.saveCount });
});

// GET /api/works/:id/similar  (AI similarity search)
export const getSimilarWorks = asyncHandler(async (req, res) => {
  const work = await Work.findById(req.params.id).select('+embedding');
  if (!work) throw ApiError.notFound('Work not found');

  if (!work.embedding || !work.embedding.length) {
    return res.json({
      success: true,
      items: [],
      note: 'No embedding for this work yet (AI disabled or enrichment pending).',
    });
  }

  const items = await findSimilarByVector(work.embedding, {
    limit: Math.min(24, parseInt(req.query.limit, 10) || 12),
    excludeIds: [work._id],
  });
  res.json({ success: true, items });
});

// GET /api/works/following  (works by artists the logged-in user follows)
export const getFollowingWorks = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('following');
  const following = user?.following || [];

  if (!following.length) {
    return res.json({ success: true, items: [], total: 0, totalPages: 0, page: 1 });
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(24, parseInt(req.query.limit, 10) || 24);
  const filter = { isPublic: true, owner: { $in: following } };

  const [items, total] = await Promise.all([
    Work.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('owner', 'name username avatar'),
    Work.countDocuments(filter),
  ]);

  res.json({ success: true, page, limit, total, totalPages: Math.ceil(total / limit), items });
});
