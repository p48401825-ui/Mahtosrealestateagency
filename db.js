const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'mahtos.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  blocked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  type TEXT DEFAULT 'Residential',
  status TEXT DEFAULT 'sale',
  price REAL DEFAULT 0,
  area REAL DEFAULT 0,
  bedrooms INTEGER DEFAULT 0,
  bathrooms INTEGER DEFAULT 0,
  city TEXT DEFAULT '',
  locality TEXT DEFAULT '',
  description TEXT DEFAULT '',
  features TEXT DEFAULT '[]',
  images TEXT DEFAULT '[]',
  featured INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  property_id INTEGER,
  status TEXT DEFAULT 'new',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  body TEXT NOT NULL,
  author TEXT DEFAULT 'Admin',
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// Seed admin user on first run
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@mahtos.com').toLowerCase().trim();
const adminPass = process.env.ADMIN_PASSWORD || 'Mahtos@2024';
const admin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
if (!admin) {
  db.prepare('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?,?,?,?,?)')
    .run('Site Admin', adminEmail, '+91 98765 43210', bcrypt.hashSync(adminPass, 10), 'admin');
  console.log('Admin account created:', adminEmail);
}

// Seed a couple of sample properties so the site is never blank
const count = db.prepare('SELECT COUNT(*) AS c FROM properties').get().c;
if (count === 0) {
  const seed = db.prepare(`INSERT INTO properties (title, slug, type, status, price, area, bedrooms, bathrooms, city, locality, description, features, images, featured, active)
    VALUES (@title,@slug,@type,@status,@price,@area,@bedrooms,@bathrooms,@city,@locality,@description,@features,@images,@featured,@active)`);
  seed.run({
    title: '3BHK Premium Villa', slug: '3bhk-premium-villa', type: 'Residential', status: 'sale',
    price: 8950000, area: 1850, bedrooms: 3, bathrooms: 3, city: 'Udhampur', locality: 'Patnitop Road',
    description: 'A luxurious villa with mountain views, modern interiors and a private garden. Ready to move in.',
    features: JSON.stringify(['Garden', 'Parking', '24x7 Security', 'Modular Kitchen']),
    images: JSON.stringify(['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800']),
    featured: 1, active: 1
  });
  seed.run({
    title: '2BHK Apartment', slug: '2bhk-apartment', type: 'Residential', status: 'rent',
    price: 18000, area: 1100, bedrooms: 2, bathrooms: 2, city: 'Jammu', locality: 'Gandhi Nagar',
    description: 'Spacious 2BHK apartment in a prime location, close to markets and schools.',
    features: JSON.stringify(['Power Backup', 'Lift', 'Water Supply']),
    images: JSON.stringify(['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800']),
    featured: 1, active: 1
  });
  seed.run({
    title: 'Commercial Shop Space', slug: 'commercial-shop-space', type: 'Commercial', status: 'sale',
    price: 4500000, area: 600, bedrooms: 0, bathrooms: 1, city: 'Udhampur', locality: 'Main Market',
    description: 'High-footfall commercial shop on the main market road. Ideal for retail or office.',
    features: JSON.stringify(['Main Road', 'Electricity', 'Storage']),
    images: JSON.stringify(['https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800']),
    featured: 0, active: 1
  });
}

module.exports = db;
