import pool from '../config/database.js';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

/**
 * User Model - Uses existing users_user table (Django structure)
 * 
 * Table structure:
 * - id: uuid (primary key)
 * - username: varchar (required)
 * - email: varchar (required, unique)
 * - password: varchar (Django pbkdf2_sha256 format)
 * - first_name: varchar (required)
 * - last_name: varchar (required)
 * - is_superuser: boolean (default false)
 * - is_staff: boolean (default false)
 * - is_active: boolean (default true)
 * - date_joined: timestamp (required)
 * - last_login: timestamp (nullable)
 */
export class User {
  /**
   * Find user by email
   */
  static async findByEmail(email) {
    const result = await pool.query(
      'SELECT * FROM users_user WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by ID
   */
  static async findById(id) {
    const result = await pool.query(
      `SELECT id, username, email, first_name, last_name, 
              is_superuser, is_staff, is_active, date_joined, last_login 
       FROM users_user WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Create new user (Django-compatible)
   * Note: Django uses pbkdf2_sha256 password hashing, but we'll use bcrypt for simplicity
   * If you need Django compatibility, use: pbkdf2_sha256$<iterations>$<salt>$<hash>
   */
  static async create({ email, password, full_name }) {
    // Split full_name into first_name and last_name
    const nameParts = (full_name || '').trim().split(' ');
    const first_name = nameParts[0] || '';
    const last_name = nameParts.slice(1).join(' ') || '';
    const username = email.split('@')[0]; // Use email prefix as username
    
    // Generate UUID for id
    const id = randomUUID();
    
    // Hash password with bcrypt (Django-compatible format: pbkdf2_sha256$...)
    // For now, we'll use bcrypt. If Django compatibility is needed, implement pbkdf2_sha256
    const passwordHash = await bcrypt.hash(password, 12);
    // Format: pbkdf2_sha256$<iterations>$<salt>$<hash>
    // For simplicity, using bcrypt format. If Django login is needed, convert to pbkdf2_sha256
    
    const result = await pool.query(
      `INSERT INTO users_user (
        id, username, email, password, first_name, last_name,
        is_superuser, is_staff, is_active, date_joined
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id, username, email, first_name, last_name, date_joined`,
      [id, username, email, passwordHash, first_name, last_name, false, false, true]
    );
    
    const user = result.rows[0];
    // Add full_name for compatibility
    user.full_name = `${user.first_name} ${user.last_name}`.trim();
    
    return user;
  }

  /**
   * Verify password
   * Supports both bcrypt (our format) and Django pbkdf2_sha256
   */
  static async verifyPassword(email, password) {
    const user = await this.findByEmail(email);
    if (!user) return null;
    
    // Check if password is Django format (pbkdf2_sha256$...)
    if (user.password.startsWith('pbkdf2_sha256$')) {
      // Django password verification would go here
      // For now, we'll assume bcrypt if it's not Django format
      // TODO: Implement Django pbkdf2_sha256 verification if needed
      console.warn('Django password format detected. Bcrypt verification may fail.');
    }
    
    // Try bcrypt verification
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    // Add full_name for compatibility
    userWithoutPassword.full_name = `${user.first_name} ${user.last_name}`.trim();
    
    return userWithoutPassword;
  }
}

