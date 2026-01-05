import { verifyToken } from '../config/jwt.js';

/**
 * JWT Authentication Middleware
 * Verifies JWT token from Authorization header
 */
export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        data: { error: 'No token provided. Authentication required.' }
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        data: { error: 'Invalid or expired token.' }
      });
    }

    // Attach user info to request
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      data: { error: 'Authentication failed.' }
    });
  }
};

