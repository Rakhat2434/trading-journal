const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getJwtSecret = () => String(process.env.JWT_SECRET || '').trim();

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'unauthorized' });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ success: false, message: 'unauthorized' });
    }

    const secret = getJwtSecret();
    if (!secret) {
      return res.status(500).json({ success: false, message: 'Server misconfiguration' });
    }

    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ success: false, message: 'unauthorized' });
    }

    req.user = user;
    req.userId = String(user._id);
    next();
  } catch (_error) {
    return res.status(401).json({ success: false, message: 'unauthorized' });
  }
};

module.exports = authMiddleware;
