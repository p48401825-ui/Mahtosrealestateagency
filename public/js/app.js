// Shared site logic: nav, helpers, auth state
(function () {
  const AUTH_KEY = 'mahtos_token';
  const USER_KEY = 'mahtos_user';

  // Navbar toggle
  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('.nav-toggle');
    const links = document.querySelector('.nav-links');
    if (toggle && links) {
      toggle.addEventListener('click', () => links.classList.toggle('open'));
      const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
      document.querySelectorAll('.nav-links a').forEach(a => {
        const href = (a.getAttribute('href') || '').toLowerCase();
        if (href === page || (page === 'index.html' && (href === '' || href === 'index.html'))) {
          a.classList.add('active');
        }
      });
    }
    renderAuthLinks();
  });

  function renderAuthLinks() {
    const nav = document.querySelector('.nav-links');
    if (!nav) return;
    // remove any existing auth chips
    document.querySelectorAll('.nav-auth').forEach(el => el.remove());
    const user = getCurrentUser();
    const chip = document.createElement('a');
    chip.className = 'nav-auth';
    if (user) {
      chip.href = user.role === 'admin' ? 'admin.html' : 'dashboard.html';
      chip.textContent = user.role === 'admin' ? 'Admin Panel' : 'My Dashboard';
    } else {
      chip.href = 'login.html';
      chip.textContent = 'Login';
    }
    nav.appendChild(chip);
    if (user) {
      const out = document.createElement('a');
      out.className = 'nav-auth';
      out.href = '#';
      out.textContent = 'Logout';
      out.addEventListener('click', e => { e.preventDefault(); logout(); });
      nav.appendChild(out);
    }
  }

  function getToken() { return localStorage.getItem(AUTH_KEY); }
  function getCurrentUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); }
    catch (e) { return null; }
  }
  function saveSession(token, user) {
    localStorage.setItem(AUTH_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  function logout() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(USER_KEY);
    location.href = 'index.html';
  }

  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch('/api' + path, { ...options, headers });
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (res.status === 401 && !path.startsWith('/auth/')) {
      logout();
      throw new Error('Session expired — please login again.');
    }
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  function formatINR(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  function showAlert(el, message, type) {
    if (!el) return;
    el.textContent = message;
    el.className = 'alert ' + type;
    el.style.display = 'block';
  }

  function propertyCard(p) {
    let images = [];
    try { images = JSON.parse(p.images || '[]'); } catch (e) {}
    const img = images[0] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800';
    return `
      <a class="card" href="property.html?id=${p.id}">
        <div class="card-img" style="background-image:url('${img}')">
          <span class="card-badge">${p.status === 'rent' ? 'Rent' : 'Sale'}</span>
        </div>
        <div class="card-body">
          <h3>${p.title}</h3>
          <div class="card-loc">📍 ${p.locality}, ${p.city}</div>
          <div class="card-price">${formatINR(p.price)}${p.status === 'rent' ? '/month' : ''}</div>
          <div class="card-meta">
            ${p.bedrooms ? `<span>${p.bedrooms} BHK</span>` : ''}
            ${p.area ? `<span>${p.area} sqft</span>` : ''}
            <span>${p.type}</span>
          </div>
        </div>
      </a>`;
  }

  window.App = { api, getToken, getCurrentUser, saveSession, logout, formatINR, showAlert, propertyCard };
})();
