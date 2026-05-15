import { Router } from 'express';
import { hashPassword, comparePassword, createJwtToken, createSession } from '../auth';
import { query } from '../db';

const router = Router();

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const tenantName = req.body.organization_name || 'My Team';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await query(
      'SELECT id FROM users WHERE lower(email) = lower($1)',
      [normalizedEmail]
    );

    const existingCount = existingUser?.rowCount ?? 0;
    if (existingCount > 0) {
      return res.status(409).json({ error: 'A user with that email already exists' });
    }

    const tenantResult = await query(
      'INSERT INTO tenants (name) VALUES ($1) RETURNING id, name',
      [tenantName]
    );

    const tenant = tenantResult.rows[0];
    const passwordHash = await hashPassword(password);
    const userResult = await query(
      'INSERT INTO users (tenant_id, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, role',
      [tenant.id, normalizedEmail, passwordHash, 'admin']
    );

    const user = userResult.rows[0];
    const token = createJwtToken({
      sub: user.id,
      tenant_id: tenant.id,
      email: user.email,
      role: user.role,
    });

    await createSession(user.id, token);

    return res.status(201).json({
      token,
      user,
      tenant,
      expiresIn: 7 * 24 * 60 * 60,
    });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A user with that email already exists for this tenant' });
    }
    console.error('Registration error:', error);
    const debug = process.env.NODE_ENV !== 'production';
    return res.status(500).json({
      error: debug ? error.message || 'Unable to register user' : 'Unable to register user',
      ...(debug ? { code: error.code, detail: error.detail } : {}),
    });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const userResult = await query(
      'SELECT u.id, u.email, u.password_hash, u.role, u.tenant_id, t.name as tenant_name FROM users u INNER JOIN tenants t ON u.tenant_id = t.id WHERE lower(u.email) = lower($1) AND u.is_active = true',
      [email]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const passwordMatches = await comparePassword(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createJwtToken({
      sub: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
      role: user.role,
    });

    await createSession(user.id, token);

    return res.status(200).json({
      token,
      user: { id: user.id, email: user.email, role: user.role },
      tenant: { id: user.tenant_id, name: user.tenant_name },
      expiresIn: 7 * 24 * 60 * 60,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to login' });
  }
});

export default router;
