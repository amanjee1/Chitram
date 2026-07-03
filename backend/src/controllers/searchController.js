import Work, { CATEGORIES } from '../models/Work.js';
import asyncHandler from '../utils/asyncHandler.js';
import { aiEnabled, generateEmbedding } from '../services/aiService.js';
import { findSimilarByVector } from '../services/vectorService.js';

// GET /api/search?q=&category=&type=&semantic=true&page=&limit=
// - Default: MongoDB text search + category/type filters.
// - semantic=true: AI similarity search over the query text embedding (thematic/visual match).
export const search = asyncHandler(async (req, res) => {
  const { q = '', category, type } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
  const semantic = req.query.semantic === 'true';

  // ----- AI semantic search -----
  if (semantic && q && aiEnabled()) {
    const vector = await generateEmbedding(q);
    if (vector) {
      let items = await findSimilarByVector(vector, { limit: limit * 2 });
      if (category && CATEGORIES.includes(category)) items = items.filter((w) => w.category === category);
      if (type) items = items.filter((w) => w.type === type);
      return res.json({ success: true, mode: 'semantic', q, items: items.slice(0, limit) });
    }
  }

  // ----- Keyword + filter search -----
  const filter = { isPublic: true };
  if (category && CATEGORIES.includes(category)) filter.category = category;
  if (type) filter.type = type;

  let query;
  if (q) {
    filter.$text = { $search: q };
    query = Work.find(filter, { score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' } });
  } else {
    query = Work.find(filter).sort({ createdAt: -1 });
  }

  const [items, total] = await Promise.all([
    query.skip((page - 1) * limit).limit(limit).populate('owner', 'name username avatar'),
    Work.countDocuments(filter),
  ]);

  res.json({
    success: true,
    mode: 'keyword',
    q,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    items,
  });
});

// GET /api/search/categories  -> available categories for filter UIs
export const getCategories = asyncHandler(async (req, res) => {
  res.json({ success: true, categories: CATEGORIES });
});
