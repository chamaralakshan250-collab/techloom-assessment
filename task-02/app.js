// State
const storeState = {
  products: [],
  cart: [],
  orders: [],
  filters: {
    category: 'ALL',
    search: '',
    maxPrice: 600,
    inStockOnly: false,
    sortBy: 'featured'
  },
  activeReservation: null, // { orderId, expiresAt, totalAmount, idempotencyKey, timerInterval }
  currentCustomerEmail: 'alex.shopper@techloom.ai'
};

const API_BASE = '/api';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadCatalog();
  loadOrderHistory();
  loadCartFromStorage();
});

// Event Listeners
function initEventListeners() {
  // Search
  const searchInput = document.getElementById('store-search-input');
  const searchClear = document.getElementById('search-clear-btn');

  searchInput.addEventListener('input', (e) => {
    storeState.filters.search = e.target.value.trim();
    searchClear.classList.toggle('hidden', storeState.filters.search.length === 0);
    loadCatalog();
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    storeState.filters.search = '';
    searchClear.classList.add('hidden');
    loadCatalog();
  });

  // Category Radio
  document.querySelectorAll('#category-filter-group input[name="category"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.querySelectorAll('#category-filter-group .cat-radio-label').forEach(lbl => lbl.classList.remove('active'));
      e.target.closest('.cat-radio-label').classList.add('active');
      storeState.filters.category = e.target.value;
      loadCatalog();
    });
  });

  // Price Slider
  const priceSlider = document.getElementById('price-slider');
  const priceDisplay = document.getElementById('price-display-val');
  priceSlider.addEventListener('input', (e) => {
    storeState.filters.maxPrice = e.target.value;
    priceDisplay.innerText = `$${e.target.value}`;
    loadCatalog();
  });

  // In stock checkbox
  document.getElementById('instock-checkbox').addEventListener('change', (e) => {
    storeState.filters.inStockOnly = e.target.checked;
    loadCatalog();
  });

  // Sort By
  document.getElementById('sort-select').addEventListener('change', (e) => {
    storeState.filters.sortBy = e.target.value;
    loadCatalog();
  });

  // Reset Filters
  document.getElementById('btn-reset-filters').addEventListener('click', () => {
    storeState.filters = { category: 'ALL', search: '', maxPrice: 600, inStockOnly: false, sortBy: 'featured' };
    searchInput.value = '';
    priceSlider.value = 600;
    priceDisplay.innerText = '$600';
    document.getElementById('instock-checkbox').checked = false;
    document.getElementById('sort-select').value = 'featured';
    document.querySelectorAll('#category-filter-group .cat-radio-label').forEach((lbl, idx) => {
      lbl.classList.toggle('active', idx === 0);
    });
    loadCatalog();
  });

  // Cart Drawer
  document.getElementById('btn-open-cart').addEventListener('click', openCartDrawer);
  document.getElementById('btn-close-cart').addEventListener('click', closeCartDrawer);
  document.getElementById('btn-start-checkout').addEventListener('click', handleStartCheckout);

  // DB Seed Reset
  document.getElementById('btn-seed-reset').addEventListener('click', handleResetCatalogSeed);

  // Order Search
  document.getElementById('btn-search-orders').addEventListener('click', () => {
    const email = document.getElementById('order-search-email').value.trim();
    loadOrderHistory(email);
  });
}

// SWITCH VIEWS
function switchView(viewName) {
  document.querySelectorAll('.store-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  if (viewName === 'catalog') {
    document.getElementById('view-catalog').classList.add('active');
    document.getElementById('nav-btn-catalog').classList.add('active');
  } else if (viewName === 'orders') {
    document.getElementById('view-orders').classList.add('active');
    document.getElementById('nav-btn-orders').classList.add('active');
    loadOrderHistory();
  }
}

// LOAD CATALOG
async function loadCatalog() {
  try {
    const params = new URLSearchParams();
    if (storeState.filters.search) params.append('search', storeState.filters.search);
    if (storeState.filters.category !== 'ALL') params.append('category', storeState.filters.category);
    if (storeState.filters.maxPrice < 600) params.append('maxPrice', storeState.filters.maxPrice);
    if (storeState.filters.inStockOnly) params.append('inStockOnly', 'true');
    if (storeState.filters.sortBy) params.append('sortBy', storeState.filters.sortBy);

    const res = await fetch(`${API_BASE}/products?${params.toString()}`);
    const data = await res.json();

    if (data.success) {
      storeState.products = data.data;
      renderCatalogGrid();
      document.getElementById('catalog-count-display').innerText = `Showing ${data.count} premium product${data.count === 1 ? '' : 's'}`;
    }
  } catch (err) {
    showStoreToast('Failed to load products: ' + err.message, 'error');
  }
}

// RENDER CATALOG GRID
function renderCatalogGrid() {
  const grid = document.getElementById('store-products-grid');

  if (storeState.products.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem; color: var(--text-dim);">
        <i class="fa-solid fa-search" style="font-size: 2.5rem; margin-bottom: 1rem;"></i>
        <h3>No matching products found</h3>
        <p>Try adjusting your search criteria or price filter slider.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = storeState.products.map(p => {
    const avail = p.availableStock;
    let stockClass = 'in-stock';
    let stockText = `${avail} In Stock`;

    if (avail === 0) {
      stockClass = 'out-stock';
      stockText = 'Sold Out';
    } else if (avail <= 5) {
      stockClass = 'low-stock';
      stockText = `Only ${avail} left!`;
    }

    return `
      <div class="store-card">
        <div class="card-img-wrap" onclick="openProductQuickView('${p.id}')" style="cursor: pointer;">
          <img src="${p.image}" alt="${p.name}" loading="lazy">
          ${p.badge ? `<span class="badge-tag">${p.badge}</span>` : ''}
          <span class="stock-pill ${stockClass}">${stockText}</span>
        </div>
        <div class="card-body">
          <div class="card-cat">${p.category}</div>
          <h4 class="card-title" onclick="openProductQuickView('${p.id}')">${p.name}</h4>
          
          <div class="rating-row">
            <span><i class="fa-solid fa-star"></i> ${p.rating.toFixed(1)}</span>
            <span class="rating-count">(${p.reviewsCount} reviews)</span>
          </div>

          <div class="card-footer-row">
            <div class="price-box">
              <span class="price-main">$${p.price.toFixed(2)}</span>
              ${p.originalPrice ? `<span class="price-orig">$${p.originalPrice.toFixed(2)}</span>` : ''}
            </div>
            <button class="btn-card-add" onclick="addStoreToCart('${p.id}')" ${avail <= 0 ? 'disabled' : ''}>
              <i class="fa-solid fa-plus"></i> ${avail <= 0 ? 'Out of Stock' : 'Add to Bag'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// PRODUCT QUICKVIEW MODAL
async function openProductQuickView(productId) {
  try {
    const res = await fetch(`${API_BASE}/products/${productId}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const p = data.data;
    const modalContent = document.getElementById('product-modal-content');

    modalContent.innerHTML = `
      <div class="modal-img-box">
        <img src="${p.image}" alt="${p.name}">
      </div>
      <div>
        <span class="card-cat">${p.category} &middot; SKU: ${p.sku}</span>
        <h2 style="margin: 0.25rem 0 0.5rem; font-size: 1.4rem;">${p.name}</h2>
        
        <div class="rating-row" style="margin-bottom: 0.85rem;">
          <span><i class="fa-solid fa-star"></i> ${p.rating.toFixed(1)}</span>
          <span class="rating-count">(${p.reviewsCount} customer reviews)</span>
          <span class="badge ${p.availableStock > 0 ? 'badge-success' : 'badge-danger'}" style="margin-left: 0.5rem;">
            ${p.availableStock > 0 ? `${p.availableStock} Available` : 'Sold Out'}
          </span>
        </div>

        <p style="font-size: 0.9rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 1rem;">
          ${p.description}
        </p>

        <h4 style="font-size: 0.85rem; margin-bottom: 0.4rem; color: var(--text-main);">Key Highlights:</h4>
        <ul style="font-size: 0.8rem; color: var(--text-muted); margin-left: 1.25rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.25rem;">
          ${(p.features || []).map(f => `<li>${f}</li>`).join('')}
        </ul>

        <table class="modal-specs-table">
          <tbody>
            ${Object.entries(p.specs || {}).map(([k, v]) => `
              <tr>
                <td style="width: 40%;"><strong>${k}</strong></td>
                <td>${v}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
          <div>
            <span style="font-size: 1.5rem; font-weight: 800; color: #fff;">$${p.price.toFixed(2)}</span>
            ${p.originalPrice ? `<span style="font-size: 0.85rem; color: var(--text-dim); text-decoration: line-through; margin-left: 0.5rem;">$${p.originalPrice.toFixed(2)}</span>` : ''}
          </div>
          <button class="btn btn-primary btn-lg" onclick="addStoreToCart('${p.id}'); closeModal('modal-quickview'); openCartDrawer();" ${p.availableStock <= 0 ? 'disabled' : ''}>
            <i class="fa-solid fa-bag-shopping"></i> Add to Bag
          </button>
        </div>
      </div>
    `;

    openModal('modal-quickview');
  } catch (err) {
    showStoreToast('Failed to load product details: ' + err.message, 'error');
  }
}

// CART MANAGEMENT
function addStoreToCart(productId) {
  const product = storeState.products.find(p => p.id === productId);
  if (!product) return;

  const existing = storeState.cart.find(item => item.productId === productId);
  const currentQty = existing ? existing.quantity : 0;

  if (currentQty + 1 > product.availableStock) {
    showStoreToast(`Cannot exceed available stock of ${product.availableStock}`, 'warning');
    return;
  }

  if (existing) {
    existing.quantity += 1;
  } else {
    storeState.cart.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: 1
    });
  }

  saveCartToStorage();
  updateCartBadge();
  showStoreToast(`Added "${product.name}" to shopping bag!`, 'success');
}

function updateCartItemQty(productId, delta) {
  const item = storeState.cart.find(i => i.productId === productId);
  if (!item) return;

  const product = storeState.products.find(p => p.id === productId);
  const newQty = item.quantity + delta;

  if (newQty <= 0) {
    storeState.cart = storeState.cart.filter(i => i.productId !== productId);
  } else if (newQty > (product ? product.availableStock : 99)) {
    showStoreToast(`Cannot exceed available inventory (${product.availableStock})`, 'warning');
    return;
  } else {
    item.quantity = newQty;
  }

  saveCartToStorage();
  updateCartBadge();
  renderDrawerItems();
}

function saveCartToStorage() {
  localStorage.setItem('aether_cart', JSON.stringify(storeState.cart));
}

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem('aether_cart');
    if (raw) {
      storeState.cart = JSON.parse(raw);
    }
  } catch (e) {
    storeState.cart = [];
  }
  updateCartBadge();
}

function updateCartBadge() {
  const totalItems = storeState.cart.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = storeState.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  document.getElementById('nav-cart-count').innerText = totalItems;
  document.getElementById('nav-cart-total').innerText = `$${subtotal.toFixed(2)}`;
  document.getElementById('drawer-item-count').innerText = totalItems;
}

// CART DRAWER OPEN / CLOSE
function openCartDrawer() {
  renderDrawerItems();
  document.getElementById('cart-drawer-overlay').classList.remove('hidden');
}

function closeCartDrawer() {
  document.getElementById('cart-drawer-overlay').classList.add('hidden');
}

function renderDrawerItems() {
  const list = document.getElementById('drawer-items-container');
  const subtotalEl = document.getElementById('drawer-subtotal');
  const shippingEl = document.getElementById('drawer-shipping');
  const totalEl = document.getElementById('drawer-total');
  const btnCheckout = document.getElementById('btn-start-checkout');

  if (storeState.cart.length === 0) {
    list.innerHTML = `
      <div style="text-align:center; padding: 4rem 1rem; color: var(--text-dim);">
        <i class="fa-solid fa-bag-shopping" style="font-size: 2.5rem; margin-bottom: 0.85rem;"></i>
        <h4>Your shopping bag is empty</h4>
        <p style="font-size: 0.8rem; margin-top: 0.25rem;">Explore our catalog and add items to checkout.</p>
      </div>
    `;
    subtotalEl.innerText = '$0.00';
    shippingEl.innerText = '$0.00';
    totalEl.innerText = '$0.00';
    btnCheckout.disabled = true;
    updateShippingMeter(0);
    return;
  }

  let subtotal = 0;
  list.innerHTML = storeState.cart.map(item => {
    const line = item.price * item.quantity;
    subtotal += line;
    return `
      <div class="drawer-item-card">
        <img src="${item.image}" class="drawer-item-img" alt="${item.name}">
        <div class="drawer-item-info">
          <div class="drawer-item-title">${item.name}</div>
          <div class="drawer-item-price">$${item.price.toFixed(2)} &times; ${item.quantity} = $${line.toFixed(2)}</div>
          <div class="drawer-qty-ctrl">
            <button class="btn-qty-sm" onclick="updateCartItemQty('${item.productId}', -1)">-</button>
            <span style="font-size: 0.85rem; font-weight: 700; width: 22px; text-align: center;">${item.quantity}</span>
            <button class="btn-qty-sm" onclick="updateCartItemQty('${item.productId}', 1)">+</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const shipping = subtotal > 150 ? 0 : 9.99;
  const total = subtotal + shipping;

  subtotalEl.innerText = `$${subtotal.toFixed(2)}`;
  shippingEl.innerText = shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`;
  totalEl.innerText = `$${total.toFixed(2)}`;
  btnCheckout.disabled = false;

  updateShippingMeter(subtotal);
}

function updateShippingMeter(subtotal) {
  const threshold = 150;
  const fill = document.getElementById('shipping-meter-fill');
  const text = document.getElementById('shipping-meter-text');

  if (subtotal >= threshold) {
    fill.style.width = '100%';
    text.innerHTML = '<strong style="color:var(--accent-success);"><i class="fa-solid fa-truck-fast"></i> You qualified for FREE Worldwide Shipping!</strong>';
  } else {
    const remaining = threshold - subtotal;
    const pct = Math.min(100, (subtotal / threshold) * 100);
    fill.style.width = `${pct}%`;
    text.innerText = `Add $${remaining.toFixed(2)} more for Free Shipping!`;
  }
}

// CHECKOUT FLOW & STOCK RESERVATION
async function handleStartCheckout() {
  if (storeState.cart.length === 0) return;

  const email = document.getElementById('checkout-email').value.trim() || storeState.currentCustomerEmail;
  const name = document.getElementById('checkout-name').value.trim() || 'Alex Mercer';
  const address = document.getElementById('checkout-address').value.trim() || '742 Evergreen Terrace, Springfield';

  const items = storeState.cart.map(i => ({ productId: i.productId, quantity: i.quantity }));

  try {
    const res = await fetch(`${API_BASE}/checkout/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerEmail: email,
        customerName: name,
        shippingAddress: address,
        items
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reserve stock');

    const order = data.data;
    closeCartDrawer();

    // Populate checkout modal
    document.getElementById('checkout-order-badge').innerText = order.id;
    document.getElementById('co-subtotal').innerText = `$${order.subtotal.toFixed(2)}`;
    document.getElementById('co-shipping').innerText = order.shippingCost === 0 ? 'FREE' : `$${order.shippingCost.toFixed(2)}`;
    document.getElementById('co-total').innerText = `$${order.totalAmount.toFixed(2)}`;
    
    // Generate idempotency key for this session
    const idempKey = `STORE-TXN-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    document.getElementById('co-idemp-key').innerText = idempKey;

    startCheckoutTimer(order, idempKey);
    openModal('modal-checkout');

    await loadCatalog();
  } catch (err) {
    showStoreToast(err.message, 'error');
  }
}

function startCheckoutTimer(order, idempKey) {
  if (storeState.checkoutTimerInterval) clearInterval(storeState.checkoutTimerInterval);

  storeState.activeReservation = {
    orderId: order.id,
    order: order,
    idempotencyKey: idempKey,
    expiresAt: new Date(order.expiresAt).getTime()
  };

  const timerText = document.getElementById('checkout-timer-text');
  const progressBar = document.getElementById('checkout-progress-bar');
  const totalDuration = 5 * 60 * 1000;

  storeState.checkoutTimerInterval = setInterval(() => {
    const remaining = storeState.activeReservation.expiresAt - Date.now();

    if (remaining <= 0) {
      clearInterval(storeState.checkoutTimerInterval);
      closeModal('modal-checkout');
      showStoreToast('Checkout reservation expired (5 minutes). Stock unlocked.', 'warning');
      loadCatalog();
      return;
    }

    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    timerText.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    const pct = (remaining / totalDuration) * 100;
    progressBar.style.width = `${pct}%`;
  }, 1000);
}

// EXECUTE CHECKOUT PAYMENT (GATEWAY SIMULATION)
async function executeCheckoutPayment(outcome) {
  if (!storeState.activeReservation) return;
  const order = storeState.activeReservation.order;
  const idempotencyKey = storeState.activeReservation.idempotencyKey;

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
        paymentMethod: 'CREDIT_CARD'
      })
    });

    const data = await res.json();
    clearInterval(storeState.checkoutTimerInterval);
    closeModal('modal-checkout');

    if (!res.ok) {
      throw new Error(data.error || 'Payment gateway failed');
    }

    if (outcome === 'SUCCESS') {
      showReceiptModal(data.data.order, data.data.payment);
      storeState.cart = [];
      saveCartToStorage();
      updateCartBadge();
    } else if (outcome === 'FAILURE') {
      showStoreToast('Payment declined by card issuer. Reserved stock returned to inventory.', 'error');
    } else if (outcome === 'TIMEOUT') {
      showStoreToast('Payment gateway timeout. Reservation expired and stock restored.', 'warning');
    }

    await loadCatalog();
    await loadOrderHistory();
  } catch (err) {
    showStoreToast(err.message, 'error');
  }
}

// EXECUTE DUPLICATE PAYMENT TEST
async function executeDuplicateCheckoutPayment() {
  if (!storeState.activeReservation) return;
  const order = storeState.activeReservation.order;
  const idempotencyKey = storeState.activeReservation.idempotencyKey;

  showStoreToast('Simulating concurrent duplicate payment submission...', 'warning');

  // Fire 2 concurrent HTTP requests with same Idempotency-Key
  const req1 = fetch(`${API_BASE}/payments/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ orderId: order.id, simulateOutcome: 'SUCCESS' })
  });

  const req2 = fetch(`${API_BASE}/payments/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ orderId: order.id, simulateOutcome: 'SUCCESS' })
  });

  const [res1, res2] = await Promise.all([req1, req2]);
  clearInterval(storeState.checkoutTimerInterval);
  closeModal('modal-checkout');

  if ((res1.ok && res2.status === 409) || (res2.ok && res1.status === 409)) {
    showStoreToast('Idempotency Verified! Request 1 processed payment, Request 2 rejected (409 Conflict).', 'success');
  } else {
    showStoreToast(`Responses: Req1(${res1.status}), Req2(${res2.status})`, 'info');
  }

  storeState.cart = [];
  saveCartToStorage();
  updateCartBadge();
  await loadCatalog();
  await loadOrderHistory();
}

function showReceiptModal(order, payment) {
  const details = document.getElementById('receipt-details-box');
  details.innerHTML = `
    <div><strong>Order Number:</strong> <code>${order.id}</code></div>
    <div><strong>Transaction ID:</strong> <code>${payment.id}</code></div>
    <div><strong>Amount Paid:</strong> $${order.totalAmount.toFixed(2)}</div>
    <div><strong>Customer:</strong> ${order.customerName} (${order.customerEmail})</div>
    <div><strong>Items:</strong> ${order.items.map(i => `${i.name} &times; ${i.quantity}`).join(', ')}</div>
  `;
  openModal('modal-receipt');
}

// ORDER HISTORY & REFUNDS
async function loadOrderHistory(email) {
  try {
    const url = email ? `${API_BASE}/orders?email=${encodeURIComponent(email)}` : `${API_BASE}/orders`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.success) {
      storeState.orders = data.data;
      renderOrderHistory();
      if (data.count > 0) {
        document.getElementById('orders-has-badge').classList.remove('hidden');
      }
    }
  } catch (err) {
    console.error('Failed to load order history', err);
  }
}

function renderOrderHistory() {
  const container = document.getElementById('orders-timeline-container');

  if (storeState.orders.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 4rem 1rem; color: var(--text-dim); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
        <i class="fa-solid fa-box-open" style="font-size: 3rem; margin-bottom: 1rem;"></i>
        <h3>No past orders found</h3>
        <p>Complete a checkout from the catalog to view your order history here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = storeState.orders.map(order => {
    let badgeClass = 'badge-purple';
    if (order.status === 'PAID') badgeClass = 'badge-success';
    if (order.status === 'RESERVED') badgeClass = 'badge-warning';
    if (order.status === 'REFUNDED') badgeClass = 'badge-purple';
    if (order.status === 'CANCELLED' || order.status === 'FAILED') badgeClass = 'badge-danger';

    const isPaid = order.status === 'PAID';
    const isReserved = order.status === 'RESERVED';

    return `
      <div class="order-history-card">
        <div class="order-history-top">
          <div>
            <strong style="font-family: var(--font-mono); font-size: 0.95rem;">${order.id}</strong>
            <span class="badge ${badgeClass}" style="margin-left: 0.5rem;">${order.status}</span>
          </div>
          <div class="order-meta-info">
            <span><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString()} ${new Date(order.createdAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
            <span><strong>Total:</strong> $${order.totalAmount.toFixed(2)}</span>
            <span><strong>Customer:</strong> ${order.customerEmail}</span>
          </div>
        </div>

        <div class="order-history-items">
          ${order.items.map(item => `
            <div class="history-item-pill">
              <img src="${item.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100'}" alt="${item.name}">
              <div>
                <div style="font-weight: 700; font-size: 0.8rem;">${item.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-dim);">$${item.unitPrice.toFixed(2)} &times; ${item.quantity}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="order-history-footer">
          <div style="font-size: 0.75rem; color: var(--text-dim);">
            ${order.paymentId ? `Payment Txn: <code>${order.paymentId}</code> &middot; ` : ''}
            ${order.refundId ? `Refund ID: <code>${order.refundId}</code> &middot; ` : ''}
            Status: <strong>${order.status}</strong>
          </div>

          <div>
            ${isPaid ? `
              <button class="btn btn-outline" style="color: var(--accent-danger); font-size: 0.75rem; padding: 0.35rem 0.75rem;" onclick="handleCancelAndRefundOrder('${order.id}')">
                <i class="fa-solid fa-arrow-rotate-left"></i> Cancel &amp; Simulate Refund
              </button>
            ` : ''}
            ${isReserved ? `
              <button class="btn btn-outline" style="color: var(--accent-warning); font-size: 0.75rem; padding: 0.35rem 0.75rem;" onclick="handleCancelAndRefundOrder('${order.id}')">
                <i class="fa-solid fa-xmark"></i> Cancel Reservation
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function handleCancelAndRefundOrder(orderId) {
  if (!confirm(`Cancel order ${orderId} and issue simulated refund?`)) return;

  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Customer requested refund via Order History' })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showStoreToast(`Order ${orderId} cancelled. Simulated refund issued and stock restored!`, 'success');
    await loadOrderHistory();
    await loadCatalog();
  } catch (err) {
    showStoreToast(err.message, 'error');
  }
}

// RESET STOREFRONT CATALOG
async function handleResetCatalogSeed() {
  if (!confirm('Reset storefront catalog to default products and wipe active reservations?')) return;
  try {
    const res = await fetch(`${API_BASE}/store/reset`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showStoreToast('Catalog reset to initial seed state!', 'success');
      await loadCatalog();
      await loadOrderHistory();
    }
  } catch (err) {
    showStoreToast(err.message, 'error');
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
function showStoreToast(message, type = 'info') {
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
