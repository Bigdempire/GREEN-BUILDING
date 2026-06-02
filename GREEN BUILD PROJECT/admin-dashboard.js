async function loadMetrics() {
  try {
    const metrics = await apiRequest('/api/metrics');
    document.getElementById('totalProducts').innerText = metrics.total_products;
    document.getElementById('totalSuppliers').innerText = metrics.total_suppliers;
    document.getElementById('avgCarbon').innerText = `${metrics.average_carbon} kg CO₂`;
    // load pending products
    const pending = await apiRequest('/api/products/pending');
    const pendingList = document.getElementById('pendingList');
    if (!pending || pending.length === 0) {
      pendingList.innerHTML = '<p class="text-muted">No pending submissions.</p>';
    } else {
      pendingList.innerHTML = '';
      pending.forEach(p => {
        const el = document.createElement('div');
        el.className = 'card';
        el.style.marginBottom = '10px';
        el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;"> <div><strong>${p.name}</strong> — ${p.supplier} (${p.type})</div>
          <div><button onclick="approve(${p.id})" class="secondary">Approve</button> <button onclick="reject(${p.id})" style="background:#d32f2f;color:#fff;">Reject</button></div></div>`;
        pendingList.appendChild(el);
      });
    }
  } catch (error) {
    document.getElementById('pendingList').innerHTML = '<p style="color:#d32f2f;">Unable to load metrics.</p>';
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  const user = await requireSession();
  if (!user || user.role !== 'admin') {
    window.location.href = 'login.html';
    return;
  }
  loadMetrics();
});

window.logout = logout;

async function approve(id) {
  try {
    await apiRequest(`/api/products/${id}/approve`, { method: 'POST' });
    showToast('Product approved.');
    loadMetrics();
  } catch (e) {
    showToast(e.message || 'Unable to approve.', 'error');
  }
}

async function reject(id) {
  try {
    await apiRequest(`/api/products/${id}/reject`, { method: 'POST' });
    showToast('Product rejected.');
    loadMetrics();
  } catch (e) {
    showToast(e.message || 'Unable to reject.', 'error');
  }
}
