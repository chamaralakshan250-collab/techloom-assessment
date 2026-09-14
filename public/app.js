// State Management
const state = {
  products: [],
  orders: [],
  cart: [],
  selectedCategory: 'ALL',
  searchQuery: '',
  activeReservation: null, // { orderId, expiresAt, timerInterval }
  stressRunning: false
};

const API_BASE = '/api';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initEventListeners();
  loadProducts();
  loadOrders();
});

// Navigation
function initNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
      });
      document.getElementById(`tab-${target}`).classList.add('active');

      if (target === 'inventory') renderInventoryTable();
      if (target === 'orders') renderOrders();
      if (target === 'stress-test') updateStressProductOptions();
    });
  });
}

function initEventListeners() {
  // Search
  document.getElementById('pos-search-input').addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase();
    renderPosCatalog();
  });

  // Category Pills
  document.querySelectorAll('#category-pills .pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#category-pills .pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.selectedCategory = pill.dataset.category;
      renderPosCatalog();
    });
  });

  // Cart actions
  document.getElementById('btn-clear-cart').addEventListener('click', clearCart);
  document.getElementById('btn-reserve-checkout').addEventListener('click', handleReserveCheckout);
  document.getElementById('btn-open-payment').addEventListener('click', openPaymentModal);

  // DB Reset
  document.getElementById('btn-reset-db').addEventListener('click', handleResetDB);

  // Product CRUD
  document.getElementById('btn-add-product-modal').addEventListener('click', openAddProductModal);
  document.getElementById('form-product').addEventListener('submit', handleSaveProduct);

  // Stress Test
  document.getElementById('btn-run-stress-test').addEventListener('click', runStressTest);
  document.getElementById('stress-product-select').addEventListener('change', updateStressProductPreview);

  // Orders Filter
  document.querySelectorAll('.order-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.order-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderOrders(btn.dataset.filter);
    });
  });
}

// API Calls
async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    const data = await res.json();
    if (data.success) {
      state.products = data.data;
      renderPosCatalog();
      renderInventoryTable();
      updateStressProductOptions();
    }
  } catch (err) {
    showToast('Failed to load products: ' + err.message, 'error');
  }
}

async function loadOrders() {
  try {
    const res = await fetch(`${API_BASE}/orders`);
    const data = await res.json();
    if (data.success) {
      state.orders = data.data;
      document.getElementById('order-count-badge').innerText = data.count;
      renderOrders();
    }
  } catch (err) {
    console.error('Failed to load orders', err);
  }
}

// RENDER POS CATALOG
function renderPosCatalog() {
  const grid = document.getElementById('pos-products-grid');
  let filtered = state.products.filter(p => {
    const matchesCategory = state.selectedCategory === 'ALL' || p.category === state.selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(state.searchQuery) || (p.sku && p.sku.toLowerCase().includes(state.searchQuery));
    return matchesCategory && matchesSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 2rem; color: var(--text-dim);">No products found matching criteria.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const available = p.availableStock;
    let stockClass = 'in-stock';
    let stockLabel = `${available} in stock`;

    if (available === 0) {
      stockClass = 'out-stock';
      stockLabel = 'Out of Stock';
    } else if (available <= 5) {
      stockClass = 'low-stock';
      stockLabel = `Only ${available} left!`;
    }

    return `
      <div class="product-card">
        <div class="product-image-container">
          <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&q=80'">
          <span class="stock-tag ${stockClass}">${stockLabel}</span>
        </div>
        <div class="product-details">
          <div class="product-category">${p.category}</div>
          <div class="product-name">${p.name}</div>
          <div class="product-stock-info">
            Total: ${p.totalStock} | Reserved: ${p.reservedStock || 0} | Avail: <strong>${available}</strong>
          </div>
          <div class="product-card-bottom">
            <span class="product-price">$${p.price.toFixed(2)}</span>
            <button class="btn-add-cart" onclick="addToCart('${p.id}')" ${available <= 0 ? 'disabled' : ''}>
              <i class="fa-solid fa-plus"></i> Add
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// CART MANAGEMENT
function addToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const existing = state.cart.find(item => item.productId === productId);
  const currentInCart = existing ? existing.quantity : 0;

  if (currentInCart + 1 > product.availableStock) {
    showToast(`Cannot add more than available stock (${product.availableStock})`, 'warning');
    return;
  }

  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      availableStock: product.availableStock
    });
  }

  // Reset any active reservation if cart is edited
  if (state.activeReservation) {
    cancelActiveReservationTimer();
  }

  renderCart();
}

function updateCartQty(productId, delta) {
  const item = state.cart.find(i => i.productId === productId);
  if (!item) return;

  const product = state.products.find(p => p.id === productId);
  const newQty = item.quantity + delta;

  if (newQty <= 0) {
    state.cart = state.cart.filter(i => i.productId !== productId);
  } else if (newQty > (product ? product.availableStock : 99)) {
    showToast(`Cannot exceed available stock of ${product.availableStock}`, 'warning');
    return;
  } else {
    item.quantity = newQty;
  }

  if (state.activeReservation) {
    cancelActiveReservationTimer();
  }

  renderCart();
}

function clearCart() {
  state.cart = [];
  cancelActiveReservationTimer();
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cart-items-container');
  const subtotalEl = document.getElementById('cart-subtotal');
  const totalEl = document.getElementById('cart-total');
  const btnReserve = document.getElementById('btn-reserve-checkout');
  const btnPay = document.getElementById('btn-open-payment');

  if (state.cart.length === 0) {
    container.innerHTML = `
      <div class="empty-cart-state">
        <i class="fa-solid fa-cart-shopping"></i>
        <p>Cart is empty</p>
        <small>Select products from catalog to start an order</small>
      </div>
    `;
    subtotalEl.innerText = '$0.00';
    totalEl.innerText = '$0.00';
    btnReserve.classList.remove('hidden');
    btnReserve.disabled = true;
    btnPay.classList.add('hidden');
    return;
  }

  let subtotal = 0;
  container.innerHTML = state.cart.map(item => {
    const lineTotal = item.price * item.quantity;
    subtotal += lineTotal;
    return `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-price">$${item.price.toFixed(2)} &times; ${item.quantity} = $${lineTotal.toFixed(2)}</div>
        </div>
        <div class="cart-qty-ctrl">
          <button class="btn-qty" onclick="updateCartQty('${item.productId}', -1)" ${state.activeReservation ? 'disabled' : ''}>-</button>
          <span class="cart-qty-num">${item.quantity}</span>
          <button class="btn-qty" onclick="updateCartQty('${item.productId}', 1)" ${state.activeReservation ? 'disabled' : ''}>+</button>
        </div>
      </div>
    `;
  }).join('');

  subtotalEl.innerText = `$${subtotal.toFixed(2)}`;
  totalEl.innerText = `$${subtotal.toFixed(2)}`;
  btnReserve.disabled = false;
}

// STOCK RESERVATION
async function handleReserveCheckout() {
  if (state.cart.length === 0) return;

  const customerName = document.getElementById('customer-name-input').value.trim() || 'Walk-in Customer';
  const items = state.cart.map(i => ({ productId: i.productId, quantity: i.quantity }));

  try {
    const res = await fetch(`${API_BASE}/orders/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName, items })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to reserve stock');
    }

    showToast('Stock reserved successfully for 5 minutes!', 'success');
    startReservationTimer(data.data);
    await loadProducts();
    await loadOrders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function startReservationTimer(order) {
  state.activeReservation = {
    orderId: order.id,
    order: order,
    expiresAt: new Date(order.expiresAt).getTime()
  };

  const banner = document.getElementById('reservation-banner');
  const timerText = document.getElementById('reservation-timer');
  const progressFill = document.getElementById('reservation-progress');
  const btnReserve = document.getElementById('btn-reserve-checkout');
  const btnPay = document.getElementById('btn-open-payment');

  banner.classList.remove('hidden');
  btnReserve.classList.add('hidden');
  btnPay.classList.remove('hidden');

  const totalDuration = 5 * 60 * 1000;

  if (state.reservationInterval) clearInterval(state.reservationInterval);

  state.reservationInterval = setInterval(() => {
    const now = Date.now();
    const remaining = state.activeReservation.expiresAt - now;

    if (remaining <= 0) {
      clearInterval(state.reservationInterval);
      cancelActiveReservationTimer();
      showToast('Reservation expired. Stock has been returned to inventory.', 'warning');
      loadProducts();
      loadOrders();
      return;
    }

    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    timerText.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    const percent = (remaining / totalDuration) * 100;
    progressFill.style.width = `${percent}%`;
  }, 1000);
}

function cancelActiveReservationTimer() {
  if (state.reservationInterval) clearInterval(state.reservationInterval);
  state.activeReservation = null;

  document.getElementById('reservation-banner').classList.add('hidden');
  document.getElementById('btn-reserve-checkout').classList.remove('hidden');
  document.getElementById('btn-open-payment').classList.add('hidden');
}

// PAYMENT MODAL & SIMULATION
function openPaymentModal() {
  if (!state.activeReservation) return;
  const order = state.activeReservation.order;

  document.getElementById('modal-pay-order-id').innerText = order.id;
  document.getElementById('modal-pay-customer').innerText = order.customerName;
  document.getElementById('modal-pay-amount').innerText = `$${order.totalAmount.toFixed(2)}`;
  
  // Generate random idempotency key for this checkout attempt
  const idempKey = `IDEMP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  document.getElementById('modal-pay-idemp-key').innerText = idempKey;

  openModal('modal-payment');
}

async function handleSimulatePayment(outcome) {
  if (!state.activeReservation) return;
  const order = state.activeReservation.order;
  const idempotencyKey = document.getElementById('modal-pay-idemp-key').innerText;

  try {
    const res = await fetch(`${API_BASE}/payments/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({
        orderId: order.id,
        simulateOutcome: outcome,
        paymentMethod: 'CARD',
        simulationDelayMs: 600
      })
    });

    const data = await res.json();
    closeModal('modal-payment');

    if (!res.ok) {
      throw new Error(data.error || 'Payment failed');
    }

    if (outcome === 'SUCCESS') {
      showToast(`Payment SUCCESS! Order ${order.id} is confirmed PAID.`, 'success');
      clearCart();
    } else if (outcome === 'FAILURE') {
      showToast(`Payment DECLINED. Order marked FAILED and stock unlocked.`, 'error');
      cancelActiveReservationTimer();
    } else if (outcome === 'TIMEOUT') {
      showToast(`Payment TIMEOUT! Stock reservation expired.`, 'warning');
      cancelActiveReservationTimer();
    }

    await loadProducts();
    await loadOrders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleSimulateDuplicatePayment() {
  if (!state.activeReservation) return;
  const order = state.activeReservation.order;
  const idempotencyKey = document.getElementById('modal-pay-idemp-key').innerText;

  showToast('Simulating concurrent duplicate payment submission...', 'warning');

  // Submit request 1
  const req1 = fetch(`${API_BASE}/payments/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ orderId: order.id, simulateOutcome: 'SUCCESS' })
  });

  // Submit request 2 with exact same idempotency key
  const req2 = fetch(`${API_BASE}/payments/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ orderId: order.id, simulateOutcome: 'SUCCESS' })
  });

  const [res1, res2] = await Promise.all([req1, req2]);
  const data1 = await res1.json();
  const data2 = await res2.json();

  closeModal('modal-payment');

  if (res1.ok && !res2.ok && res2.status === 409) {
    showToast(`Idempotency Verified! Request 1 succeeded, Request 2 rejected (409 Conflict).`, 'success');
  } else if (!res1.ok && res2.ok && res1.status === 409) {
    showToast(`Idempotency Verified! Request 2 succeeded, Request 1 rejected (409 Conflict).`, 'success');
  } else {
    showToast(`Response: Req1(${res1.status}), Req2(${res2.status})`, 'info');
  }

  clearCart();
  await loadProducts();
  await loadOrders();
}

// INVENTORY CRUD TABLE
function renderInventoryTable() {
  const tbody = document.getElementById('inventory-tbody');
  tbody.innerHTML = state.products.map(p => {
    const avail = p.availableStock;
    let badgeClass = avail > 5 ? 'badge-success' : (avail > 0 ? 'badge-warning' : 'badge-danger');

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:0.65rem;">
            <img src="${p.image}" style="width:36px;height:36px;border-radius:4px;object-fit:cover;">
            <strong>${p.name}</strong>
          </div>
        </td>
        <td><code>${p.sku || '-'}</code></td>
        <td><span class="badge badge-purple">${p.category}</span></td>
        <td><strong>$${p.price.toFixed(2)}</strong></td>
        <td>${p.totalStock}</td>
        <td><span style="color:var(--accent-warning);font-weight:700;">${p.reservedStock || 0}</span></td>
        <td><strong style="color:var(--accent-cyan);">${avail}</strong></td>
        <td><span class="badge ${badgeClass}">${avail > 0 ? 'Available' : 'Sold Out'}</span></td>
        <td>
          <div style="display:flex;gap:0.35rem;">
            <button class="btn btn-outline" style="padding:0.25rem 0.5rem;font-size:0.75rem;" onclick="openEditProductModal('${p.id}')">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-outline text-danger" style="padding:0.25rem 0.5rem;font-size:0.75rem;" onclick="handleDeleteProduct('${p.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// PRODUCT MODAL (ADD / EDIT)
function openAddProductModal() {
  document.getElementById('modal-product-title').innerText = 'Add New Product';
  document.getElementById('form-product').reset();
  document.getElementById('prod-form-id').value = '';
  openModal('modal-product');
}

function openEditProductModal(id) {
  const p = state.products.find(item => item.id === id);
  if (!p) return;

  document.getElementById('modal-product-title').innerText = 'Edit Product Inventory';
  document.getElementById('prod-form-id').value = p.id;
  document.getElementById('prod-form-name').value = p.name;
  document.getElementById('prod-form-sku').value = p.sku || '';
  document.getElementById('prod-form-category').value = p.category;
  document.getElementById('prod-form-price').value = p.price;
  document.getElementById('prod-form-stock').value = p.totalStock;
  document.getElementById('prod-form-image').value = p.image || '';

  openModal('modal-product');
}

async function handleSaveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('prod-form-id').value;
  const name = document.getElementById('prod-form-name').value;
  const sku = document.getElementById('prod-form-sku').value;
  const category = document.getElementById('prod-form-category').value;
  const price = parseFloat(document.getElementById('prod-form-price').value);
  const totalStock = parseInt(document.getElementById('prod-form-stock').value, 10);
  const image = document.getElementById('prod-form-image').value;

  try {
    let res;
    if (id) {
      // Edit
      res = await fetch(`${API_BASE}/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, sku, category, price, totalStock, image })
      });
    } else {
      // Create
      res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, sku, category, price, totalStock, image })
      });
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast('Product saved successfully!', 'success');
    closeModal('modal-product');
    await loadProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDeleteProduct(id) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  try {
    const res = await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('Product deleted', 'success');
    await loadProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ORDERS & LIFECYCLE
function renderOrders(filterStatus = 'ALL') {
  const container = document.getElementById('orders-list-grid');
  let filtered = state.orders;
  if (filterStatus && filterStatus !== 'ALL') {
    filtered = filtered.filter(o => o.status === filterStatus);
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-dim);">No orders found for this filter.</div>`;
    return;
  }

  container.innerHTML = filtered.map(order => {
    let badgeClass = 'badge-info';
    if (order.status === 'PAID') badgeClass = 'badge-success';
    if (order.status === 'RESERVED') badgeClass = 'badge-warning';
    if (order.status === 'CANCELLED' || order.status === 'FAILED') badgeClass = 'badge-danger';
    if (order.status === 'EXPIRED') badgeClass = 'badge-purple';

    const canCancel = order.status === 'PAID' || order.status === 'RESERVED';

    return `
      <div class="order-card">
        <div class="order-card-header">
          <span class="order-card-id">${order.id}</span>
          <span class="badge ${badgeClass}">${order.status}</span>
        </div>
        <div style="font-size:0.85rem;">
          <div><strong>Customer:</strong> ${order.customerName}</div>
          <div><strong>Date:</strong> ${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
          <div><strong>Total:</strong> $${order.totalAmount.toFixed(2)}</div>
        </div>
        <div class="order-items-list">
          ${order.items.map(i => `<div>&bull; ${i.name} &times; ${i.quantity} ($${i.lineTotal.toFixed(2)})</div>`).join('')}
        </div>
        ${canCancel ? `
          <button class="btn btn-outline text-danger" style="margin-top:auto;font-size:0.8rem;padding:0.4rem;" onclick="handleCancelOrder('${order.id}')">
            <i class="fa-solid fa-ban"></i> Cancel Order &amp; Restore Stock
          </button>
        ` : ''}
      </div>
    `;
  }).join('');
}

async function handleCancelOrder(orderId) {
  if (!confirm(`Cancel order ${orderId} and restore inventory stock?`)) return;
  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Cashier manual cancellation' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast(`Order ${orderId} cancelled and stock restored.`, 'success');
    await loadProducts();
    await loadOrders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// CONCURRENCY STRESS LAB
function updateStressProductOptions() {
  const select = document.getElementById('stress-product-select');
  select.innerHTML = state.products.map(p => `
    <option value="${p.id}" ${p.id === 'prod-005' ? 'selected' : ''}>
      ${p.name} (Total: ${p.totalStock}, Available: ${p.availableStock})
    </option>
  `).join('');
  updateStressProductPreview();
}

function updateStressProductPreview() {
  const select = document.getElementById('stress-product-select');
  const preview = document.getElementById('stress-product-preview');
  const p = state.products.find(item => item.id === select.value);
  if (!p) return;
  preview.innerHTML = `
    Target Product: <strong>${p.name}</strong><br>
    Total Stock: <strong>${p.totalStock}</strong> | Reserved: <strong>${p.reservedStock || 0}</strong> | Available: <strong>${p.availableStock}</strong>
  `;
}

function setConcurrentReq(num) {
  document.getElementById('stress-req-count').value = num;
  document.querySelectorAll('.btn-num').forEach(b => {
    b.classList.toggle('active', parseInt(b.innerText, 10) === num);
  });
}

async function runStressTest() {
  const productId = document.getElementById('stress-product-select').value;
  const count = parseInt(document.getElementById('stress-req-count').value, 10) || 20;

  const btn = document.getElementById('btn-run-stress-test');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running Concurrent Dispatches...';

  const resultsPanel = document.getElementById('stress-results-panel');
  resultsPanel.classList.remove('hidden');

  try {
    const res = await fetch(`${API_BASE}/stress-test/concurrency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId,
        concurrentRequests: count,
        requestedQuantityPerOrder: 1
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const s = data.summary;
    document.getElementById('metric-total').innerText = s.totalRequests;
    document.getElementById('metric-success').innerText = s.successfulReservations;
    document.getElementById('metric-rejected').innerText = s.rejectedDueToStock;
    document.getElementById('metric-time').innerText = `${s.executionDurationMs}ms`;
    document.getElementById('metric-oversold').innerText = s.oversoldOccurred ? 'CRITICAL ERROR' : 'ZERO OVERSELLING (Verified)';

    // Logs stream
    const logsStream = document.getElementById('stress-logs-stream');
    logsStream.innerHTML = data.results.map(r => `
      <div class="log-entry ${r.status === 'SUCCESS' ? 'log-success' : 'log-rejected'}">
        <span>[Req #${r.requestIndex.toString().padStart(2, '0')}]</span>
        <span>HTTP ${r.statusCode}</span>
        <span>${r.status === 'SUCCESS' ? `&check; ${r.orderId} RESERVED` : `&cross; ${r.error}`}</span>
      </div>
    `).join('');

    showToast(`Benchmark complete! ${s.successfulReservations} locked, ${s.rejectedDueToStock} rejected without overselling.`, 'success');
    await loadProducts();
    await loadOrders();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Launch Concurrency Stress Test';
  }
}

// RESET DB
async function handleResetDB() {
  if (!confirm('Reset database to default seed products and clear all active orders?')) return;
  try {
    const res = await fetch(`${API_BASE}/products/admin/reset`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Database successfully reset to seed products!', 'success');
      cancelActiveReservationTimer();
      clearCart();
      await loadProducts();
      await loadOrders();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// MODAL UTILS
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// TOAST UTILS
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-exclamation';
  if (type === 'warning') icon = 'fa-triangle-exclamation';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
