# Mahto's Real Estate Agency — Full Stack Website

A complete full-stack real estate agency website with a **user panel** and an **admin panel**, built with Express + SQLite + vanilla HTML/CSS/JS (attractive 3D-styled UI).

## Features

- **Public site**: Home, Properties listing with filters (city, type, budget, BHK), property detail with enquiry form, About, Services, Contact, Blog.
- **User panel**: register/login (JWT auth), dashboard showing your enquiries, edit profile, change password.
- **Admin panel**: secure admin login, add/edit/delete properties, view/update/delete enquiries, manage users (block/delete), publish blog posts.
- **Legal pages**: Privacy Policy, Terms & Conditions, Refund Policy, Disclaimer (RERA / GST disclosures).
- **Security**: bcrypt password hashing, JWT tokens, helmet security headers, rate limiting, admin-only routes, `.env` never committed.

## Tech Stack

- Backend: Node.js, Express, better-sqlite3, jsonwebtoken, bcryptjs, helmet, express-rate-limit
- Frontend: HTML5, CSS3 (glassmorphism + 3D card effects), vanilla JavaScript
- Database: SQLite (zero-config, ships with the app)

## Run locally

```bash
npm install
cp .env.example .env   # then edit values
npm start
```

Open http://localhost:3000

Default admin (change after first login): `admin@mahtos.com` / `Mahtos@2024`

## Project structure

```
server.js          # Express app + all API routes
db.js              # SQLite schema + seed data
public/
  index.html       # Home
  properties.html  # Listings with filters
  property.html    # Property detail + enquiry
  about.html services.html contact.html blog.html
  login.html register.html
  dashboard.html   # User panel
  admin.html       # Admin panel
  privacy.html terms.html refund.html disclaimer.html
  css/style.css
  js/app.js api.js
.gitignore         # blocks .env, node_modules, db files
.env.example       # template only — NEVER commit .env
```

## Important legal note

Add your real **RERA registration number**, **GSTIN** and **PAN** in `.env` (agents in India must display these and follow RERA ad rules).
