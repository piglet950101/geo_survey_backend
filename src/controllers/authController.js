import { User } from '../models/User.js';
import { generateToken } from '../config/jwt.js';
import { body, validationResult } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * User Registration
 */
export const register = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      data: { error: errors.array()[0].msg }
    });
  }

  const { email, password, full_name } = req.body;

  // Check if user already exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    return res.status(400).json({
      data: { error: 'User with this email already exists' }
    });
  }

  // Create user
  const user = await User.create({ email, password, full_name });

  // Generate token
  const token = generateToken({ id: user.id, email: user.email });

  res.status(201).json({
    data: {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name
      },
      token
    }
  });
});

/**
 * User Login
 */
export const login = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      data: { error: errors.array()[0].msg }
    });
  }

  const { email, password } = req.body;

  // Verify credentials
  const user = await User.verifyPassword(email, password);
  if (!user) {
    return res.status(401).json({
      data: { error: 'Invalid email or password' }
    });
  }

  // Generate token
  const token = generateToken({ id: user.id, email: user.email });

  res.json({
    data: {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name
      },
      token
    }
  });
});

/**
 * Get Current User
 */
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  
  if (!user) {
    return res.status(404).json({
      data: { error: 'User not found' }
    });
  }

  res.json({
    data: {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name
      }
    }
  });
});

/**
 * Check Authentication Status
 */
export const checkAuth = asyncHandler(async (req, res) => {
  res.json({
    data: {
      success: true,
      authenticated: true,
      user: {
        id: req.user.id,
        email: req.user.email
      }
    }
  });
});

/**
 * Logout (client-side token removal, but we can log it)
 */
export const logout = asyncHandler(async (req, res) => {
  res.json({
    data: {
      success: true,
      message: 'Logged out successfully'
    }
  });
});

// Validation rules
export const registerValidation = [
  body('email').isEmail().withMessage('Invalid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('full_name').optional().isString().withMessage('Full name must be a string')
];

export const loginValidation = [
  body('email').isEmail().withMessage('Invalid email address'),
  body('password').notEmpty().withMessage('Password is required')
];

