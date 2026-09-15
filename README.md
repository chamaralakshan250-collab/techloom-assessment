Techloom.ai &mdash; Software Engineer Intern Practical Assessment

This repository contains the complete, production-ready implementation for **both sections** of the **Techloom.ai Software Engineer Intern Assessment**:

- **Section 01 (`/task-01`)**: POS Order & Inventory System (Concurrency-Safe Order Processing)
- **Section 02 (`/task-02`)**: E-Commerce Storefront, Checkout & Payment System

---

## 🔗 Live Deployment & Repository Links

- **Public GitHub Repository**: `https://github.com/chamaralakshan250-collab/techloom-assessment`
- **Task 01 Live POS App**: `https://techloom-assessment-sand.vercel.app`
- **Task 02 Live Storefront**: `https://techloom-task-02-nine.vercel.app`

---

 Repository Structure

```tree
.
├── Techloom_Intern_Assessment.pdf   # Original Assessment Document
├── package.json                     # Root orchestrator package.json
├── README.md                        # Master documentation & guide
│
├── task-01/                         # Section 01: Concurrency-Safe POS System
│   ├── src/
│   │   ├── server.js                # Express API Server (Port 5001)
│   │   ├── db/                      # ACID Transactional Database Engine
│   │   ├── services/                # Product, Order, Payment & Auto-Expiry Worker
│   │   └── routes/                  # REST API & Concurrency Stress Lab Endpoints
│   ├── public/                      # Modern Interactive POS Cashier Dashboard UI
│   ├── tests/                       # Concurrency, 5-min timeout & Idempotency test suites
│   ├── package.json
│   └── README.md                    # Detailed Task 01 Documentation
│
└── task-02/                         # Section 02: E-Commerce Storefront & Payment System
    ├── src/
    │   ├── server.js                # Express Storefront Server (Port 5002)
    │   ├── db/                      # ACID Catalog & Orders Database Engine
    │   ├── services/                # Search/Filter, Checkout, Payment Gateway & Refunds
    │   └── routes/                  # Product Discovery, Cart, Checkout & Order History APIs
    ├── public/                      # Luxury E-Commerce Storefront UI
    ├── tests/                       # End-to-End full checkout & refund test suite
    ├── package.json
    └── README.md                    # Detailed Task 02 Documentation
```

---

Architecture & Concurrency Strategy

### How Concurrency Safety & Zero Overselling is Achieved
1. **Critical Section Serialization**: Read-modify-write operations for inventory are guarded by thread-safe mutex transaction locks.
2. **Atomic Stock Reservation**:
   - `availableStock = totalStock - reservedStock`
   - When users enter checkout, the requested quantities are atomically moved into `reservedStock` with a 5-minute Time-To-Live (`expiresAt`).
   - If stock is insufficient, subsequent requests immediately receive `409 Conflict (OUT_OF_STOCK)` without corrupting state or overselling.
3. **5-Minute Auto-Expiry Background Worker**:
   - Active background sweeper (runs every 10s) and on-demand triggers release expired reservations back to available stock.
4. **Idempotency Defense**:
   - Payments enforce `Idempotency-Key` headers to detect and reject duplicate submissions or duplicate charges.
5. **Simulated Payment Gateway & State Machine**:
   - Distinct outcomes:
     - `SUCCESS`: Confirms order (`PAID`), permanently commits inventory.
     - `FAILURE`: Marks order `FAILED`, unlocks reserved stock.
     - `TIMEOUT`: Marks order `EXPIRED`, restores stock to available pool.
   - Post-purchase cancellation with automated refund simulation and stock restitution.

---

Quick Start & Local Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [npm](https://www.npmjs.com/) (v9.0.0 or higher)

### 1. Clone Repository
```bash
git clone https://github.com/YOUR_USERNAME/techloom-intern-assessment.git
cd techloom-intern-assessment
```

### 2. Run Task 01 (POS System)
```bash
cd task-01
npm install
npm start
```
Open POS Dashboard: **`http://localhost:5001`**

### 3. Run Task 02 (E-Commerce Storefront)
```bash
cd task-02
npm install
npm start
```
Open Storefront: **`http://localhost:5002`**

---

## 🧪 Running Automated Test Suites

### Task 01 Test Suites
```bash
cd task-01

# Run 50 parallel asynchronous requests against a 5-stock item (verifies 0 overselling)
npm run test:concurrency

# Verify 5-minute stock reservation auto-expiry & restoration
npm run test:timeout

# Verify payment idempotency & duplicate submission rejection
npm run test:idempotency

# Run all Task 01 tests
npm test
```

### Task 02 Test Suite
```bash
cd task-02

# Run full end-to-end checkout, payment simulation, and refund tests
npm test
```

---

 Live Deployment Instructions

Both Task 01 and Task 02 are designed with **zero-config standalone portability** and can be deployed directly to free-tier cloud platforms such as **Render**, **Railway**, or **Fly.io**:

### Deploying to Render:
1. Create a **New Web Service** connected to your GitHub repository.
2. **For Task 01**:
   - **Root Directory**: `task-01`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variable**: `PORT=5001`
3. **For Task 02**:
   - Create a second **Web Service** with **Root Directory**: `task-02`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variable**: `PORT=5002`

---

 Candidate Notes & Summary

- Both systems were architected from the ground up with clean modular services, separation of concerns, transaction isolation, and rich modern interactive user interfaces.
- The built-in **Concurrency Stress Lab** in Task 01 allows evaluators to visually trigger and inspect parallel request dispatches in real-time right from their browser.
- All requirements outlined in the Techloom assessment brief have been implemented and verified with automated test suites.
