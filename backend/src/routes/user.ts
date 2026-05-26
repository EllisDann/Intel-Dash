import { Router } from 'express';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { hashPassword } from '../auth';
import { query } from '../db';

const router = Router();
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/api/user/profile', authenticate, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const userResult = await query(
      'SELECT u.id, u.email, u.name, u.role, u.profile_image, u.created_at, u.updated_at, t.id as tenant_id, t.name as tenant_name FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.id = $1',
      [user?.sub]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentUser = userResult.rows[0];
    return res.json({
      id: currentUser.id,
      email: currentUser.email,
      name: currentUser.name,
      role: currentUser.role,
      profileImage: currentUser.profile_image,
      createdAt: currentUser.created_at,
      updatedAt: currentUser.updated_at,
      tenant: {
        id: currentUser.tenant_id,
        name: currentUser.tenant_name,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to load profile' });
  }
});

router.put('/api/user/profile', authenticate, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { email, name, tenant_name, profile_image } = req.body;

    if (email && !emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!user?.sub) {
      return res.status(401).json({ error: 'Invalid user session' });
    }

    // Only update tenant if tenant_name is provided
    if (tenant_name && user.tenant_id) {
      await query('UPDATE tenants SET name = $1, updated_at = NOW() WHERE id = $2', [
        tenant_name,
        user.tenant_id,
      ]);
    }

    let updateQuery = 'UPDATE users SET email = COALESCE($1, email)';
    const updateParams: Array<any> = [email ? email.toLowerCase() : null];

    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
      updateQuery += ', name = $2';
      updateParams.push(name);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'profile_image')) {
      const nextParamIndex = updateParams.length + 1;
      updateQuery += `, profile_image = $${nextParamIndex}`;
      updateParams.push(profile_image);
    }

    updateQuery += ', updated_at = NOW()';
    updateParams.push(user.sub);
    updateQuery += ` WHERE id = $${updateParams.length} RETURNING id, email, name, role, profile_image, updated_at`;

    const updated = await query(updateQuery, updateParams);

    const tenantResult = user.tenant_id
      ? await query('SELECT id, name FROM tenants WHERE id = $1', [user.tenant_id])
      : null;

    const updatedUser = updated.rows[0];
    return res.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        profileImage: updatedUser.profile_image,
        updatedAt: updatedUser.updated_at,
      },
      tenant: tenantResult?.rows[0] || null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to update profile' });
  }
});

router.get('/api/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const usersResult = await query(
      'SELECT id, email, role, created_at, updated_at, is_active FROM users WHERE tenant_id = $1 ORDER BY created_at DESC',
      [user?.tenant_id]
    );
    return res.json({ users: usersResult.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to list users' });
  }
});

router.post('/api/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const currentUser = (req as AuthenticatedRequest).user;
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!['admin', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const password = Math.random().toString(36).slice(-12) + 'A1!';
    const passwordHash = await hashPassword(password);
    const userResult = await query(
      'INSERT INTO users (tenant_id, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4, true) RETURNING id, email, role, created_at',
      [currentUser?.tenant_id, email.toLowerCase(), passwordHash, role]
    );

    return res.status(201).json({ user: userResult.rows[0], tempPassword: password });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A user with that email already exists in your organization' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Unable to create user' });
  }
});

router.put('/api/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const currentUser = (req as AuthenticatedRequest).user;
    const { role } = req.body;
    const { id } = req.params;

    if (!['admin', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const updated = await query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING id, email, role, updated_at',
      [role, id, currentUser?.tenant_id]
    );

    if (updated.rowCount === 0) {
      return res.status(404).json({ error: 'User not found or not in your organization' });
    }

    return res.json({ user: updated.rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to update user role' });
  }
});

export default router;
