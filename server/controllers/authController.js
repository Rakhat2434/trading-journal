const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getJwtSecret = () => String(process.env.JWT_SECRET || '').trim();

const generateToken = (userId) => {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error('JWT secret is missing');
  }

  return jwt.sign({ id: userId }, secret, { expiresIn: '7d' });
};

const publicUser = (user) => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please fill in all fields' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'password too short' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedUsername = String(username).trim();

    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      return res.status(409).json({ success: false, message: 'email already exists' });
    }

    const existingUsername = await User.findOne({ username: normalizedUsername });
    if (existingUsername) {
      return res.status(409).json({ success: false, message: 'username already exists' });
    }

    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      password,
    });

    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      token,
      user: publicUser(user),
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((item) => item.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }

    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.email) {
        return res.status(409).json({ success: false, message: 'email already exists' });
      }
      if (error.keyPattern && error.keyPattern.username) {
        return res.status(409).json({ success: false, message: 'username already exists' });
      }
    }

    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please fill in all fields' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'invalid credentials' });
    }

    const token = generateToken(user._id);

    return res.json({
      success: true,
      token,
      user: publicUser(user),
    });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const me = async (req, res) => {
  return res.json({ success: true, user: publicUser(req.user) });
};

module.exports = {
  register,
  login,
  me,
};
