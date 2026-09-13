const fs = require('fs');
const path = require('path');

class Mutex {
  constructor() {
    this._queue = [];
    this._locked = false;
  }

  lock() {
    return new Promise((resolve) => {
      if (!this._locked) {
        this._locked = true;
        resolve();
      } else {
        this._queue.push(resolve);
      }
    });
  }

  unlock() {
    if (this._queue.length > 0) {
      const nextResolve = this._queue.shift();
      nextResolve();
    } else {
      this._locked = false;
    }
  }

  async runExclusive(callback) {
    await this.lock();
    try {
      return await callback();
    } finally {
      this.unlock();
    }
  }
}

class TransactionalDatabase {
  constructor(filePath) {
    this.filePath = filePath;
    this.globalMutex = new Mutex();
    this.data = {
      products: [],
      orders: [],
      orderItems: [],
      payments: [],
      idempotencyKeys: {}
    };
    this.init();
  }

  init() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.data = JSON.parse(raw);
      } catch (err) {
        console.error('Error loading DB file, reinitializing:', err);
      }
    } else {
      this.save();
    }
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save DB to disk:', err);
    }
  }

  // Executes an isolated, atomic transaction with automatic rollback on error
  async transaction(fn) {
    return await this.globalMutex.runExclusive(async () => {
      // Deep clone snapshot for ACID rollback
      const snapshot = JSON.parse(JSON.stringify(this.data));
      try {
        const result = await fn(this.data);
        this.save();
        return result;
      } catch (err) {
        // Rollback state completely on failure
        this.data = snapshot;
        throw err;
      }
    });
  }

  // Read data safely
  async read(fn) {
    return await this.globalMutex.runExclusive(async () => {
      return fn(this.data);
    });
  }

  // Reset database with fresh data (used for testing and seeding)
  async reset(seedData) {
    return await this.globalMutex.runExclusive(async () => {
      this.data = {
        products: seedData.products || [],
        orders: seedData.orders || [],
        orderItems: seedData.orderItems || [],
        payments: seedData.payments || [],
        idempotencyKeys: {}
      };
      this.save();
      return this.data;
    });
  }
}

const dbPath = path.join(__dirname, '..', '..', 'data', 'pos_db.json');
const db = new TransactionalDatabase(dbPath);

module.exports = db;
