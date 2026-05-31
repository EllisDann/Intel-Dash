import jwt from 'jsonwebtoken';
import { query } from '../src/db';

(async () => {
  try {
    const rows = await query('SELECT id, email, tenant_id FROM users ORDER BY created_at LIMIT 1');
    if (rows.rowCount === 0) {
      console.error('No users found');
      process.exit(1);
    }
    const user = rows.rows[0];
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET not set');
      process.exit(1);
    }
    const token = jwt.sign({ sub: user.id, tenant_id: user.tenant_id, email: user.email }, secret, { expiresIn: '1h' });
    console.log('JWT=' + token);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
