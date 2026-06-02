let materials = [];
const fallbackConventionalMaterials = [
  { id: -101, name: 'Standard Portland cement', supplier: 'Conventional', type: 'Cement', price: 80, carbon: 820, unit: 'ton', strength: 35, durability: 50, image_url: '' },
  { id: -102, name: 'Normal reinforced concrete', supplier: 'Conventional', type: 'Concrete', price: 120, carbon: 400, unit: 'ton', strength: 40, durability: 60, image_url: '' },
  { id: -103, name: 'Conventional steel frame', supplier: 'Conventional', type: 'Steel', price: 900, carbon: 2000, unit: 'ton', strength: 250, durability: 80, image_url: '' },
  { id: -104, name: 'Traditional clay brick', supplier: 'Conventional', type: 'Brick', price: 120, carbon: 250, unit: 'ton', strength: 15, durability: 80, image_url: '' },
  { id: -105, name: 'Conventional foam insulation', supplier: 'Conventional', type: 'Insulation', price: 60, carbon: 280, unit: 'ton', strength: 5, durability: 30, image_url: '' }
];

async function loadMaterials() {
  try {
    const response = await fetch('/api/products');
    materials = await response.json();
    materials = [...fallbackConventionalMaterials, ...materials];
    populateSelects();
  } catch (error) {
    document.getElementById('results').innerHTML = '<p style="color:red;">Unable to load product data. Please refresh.</p>';
  }
}

function populateSelects() {
  const conventionalSelect = document.getElementById('conventional');
  const alternativeSelect = document.getElementById('alternative');

  conventionalSelect.innerHTML = '<option value="">Select conventional material</option>';
  alternativeSelect.innerHTML = '<option value="">Select sustainable alternative</option>';

  materials.forEach(item => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.name} — ${item.supplier} (${item.carbon} kg CO₂/${item.unit})`;
    if (item.carbon > 200) {
      conventionalSelect.appendChild(option.cloneNode(true));
    } else {
      alternativeSelect.appendChild(option);
    }
  });
}

function formatNumber(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function calculateSavings() {
  const conventionalId = parseInt(document.getElementById('conventional').value, 10);
  const alternativeId = parseInt(document.getElementById('alternative').value, 10);
  const qty = parseFloat(document.getElementById('quantity').value);

  const conventional = materials.find(m => m.id === conventionalId);
  const alternative = materials.find(m => m.id === alternativeId);
  const resultsDiv = document.getElementById('results');

  if (!conventional || !alternative || !qty || qty <= 0) {
    resultsDiv.innerHTML = '<p style="color:#d32f2f;">Please choose valid materials and quantity.</p>';
    return;
  }

  const conventionalCarbon = conventional.carbon * qty;
  const alternativeCarbon = alternative.carbon * qty;
  const savings = conventionalCarbon - alternativeCarbon;
  const percentage = conventionalCarbon ? (savings / conventionalCarbon) * 100 : 0;

  resultsDiv.innerHTML = `
    <div class="stats-grid">
      <div class="card">
        <h3>Estimated savings</h3>
        <p><strong>${formatNumber(savings)} kg CO₂</strong></p>
      </div>
      <div class="card">
        <h3>Reduction</h3>
        <p><strong>${percentage > 0 ? formatNumber(percentage) + '% reduction' : formatNumber(Math.abs(percentage)) + '% increase'}</strong></p>
      </div>
      <div class="card">
        <h3>Conventional carbon</h3>
        <p>${formatNumber(conventionalCarbon)} kg CO₂</p>
      </div>
      <div class="card">
        <h3>Alternative carbon</h3>
        <p>${formatNumber(alternativeCarbon)} kg CO₂</p>
      </div>
    </div>
  `;

  if (savings > 0) {
    const equivalents = [
      { label: 'Cars off the road for 1 year', value: Math.round(savings / 4600) },
      { label: 'Trees planted', value: Math.round(savings / 21) },
      { label: 'Homes powered for 1 month', value: Math.round(savings / 400) }
    ];

    resultsDiv.innerHTML += '<div class="card" style="margin-top:16px;"><h3>Environmental equivalency</h3>';
    equivalents.forEach(item => {
      resultsDiv.innerHTML += `<p>${item.value} ${item.label}</p>`;
    });
    resultsDiv.innerHTML += '</div>';
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  const user = await requireSession();
  if (!user) return;
  loadMaterials();
});
