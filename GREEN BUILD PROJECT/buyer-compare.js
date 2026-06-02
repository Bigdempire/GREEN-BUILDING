let products = [];
let selectedProducts = [];
let chartInstance = null;

const contentArea = document.getElementById('contentArea');
const materialButtons = document.getElementById('materialButtons');
const viewMode = document.getElementById('viewMode');

async function loadProducts() {
  try {
    const response = await fetch('/api/products');
    products = await response.json();
    renderButtons();
    renderContent();
  } catch (error) {
    contentArea.innerHTML = '<div class="card"><h3>Error loading products</h3><p>Please refresh the page.</p></div>';
  }
}

viewMode.addEventListener('change', renderContent);

function renderButtons() {
  materialButtons.innerHTML = '';
  const available = products.filter(product => !selectedProducts.includes(product.id));
  if (available.length === 0) {
    materialButtons.innerHTML = '<p class="text-muted">All products are added to the comparison.</p>';
    return;
  }

  available.forEach(product => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button secondary';
    button.textContent = product.name;
    button.onclick = () => addProduct(product.id);
    materialButtons.appendChild(button);
  });
}

function addProduct(productId) {
  if (selectedProducts.length >= 4) {
    showToast('You can compare up to 4 materials.', 'error');
    return;
  }
  selectedProducts.push(productId);
  renderButtons();
  renderContent();
}

function removeProduct(productId) {
  selectedProducts = selectedProducts.filter(id => id !== productId);
  renderButtons();
  renderContent();
}

function getSelected() {
  return products.filter(product => selectedProducts.includes(product.id));
}

function renderContent() {
  const selected = getSelected();
  if (selected.length === 0) {
    contentArea.innerHTML = '<div class="card"><h3>No materials selected</h3><p>Select products from the list above to compare key metrics.</p></div>';
    return;
  }

  if (viewMode.value === 'chart') renderBarChart(selected);
  else if (viewMode.value === 'radar') renderRadarChart(selected);
  else renderTable(selected);
}

function renderTable(selected) {
  let html = '<div class="table-wrapper"><table class="table"><thead><tr><th>Property</th>';
  selected.forEach(product => {
    html += `<th>${product.name}<button type="button" style="margin-left:8px;" onclick="removeProduct(${product.id})">×</button></th>`;
  });
  html += '</tr></thead><tbody>';
  html += createRow('Type', selected.map(p => p.type));
  html += createRow('Supplier', selected.map(p => p.supplier));
  html += createRow('Price', selected.map(p => `$${p.price}/${p.unit}`));
  html += createRow('Strength', selected.map(p => p.strength ? `${p.strength} MPa` : '—'));
  html += createRow('Durability', selected.map(p => p.durability ? `${p.durability} yrs` : '—'));
  html += createRow('Embodied Carbon', selected.map(p => `${p.carbon} kg CO₂`));
  html += '</tbody></table></div>';
  contentArea.innerHTML = html;
}

function createRow(label, values) {
  return `<tr><td><strong>${label}</strong></td>${values.map(value => `<td>${value}</td>`).join('')}</tr>`;
}

function renderBarChart(selected) {
  contentArea.innerHTML = '<canvas id="chartCanvas" height="120"></canvas>';
  const ctx = document.getElementById('chartCanvas');
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: selected.map(p => p.name),
      datasets: [
        { label: 'Price', data: selected.map(p => p.price), backgroundColor: 'rgba(46,125,50,0.65)' },
        { label: 'Strength', data: selected.map(p => p.strength || 0), backgroundColor: 'rgba(66, 165, 245, 0.65)' },
        { label: 'Carbon', data: selected.map(p => p.carbon), backgroundColor: 'rgba(255, 193, 7, 0.65)' }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function renderRadarChart(selected) {
  contentArea.innerHTML = '<canvas id="chartCanvas" height="120"></canvas>';
  const ctx = document.getElementById('chartCanvas');
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Strength', 'Durability', 'Carbon Efficiency', 'Value'],
      datasets: selected.map(product => ({
        label: product.name,
        data: [
          product.strength ? Math.min((product.strength / 600) * 100, 100) : 10,
          product.durability ? Math.min((product.durability / 100) * 100, 100) : 10,
          Math.max(0, Math.min(100, (1 - product.carbon / 500) * 100)),
          Math.max(0, Math.min(100, (1 - product.price / 200) * 100))
        ],
        fill: true
      }))
    },
    options: {
      responsive: true,
      scales: {
        r: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  const user = await requireSession();
  if (!user) return;
  loadProducts();
});
