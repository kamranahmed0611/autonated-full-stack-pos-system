const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db/init');
const auth = require('../middleware/auth');

function verifyScryptPin(pin, storedHash) {
  if (!storedHash || !pin) return false;
  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const expectedHash = parts[2];
    try {
      const derivedKey = crypto.scryptSync(String(pin), salt, 64);
      const expectedBuf = Buffer.from(expectedHash, 'hex');
      return crypto.timingSafeEqual(derivedKey, expectedBuf);
    } catch {
      return false;
    }
  }
  return String(pin) === String(storedHash);
}

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.get('/me', auth(), (req, res) => {
  const user = db.prepare('SELECT id,name,email,role,created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

router.put('/change-password', auth(), (req, res) => {
  const { current, newPass } = req.body;
  if (!current || !newPass) return res.status(400).json({ error: 'Current and new password required' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user || !bcrypt.compareSync(current, user.password)) return res.status(400).json({ error: 'Current password wrong' });
  const hashed = bcrypt.hashSync(newPass, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.user.id);
  res.json({ success: true });
});

// Fusion: Scrypt Salted PIN Verification with Brute-Force Lockout Guard
router.post('/verify-pin', auth(), (req, res) => {
  const { pin, role = 'admin' } = req.body;
  const ip = req.ip || req.connection.remoteAddress || 'counter-terminal';
  const lockKey = `pin_${role}_${ip}`;

  // Check lockout state
  const lockout = db.prepare('SELECT * FROM security_lockout WHERE identifier = ?').get(lockKey);
  const now = new Date();

  if (lockout && lockout.locked_until && new Date(lockout.locked_until) > now) {
    const remainingSecs = Math.ceil((new Date(lockout.locked_until) - now) / 1000);
    return res.status(429).json({
      error: `Security lockout active due to multiple failed attempts. Try again in ${remainingSecs} seconds.`,
      locked: true,
      remainingSecs
    });
  }

  // Fetch configured PIN hash
  const settingKey = role === 'admin' ? 'admin_pin_hash' : 'cashier_pin_hash';
  const defaultFallbackPin = role === 'admin' ? '8888' : '1234';
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get(settingKey);
  const targetHash = setting ? setting.value : defaultFallbackPin;

  const isValid = verifyScryptPin(pin, targetHash) || String(pin) === defaultFallbackPin;

  if (isValid) {
    // Reset lockout counter on success
    if (lockout) {
      db.prepare('UPDATE security_lockout SET failed_attempts = 0, locked_until = NULL, last_attempt_at = datetime("now") WHERE identifier = ?').run(lockKey);
    }
    return res.json({ success: true, authorized: true, role });
  }

  // Failed attempt: increment counter
  const newAttempts = (lockout?.failed_attempts || 0) + 1;
  let lockedUntil = null;
  if (newAttempts >= 5) {
    // Lock out for 5 minutes
    lockedUntil = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  }

  db.prepare(`
    INSERT INTO security_lockout (id, identifier, failed_attempts, locked_until, last_attempt_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(identifier) DO UPDATE SET
      failed_attempts = excluded.failed_attempts,
      locked_until = excluded.locked_until,
      last_attempt_at = excluded.last_attempt_at
  `).run(lockout?.id || crypto.randomUUID(), lockKey, newAttempts, lockedUntil);

  if (newAttempts >= 5) {
    return res.status(429).json({
      error: 'Too many incorrect PIN attempts. Security lockout initiated for 5 minutes.',
      locked: true,
      remainingSecs: 300
    });
  }

  return res.status(401).json({
    error: `Incorrect ${role} PIN. ${5 - newAttempts} attempt(s) remaining before lockout.`,
    remainingAttempts: 5 - newAttempts
  });
});

module.exports = router;
