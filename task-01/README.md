# 🏪 Task 01: Concurrency-Safe POS Order & Inventory System

An enterprise-grade Point-of-Sale (POS) backend and interactive cashier dashboard built for **high-concurrency environments**, featuring **ACID-compliant atomic inventory management**, **5-minute stock reservation auto-expiry**, a **mock payment gateway simulator** with idempotency protection, and an interactive **live Concurrency Stress Lab**.

---

## 🚀 Key Features

### 1. 🛡️ Concurrency Safety & Zero Overselling
- **Critical Section Serialization**: Employs an ACID transactional engine with mutex locks ensuring atomic Read-Modify-Write operations.
- **Race Condition Prevention**: Prevents parallel requests from overselling limited inventory (e.g. 50 simultaneous users purchasing a product with 5 units in stock will result in exactly 5 successful orders and 45 cleanly rejected with `409 Conflict`).

### 2. ⏳ 5-Minute Stock Reservation & Auto-Expiry
- When a customer starts checkout, inventory is immediately moved from `availableStock` to `reservedStock` with a 5-minute Time-To-Live (`expiresAt`).
- An active background worker sweeps and restores expired reservations back to available stock.

### 3. 💳 Mock Payment Gateway & Idempotency
- **Distinct Gateway Simulation**:
  - `SUCCESS`: Confirms order (`PAID`), permanently deducts inventory.
  - `FAILURE`: Marks order `FAILED`, immediately restores reserved stock.
  - `TIMEOUT`: Marks order `EXPIRED`, restores stock to inventory.
- **Duplicate Submission Defense**: Enforces `Idempotency-Key` headers to detect and reject duplicate payment attempts for the same transaction.

### 4. 🔄 Complete Order Lifecycle State Machine
- Strict status transitions: `PENDING` &rarr; `RESERVED` &rarr; `PAID` / `CANCELLED` / `EXPIRED` / `FAILED`.
- Full post-purchase order cancellation with stock reversal.

### 5. ⚡ Interactive Concurrency Stress Lab
- Built-in UI tab and CLI test suite allowing evaluators to fire 10, 25, 50, or 100 simultaneous async requests in real-time to observe zero overselling.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: ACID Transactional Store with Mutex Locks & JSON Snapshot Persistence
- **Frontend**: Responsive Single-Page POS Dashboard (Modern Vanilla CSS & JS, Glassmorphic UI)
- **Testing**: Built-in automated concurrency and idempotency test suites

---

## 📋 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/products` | List all products with real-time stock levels (`totalStock`, `reservedStock`, `availableStock`) |
| `GET` | `/api/products/:id` | Get details for a single product |
| `POST` | `/api/products` | Create a new product in inventory |
| `PUT` | `/api/products/:id` | Update product details or total stock |
| `DELETE` | `/api/products/:id` | Delete product (if no active reservations) |
| `POST` | `/api/products/admin/reset` | Reset database to initial seed catalog |
| `GET` | `/api/orders` | List all orders with line items & status |
| `POST` | `/api/orders/reserve` | Concurrency-safe checkout: atomically reserves stock for 5 minutes |
| `POST` | `/api/orders/:id/cancel` | Cancel order and restore stock |
| `POST` | `/api/payments/process` | Process payment with `Idempotency-Key` and outcome simulation |
| `POST` | `/api/stress-test/concurrency`| Dispatch N parallel requests to benchmark concurrency |
| `GET` | `/api/health` | System health status |

---

## 🏃 Getting Started Locally

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Installation
```bash
cd task-01
npm install
```

### Running the Application
```bash
npm start
```
- Access the POS Dashboard: `http://localhost:5001`
- API Health Check: `http://localhost:5001/api/health`

---

## 🧪 Running Automated Tests

Run all tests:
```bash
npm test
```

Or run specific test suites:
```bash
# 1. Test 50 concurrent requests against a 5-stock item (proves zero overselling)
npm run test:concurrency

# 2. Test 5-minute stock reservation auto-expiry & restoration
npm run test:timeout

# 3. Test payment gateway idempotency and duplicate request rejection
npm run test:idempotency
```

---

## 🚢 Deployment Guide

This project is fully self-contained and zero-config:

### Deploy to Render / Railway / Fly.io:
1. Connect your GitHub repository.
2. Set Root Directory to `task-01`.
3. Set Build Command: `npm install`
4. Set Start Command: `npm start`
5. Set Environment Variable: `PORT=5001` (or let provider assign default).
