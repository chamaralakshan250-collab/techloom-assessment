# 🛍️ Task 02: E-Commerce Storefront, Checkout & Payment System

An end-to-end luxury e-commerce storefront and payment processing platform featuring **live catalog search and multi-criteria filtering**, **concurrency-safe cart stock reservation (5-minute TTL)**, **mock payment gateway simulation** (Success, Failure, Timeout, Duplicate detection), and **post-purchase order lifecycle management with instant refund simulation**.

---

## 🚀 Key Features

### 1. 🔍 Product Discovery & Rich Catalog
- **Live Search**: Instant real-time multi-field search across product title, SKU, category, and description.
- **Dynamic Filtering**: Filter by category (`Audio`, `Wearables`, `Peripherals`, `Photography`, `Accessories`), maximum price range slider ($30 - $600), and `In Stock Only` toggle.
- **Sorting**: Sort by Featured, Price (Low &rarr; High, High &rarr; Low), Customer Rating, and Newest.
- **Product Details View**: Rich modal showcasing specifications, feature bullet points, rating, review count, and live inventory count.

### 2. 🛒 Shopping Bag & Concurrency-Safe Stock Reservation
- Sliding bag drawer with quantity adjustment and dynamic free shipping progress meter (orders over $150).
- Moment the customer clicks **"Proceed to Checkout"**, items are reserved atomically with a 5-minute countdown timer (`expiresAt`).
- Background worker sweeps and releases expired reservations immediately.

### 3. 💳 Mock Payment Gateway Simulator & Idempotency
- **Interactive Gateway Testing**:
  - `🟢 Success`: Captures payment, confirms order (`PAID`), permanently deducts inventory.
  - `🔴 Card Declined (Failure)`: Marks order `FAILED`, releases reserved stock back to store.
  - `🟡 Gateway Timeout`: Simulates network stall, marks `EXPIRED`, restores stock.
  - `🔄 Duplicate Submission Test`: Dispatches concurrent duplicate requests with the same `Idempotency-Key` to verify 100% duplicate protection (`409 Conflict`).

### 4. 📜 Order History, Cancellation & Simulated Refunds
- Query past orders by customer email.
- Real-time status badges (`PAID`, `RESERVED`, `REFUNDED`, `CANCELLED`, `EXPIRED`, `FAILED`).
- **One-Click Cancellation & Refund**: For paid orders, simulates a refund transaction (`REF-...`) and automatically restores inventory.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: ACID Transactional Store with Mutex Locks & JSON Snapshot Persistence
- **Frontend**: High-End Luxury Storefront (Vanilla CSS with Glassmorphism, Google Fonts, Font Awesome, Responsive Grid)
- **Testing**: End-to-end automated integration suite

---

## 📋 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/products` | Search & filter products (`?search=`, `category=`, `maxPrice=`, `inStockOnly=`, `sortBy=`) |
| `GET` | `/api/products/:id` | Get full product specs & details |
| `GET` | `/api/categories` | List all product categories |
| `POST` | `/api/checkout/reserve` | Concurrency-safe cart checkout & 5-minute stock reservation |
| `POST` | `/api/payments/process` | Process payment with `Idempotency-Key` and simulated outcomes |
| `POST` | `/api/payments/refund` | Issue simulated refund for paid order |
| `GET` | `/api/orders` | Get order history (`?email=`) |
| `POST` | `/api/orders/:id/cancel` | Cancel reservation or refund paid order |
| `POST` | `/api/store/reset` | Reset store catalog to default seed state |
| `GET` | `/api/health` | Service health status |

---

## 🏃 Getting Started Locally

```bash
cd task-02
npm install
npm start
```

- Open Storefront: `http://localhost:5002`
- Healthcheck: `http://localhost:5002/api/health`

---

## 🧪 Running Automated E2E Tests

```bash
npm test
```
*Executes full flow: Product Search &rarr; Stock Reservation &rarr; Idempotency Check &rarr; Payment Capture &rarr; Order History &rarr; Order Cancellation & Refund Stock Reversal.*

---

## 🚢 Live Deployment

Ready for zero-config deployment on **Render**, **Railway**, **Vercel**, or **Fly.io**:
- Build Command: `npm install`
- Start Command: `npm start`
- Port: Set `PORT=5002` or use environment default.
