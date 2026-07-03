import User from '../models/User.js';
import Work from '../models/Work.js';
import Board from '../models/Board.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

// GET /api/users/:username  (public profile)
export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findOne({ username: req.params.username.toLowerCase() });
  if (!user) throw ApiError.notFound('User not found');

  const [workCount, boardCount] = await Promise.all([
    Work.countDocuments({ owner: user._id, isPublic: true }),
    Board.countDocuments({ owner: user._id, isPublic: true }),
  ]);

  res.json({
    success: true,
    profile: {
      ...user.toJSON(),
      stats: { works: workCount, boards: boardCount, followers: user.followers.length, following: user.following.length },
    },
  });
});

// PUT /api/users/me  (update own profile)
export const updateMe = asyncHandler(async (req, res) => {
  const { name, bio, avatar, preferences } = req.body;
  const user = req.user;
  if (name !== undefined) user.name = name;
  if (bio !== undefined) user.bio = bio;
  if (avatar !== undefined) user.avatar = avatar;
  if (preferences !== undefined) {
    user.preferences = Array.isArray(preferences)
      ? preferences.map((p) => String(p).toLowerCase().trim())
      : user.preferences;
  }
  await user.save();
  res.json({ success: true, user });
});

// GET /api/users/me/dashboard  (manage uploaded content + saved works)
export const getDashboard = asyncHandler(async (req, res) => {
  const uid = req.user._id;
  const [works, boards, saved, totals] = await Promise.all([
    Work.find({ owner: uid }).sort({ createdAt: -1 }),
    Board.find({ $or: [{ owner: uid }, { collaborators: uid }] }).sort({ updatedAt: -1 }),
    Work.find({ savedBy: uid }).populate('owner', 'name username avatar'),
    Work.aggregate([
      { $match: { owner: uid } },
      {
        $group: {
          _id: null,
          views: { $sum: '$viewCount' },
          likes: { $sum: '$likeCount' },
          saves: { $sum: '$saveCount' },
          comments: { $sum: '$commentCount' },
          works: { $sum: 1 },
        },
      },
    ]),
  ]);

  res.json({
    success: true,
    dashboard: {
      totals: totals[0] || { views: 0, likes: 0, saves: 0, comments: 0, works: 0 },
      works,
      boards,
      saved,
    },
  });
});

// POST /api/users/:id/follow  (toggle)
export const toggleFollow = asyncHandler(async (req, res) => {
  if (req.params.id === req.user._id.toString()) throw ApiError.badRequest('You cannot follow yourself');
  const target = await User.findById(req.params.id);
  if (!target) throw ApiError.notFound('User not found');

  const me = req.user;
  const following = me.following.some((id) => id.toString() === target._id.toString());
  if (following) {
    me.following = me.following.filter((id) => id.toString() !== target._id.toString());
    target.followers = target.followers.filter((id) => id.toString() !== me._id.toString());
  } else {
    me.following.push(target._id);
    target.followers.push(me._id);
  }
  await Promise.all([me.save(), target.save()]);
  res.json({ success: true, following: !following, followerCount: target.followers.length });
});
