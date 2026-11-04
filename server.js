require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mahtos-dev-secret-change-me';
const TOKEN_TTL = '7d';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40 });
app.use('/api', apiLimiter);

/* ---------- helpers ---------- */
function sign(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Login required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access only' });
  next();
}
function publicUser(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, email: row.email, phone: row.phone, role: row.role, blocked: row.blocked, created_at: row.created_at };
}

/* ---------- AUTH ---------- */
app.post('/api/auth/register', authLimiter, (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Name, valid email and password (6+ chars) are required' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (exists) return res.status(409).json({ error: 'Email already registered' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?,?,?,?,?)')
    .run(name.trim(), String(email).toLowerCase().trim(), phone || '', hash, 'user');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (user.blocked) return res.status(403).json({ error: 'Account blocked. Contact admin.' });
  res.json({ token: sign(user), user: publicUser(user) });
});

app.get('/api/auth/me', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});

/* ---------- PROPERTIES (public) ---------- */
function propertyWhere(q) {
  const w = ['active = 1'];
  const params = [];
  if (q.city) { w.push('city LIKE ?'); params.push('%' + q.city + '%'); }
  if (q.type) { w.push('type = ?'); params.push(q.type); }
  if (q.status) { w.push('status = ?'); params.push(q.status); }
  if (q.bedrooms) { w.push('bedrooms >= ?'); params.push(Number(q.bedrooms)); }
  if (q.minPrice) { w.push('price >= ?'); params.push(Number(q.minPrice)); }
  if (q.maxPrice) { w.push('price <= ?'); params.push(Number(q.maxPrice)); }
  if (q.q) {
    const like = '%' + q.q + '%';
    w.push('(title LIKE ? OR city LIKE ? OR locality LIKE ? OR description LIKE ?)');
    params.push(like, like, like, like);
  }
  return { where: w.join(' AND '), params };
}

app.get('/api/properties', (req, res) => {
  const { where, params } = propertyWhere(req.query);
  const rows = db.prepare(`SELECT * FROM properties WHERE ${where} ORDER BY featured DESC, created_at DESC LIMIT 60`).all(...params);
  res.json({ properties: rows });
});

app.get('/api/properties/featured', (req, res) => {
  const rows = db.prepare('SELECT * FROM properties WHERE active = 1 AND featured = 1 ORDER BY created_at DESC LIMIT 6').all();
  res.json({ properties: rows });
});

app.get('/api/properties/by-slug/:slug', (req, res) => {
  const row = db.prepare('SELECT * FROM properties WHERE slug = ? LIMIT 1').get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Property not found' });
  res.json({ property: row });
});

app.get('/api/properties/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Property not found' });
  res.json({ property: row });
});

/* ---------- ENQUIRIES (public) ---------- */
app.post('/api/enquiries', (req, res) => {
  const { name, email, phone, message, property_id } = req.body || {};
  if (!name || !email || !phone || !message) {
    return res.status(400).json({ error: 'Name, email, phone and message are required' });
  }
  const info = db.prepare('INSERT INTO enquiries (name, email, phone, message, property_id) VALUES (?,?,?,?,?)')
    .run(name.trim(), String(email).toLowerCase().trim(), phone.trim(), message.trim(), property_id || null);
  res.status(201).json({ ok: true, id: info.lastInsertRowid });
});

/* ---------- USER PANEL ---------- */
app.get('/api/me/enquiries', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const rows = db.prepare('SELECT e.*, p.title AS property_title FROM enquiries e LEFT JOIN properties p ON p.id = e.property_id WHERE e.email = ? ORDER BY e.created_at DESC').all(user.email);
  res.json({ enquiries: rows });
});

app.put('/api/me/profile', auth, (req, res) => {
  const { name, phone } = req.body || {};
  db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(name?.trim() || '', phone?.trim() || '', req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});

app.put('/api/me/password', auth, (req, res) => {
  const { current, next } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current || '', user.password_hash)) return res.status(400).json({ error: 'Current password is wrong' });
  if (!next || next.length < 6) return res.status(400).json({ error: 'New password must be 6+ chars' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(next, 10), req.user.id);
  res.json({ ok: true });
});

/* ---------- ADMIN PANEL ---------- */
function parseProperty(body) {
  const p = body || {};
  return {
    title: String(p.title || '').trim(),
    slug: String(p.slug || '').trim() || String(p.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    type: p.type || 'Residential',
    status: p.status || 'sale',
    price: Number(p.price) || 0,
    area: Number(p.area) || 0,
    bedrooms: Number(p.bedrooms) || 0,
    bathrooms: Number(p.bathrooms) || 0,
    city: String(p.city || '').trim(),
    locality: String(p.locality || '').trim(),
    description: String(p.description || '').trim(),
    features: JSON.stringify(Array.isArray(p.features) ? p.features : []),
    images: JSON.stringify(Array.isArray(p.images) ? p.images : []),
    featured: p.featured ? 1 : 0,
    active: p.active === false ? 0 : 1
  };
}

app.post('/api/admin/properties', auth, adminOnly, (req, res) => {
  const p = parseProperty(req.body);
  if (!p.title || !p.city || !p.price) return res.status(400).json({ error: 'Title, city and price are required' });
  const info = db.prepare(`INSERT INTO properties (title, slug, type, status, price, area, bedrooms, bathrooms, city, locality, description, features, images, featured, active)
    VALUES (@title,@slug,@type,@status,@price,@area,@bedrooms,@bathrooms,@city,@locality,@description,@features,@images,@featured,@active)`).run(p);
  res.status(201).json({ ok: true, id: info.lastInsertRowid });
});

app.put('/api/admin/properties/:id', auth, adminOnly, (req, res) => {
  const p = parseProperty(req.body);
  db.prepare(`UPDATE properties SET title=@title, slug=@slug, type=@type, status=@status, price=@price, area=@area,
    bedrooms=@bedrooms, bathrooms=@bathrooms, city=@city, locality=@locality, description=@description,
    features=@features, images=@images, featured=@featured, active=@active WHERE id=@id`).run({ ...p, id: req.params.id });
  res.json({ ok: true });
});

app.delete('/api/admin/properties/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/enquiries', auth, adminOnly, (req, res) => {
  const rows = db.prepare('SELECT e.*, p.title AS property_title FROM enquiries e LEFT JOIN properties p ON p.id = e.property_id ORDER BY e.created_at DESC').all();
  res.json({ enquiries: rows });
});

app.patch('/api/admin/enquiries/:id', auth, adminOnly, (req, res) => {
  const { status } = req.body || {};
  db.prepare('UPDATE enquiries SET status = ? WHERE id = ?').run(status || 'new', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/enquiries/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM enquiries WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/users', auth, adminOnly, (req, res) => {
  const rows = db.prepare('SELECT id, name, email, phone, role, blocked, created_at FROM users ORDER BY created_at DESC').all();
  res.json({ users: rows });
});

app.patch('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  const { blocked, role } = req.body || {};
  if (role === 'admin' || role === 'user') db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  if (typeof blocked === 'boolean') db.prepare('UPDATE users SET blocked = ? WHERE id = ?').run(blocked ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/blog', (req, res) => {
  const rows = db.prepare('SELECT * FROM posts ORDER BY created_at DESC LIMIT 20').all();
  res.json({ posts: rows });
});

app.post('/api/admin/posts', auth, adminOnly, (req, res) => {
  const { title, body } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'Title and body required' });
  const slug = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const info = db.prepare('INSERT INTO posts (title, slug, body, author) VALUES (?,?,?,?)').run(title.trim(), slug, body.trim(), 'Admin');
  res.status(201).json({ ok: true, id: info.lastInsertRowid });
});

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'Mahtos Real Estate API' }));

app.listen(PORT, () => {
  console.log(`Mahtos Real Estate running at http://localhost:${PORT}`);
});
