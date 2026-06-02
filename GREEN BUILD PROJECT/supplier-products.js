let products = [];

function getUser() {
  return JSON.parse(localStorage.getItem('ecobuildUser') || 'null');
}

async function loadProducts() {
  try {
    const response = await apiRequest('/api/products');
    products = response;
    renderProducts();
  } catch (error) {
    const list = document.getElementById('productList');
    list.innerHTML = '<p style="color:red;">Unable to load products.</p>';
  }
}

function renderProducts() {
  const list = document.getElementById('productList');
  list.innerHTML = '';

  if (products.length === 0) {
    list.innerHTML = '<p>No products available.</p>';
    return;
  }

  products.forEach(product => {
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
          <p><strong>Durability:</strong> ${product.durability || 'N/A'} years</p>
          ${product.contact_info ? `<p><strong>Contact:</strong> <a href="${product.contact_info.includes('@') ? `mailto:${product.contact_info}` : `tel:${product.contact_info.replace(/[^+0-9]/g, '')}`}" style="color:var(--accent);">${product.contact_info}</a></p>` : ''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;justify-content:flex-end;margin-top:16px;">
        <button type="button" onclick="editProduct(${product.id})" class="secondary">Edit</button>
        <button type="button" onclick="deleteProduct(${product.id})" style="background:#d32f2f;color:#fff;">Delete</button>
      </div>
    `;
    list.appendChild(card);
  });
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  const session = JSON.parse(localStorage.getItem('ecobuildUser') || 'null');
  const headers = {};
  if (session?.csrf_token) headers['X-CSRF-Token'] = session.csrf_token;

  const response = await fetch('/api/upload-image', {
    method: 'POST',
    headers,
    body: formData
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Image upload failed.');
  }

  return await response.json();
}

function updateImagePreview(file) {
  const previewGroup = document.getElementById('imagePreviewGroup');
  const preview = document.getElementById('imagePreview');

  if (!file) {
    previewGroup.style.display = 'none';
    preview.src = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = event => {
    preview.src = event.target.result;
    previewGroup.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

document.getElementById('image_file').addEventListener('change', event => {
  updateImagePreview(event.target.files[0]);
});

async function saveProduct(event) {
  event.preventDefault();
  const id = document.getElementById('productId').value;
  let imageUrl = document.getElementById('image_url').value.trim();
  const imageFile = document.getElementById('image_file').files[0];

  if (imageFile) {
    try {
      const uploadResult = await uploadImage(imageFile);
      imageUrl = uploadResult.image_url;
    } catch (error) {
      showToast(error.message || 'Image upload failed.', 'error');
      return;
    }
  }

  const payload = {
    name: document.getElementById('name').value.trim(),
    supplier: document.getElementById('supplier').value.trim(),
    type: document.getElementById('type').value.trim(),
    price: parseFloat(document.getElementById('price').value),
    strength: parseFloat(document.getElementById('strength').value) || 0,
    durability: parseFloat(document.getElementById('durability').value) || 0,
    carbon: parseFloat(document.getElementById('carbon').value),
    unit: document.getElementById('unit').value.trim(),
    contact_info: document.getElementById('contact_info').value.trim(),
    image_url: imageUrl
  };

  try {
    if (id) {
      await apiRequest(`/api/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showToast('Product updated successfully.');
    } else {
      await apiRequest('/api/products', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast('Product created successfully.');
    }
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    updateImagePreview(null);
    loadProducts();
  } catch (error) {
    showToast(error.message || 'Unable to save product.', 'error');
  }
}

async function editProduct(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  document.getElementById('productId').value = product.id;
  document.getElementById('name').value = product.name;
  document.getElementById('supplier').value = product.supplier;
  document.getElementById('type').value = product.type;
  document.getElementById('price').value = product.price;
  document.getElementById('strength').value = product.strength;
  document.getElementById('durability').value = product.durability;
  document.getElementById('carbon').value = product.carbon;
  document.getElementById('unit').value = product.unit;
  document.getElementById('contact_info').value = product.contact_info || '';
  document.getElementById('image_url').value = product.image_url || '';
  document.getElementById('image_file').value = '';
  if (product.image_url) {
    const previewGroup = document.getElementById('imagePreviewGroup');
    const preview = document.getElementById('imagePreview');
    preview.src = product.image_url;
    previewGroup.style.display = 'block';
  } else {
    updateImagePreview(null);
  }
}

async function deleteProduct(productId) {
  if (!confirm('Delete this product?')) return;
  try {
    await apiRequest(`/api/products/${productId}`, { method: 'DELETE' });
    showToast('Product deleted successfully.');
    loadProducts();
  } catch (error) {
    showToast(error.message || 'Unable to delete product.', 'error');
  }
}

document.getElementById('productForm').addEventListener('submit', saveProduct);
window.addEventListener('DOMContentLoaded', async () => {
  const user = await requireSession();
  if (!user || user.role !== 'supplier') {
    window.location.href = 'login.html';
    return;
  }
  await loadProducts();
});
