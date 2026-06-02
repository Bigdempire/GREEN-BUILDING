const apiBase = window.location.origin;

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

async function apiRequest(path, options = {}) {
  const session = getSession();
  const csrf = session?.csrf_token;
  const method = (options.method || 'GET').toUpperCase();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  if (csrf && method !== 'GET' && method !== 'HEAD') {
    headers['X-CSRF-Token'] = csrf;
  }

  const response = await fetch(`${apiBase}${path}`, {
    credentials: 'same-origin',
    headers,
    ...options
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || 'Request failed');
  }
  return body;
}

function saveSession(user) {
  localStorage.setItem('ecobuildUser', JSON.stringify(user));
  localStorage.setItem('ecobuildRole', user.role);
}

function getSession() {
  return JSON.parse(localStorage.getItem('ecobuildUser') || 'null');
}

async function requireSession() {
  try {
    const response = await fetch('/api/session', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      localStorage.removeItem('ecobuildUser');
      localStorage.removeItem('ecobuildRole');
      window.location.href = 'login.html';
      return null;
    }
    saveSession(body);
    return body;
  } catch (error) {
    const user = getSession();
    if (!user) {
      window.location.href = 'login.html';
      return null;
    }
    return user;
  }
}

async function logout() {
  try {
    await apiRequest('/api/logout', { method: 'POST' });
  } catch (e) {
    // ignore
  }
  localStorage.removeItem('ecobuildUser');
  localStorage.removeItem('ecobuildRole');
  window.location.href = 'login.html';
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.email.value.trim();
  const password = form.password.value.trim();
  const role = form.role?.value || 'buyer';

  try {
    const result = await apiRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, role })
    });
    saveSession(result);
    showToast('Welcome back, ' + result.full_name);
    if (result.role === 'supplier') {
      window.location.href = 'supplier-products.html';
    } else if (result.role === 'admin') {
      window.location.href = 'admin-dashboard.html';
    } else {
      window.location.href = 'buyers.html';
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleSignup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const roleInput = form.role?.value || document.querySelector('input[name="role"]:checked')?.value;
  const role = roleInput || 'buyer';
  const email = form.email.value.trim();
  const password = form.password.value.trim();
  const phone = role === 'supplier' ? form.supplier_phone?.value.trim() : form.phone?.value.trim();
  const organization = form.organization?.value.trim();
  const full_name = form.full_name?.value.trim();
  const company = form.company?.value.trim();
  const location = form.location?.value.trim();

  try {
    await apiRequest('/api/signup', {
      method: 'POST',
      body: JSON.stringify({ role, email, password, phone, organization, full_name, company, location })
    });
    showToast('Account created. Please login.');
    window.location.href = 'login.html';
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderSignupForm() {
  const type = document.querySelector('input[name="role"]:checked')?.value || 'buyer';
  const buyerFields = document.querySelector('.buyer-fields');
  const supplierFields = document.querySelector('.supplier-fields');
  const adminFields = document.querySelector('.admin-fields');

  if (buyerFields) {
    buyerFields.style.display = type === 'buyer' ? 'block' : 'none';
  }
  if (supplierFields) {
    supplierFields.style.display = type === 'supplier' ? 'block' : 'none';
  }
  if (adminFields) {
    adminFields.style.display = type === 'admin' ? 'block' : 'none';
  }
}

function initAuthPage() {
  const authForm = document.getElementById('authForm');
  if (authForm) {
    authForm.addEventListener('submit', authForm.dataset.type === 'signup' ? handleSignup : handleLogin);
  }
  const typeRadios = document.querySelectorAll('input[name="role"]');
  typeRadios.forEach(radio => radio.addEventListener('change', renderSignupForm));
  renderSignupForm();
}

document.addEventListener('DOMContentLoaded', () => {
  initAuthPage();
});
