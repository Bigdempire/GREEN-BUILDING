const compareListKey = 'ecobuildCompare';
let products = [];
let compareList = JSON.parse(localStorage.getItem(compareListKey) || '[]');
let searchQuery = '';
let selectedType = '';
let sortOrder = 'name-asc';
let maxPrice = 1000;
let maxCarbon = 1000;

function getUser() {
  return JSON.parse(localStorage.getItem('ecobuildUser') || 'null');
}

function formatResultCount(count, total) {
  const label = count === total ? 'Showing all' : 'Showing';
  return `${label} ${count} of ${total} materials`;
}

function sortProducts(list) {
  const [key, direction] = sortOrder.split('-');
  return list.slice().sort((a, b) => {
    if (key === 'price' || key === 'carbon') {
      return direction === 'asc' ? a[key] - b[key] : b[key] - a[key];
    }
    if (key === 'name') {
      return direction === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    }
    return 0;
  });
}

function formatContactLink(contact) {
  if (!contact) return '';
  const trimmed = contact.trim();
  if (trimmed.includes('@')) {
    return `<a href="mailto:${trimmed}">${trimmed}</a>`;
  }
  const phone = trimmed.replace(/[^+0-9]/g, '');
  return `<a href="tel:${phone}">${trimmed}</a>`;
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  const status = document.getElementById('productStatus');
  grid.innerHTML = '';

  const filtered = products.filter(product => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || [product.name, product.supplier, product.type].some(value => value.toLowerCase().includes(query));
    const matchesType = !selectedType || product.type === selectedType;
    const matchesPrice = product.price <= maxPrice;
    const matchesCarbon = product.carbon <= maxCarbon;
    return matchesSearch && matchesType && matchesPrice && matchesCarbon;
  });

  const sorted = sortProducts(filtered);
  status.innerText = formatResultCount(sorted.length, products.length);

  if (sorted.length === 0) {
    grid.innerHTML = '<div class="card"><h3>No materials match the current filters.</h3><p>Try adjusting search, type, price, or carbon settings.</p></div>';
    return;
  }

  sorted.forEach(product => {
    const card = document.createElement('div');
    card.className = 'card product-card';
    card.innerHTML = `
      <div style="display:grid;grid-template-columns:120px 1fr;gap:18px;align-items:start;">
        ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}" style="width:120px;height:120px;object-fit:cover;border-radius:18px;" />` : ''}
        <div>
          <h3>${product.name}</h3>
          <p>${product.supplier} · ${product.type}</p>
          <p><strong>Price:</strong> $${product.price}/${product.unit}</p>
          <p><strong>Carbon:</strong> ${product.carbon} kg CO₂</p>
          <p><strong>Strength:</strong> ${product.strength || 'N/A'} MPa</p>
          ${product.contact_info ? `<p><strong>Contact:</strong> ${formatContactLink(product.contact_info)}</p>` : ''}
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:10px; justify-content:flex-end; margin-top:16px;">
        <button type="button" class="secondary" onclick="window.location.href='buyer-compare.html'">Compare</button>
        <button type="button" class="primary" onclick="toggleCompare(${product.id})">${compareList.includes(product.id) ? 'Remove' : 'Add to compare'}</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function populateFilterOptions() {
  const typeFilter = document.getElementById('typeFilter');
  const types = [...new Set(products.map(p => p.type).filter(Boolean))].sort();
  typeFilter.innerHTML = '<option value="">All Types</option>' + types.map(type => `<option value="${type}">${type}</option>`).join('');
}

function updateFilterDisplays() {
  document.getElementById('priceValue').innerText = Number(maxPrice).toLocaleString();
  document.getElementById('carbonValue').innerText = Number(maxCarbon).toLocaleString();
}

function initializeRanges() {
  const priceRange = document.getElementById('priceRange');
  const carbonRange = document.getElementById('carbonRange');
  const highestPrice = Math.max(...products.map(p => p.price), 1000);
  const highestCarbon = Math.max(...products.map(p => p.carbon), 1000);

  priceRange.max = highestPrice;
  carbonRange.max = highestCarbon;
  priceRange.value = highestPrice;
  carbonRange.value = highestCarbon;
  maxPrice = highestPrice;
  maxCarbon = highestCarbon;
  updateFilterDisplays();
}

function attachFilters() {
  const searchInput = document.getElementById('searchInput');
  const typeFilter = document.getElementById('typeFilter');
  const sortSelect = document.getElementById('sortOrder');
  const priceRange = document.getElementById('priceRange');
  const carbonRange = document.getElementById('carbonRange');
  const clearFilters = document.getElementById('clearFilters');

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    renderProducts();
  });

  typeFilter.addEventListener('change', () => {
    selectedType = typeFilter.value;
    renderProducts();
  });

  sortSelect.addEventListener('change', () => {
    sortOrder = sortSelect.value;
    renderProducts();
  });

  priceRange.addEventListener('input', () => {
    maxPrice = parseFloat(priceRange.value);
    updateFilterDisplays();
    renderProducts();
  });

  carbonRange.addEventListener('input', () => {
    maxCarbon = parseFloat(carbonRange.value);
    updateFilterDisplays();
    renderProducts();
  });

  clearFilters.addEventListener('click', () => {
    searchQuery = '';
    selectedType = '';
    sortOrder = 'name-asc';
    const highestPrice = parseFloat(priceRange.max);
    const highestCarbon = parseFloat(carbonRange.max);
    maxPrice = highestPrice;
    maxCarbon = highestCarbon;
    searchInput.value = '';
    typeFilter.value = '';
    sortSelect.value = 'name-asc';
    priceRange.value = highestPrice;
    carbonRange.value = highestCarbon;
    updateFilterDisplays();
    renderProducts();
  });
}

function updateCompareBadge() {
  const badge = document.getElementById('compare-badge');
  if (!badge) return;
  if (compareList.length > 0) {
    badge.innerText = compareList.length;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

function toggleCompare(productId) {
  if (compareList.includes(productId)) {
    compareList = compareList.filter(id => id !== productId);
    showToast('Removed from comparison.', 'success');
  } else {
    if (compareList.length >= 4) {
      showToast('Maximum 4 materials can be compared.', 'error');
      return;
    }
    compareList.push(productId);
    showToast('Added to comparison.', 'success');
  }
  localStorage.setItem(compareListKey, JSON.stringify(compareList));
  renderProducts();
  updateCompareBadge();
}

async function loadProducts() {
  try {
    const response = await fetch('/api/products');
    products = await response.json();
    populateFilterOptions();
    initializeRanges();
    attachFilters();
    renderProducts();
    updateCompareBadge();
  } catch (error) {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = '<div class="card"><p style="color:#d32f2f;">Unable to load products.</p></div>';
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  const user = await requireSession();
  if (!user) return;
  await loadProducts();
});

window.logout = logout;
window.toggleCompare = toggleCompare;
