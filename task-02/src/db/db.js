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

class StorefrontDatabase {
  constructor(filePath) {
    this.filePath = filePath;
    this.globalMutex = new Mutex();
    this.data = {
      products: [],
      orders: [],
      payments: [],
      refunds: [],
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
        console.error('Error loading Storefront DB:', err);
      }
    }
    if (!this.data.products || this.data.products.length === 0) {
      try {
        const initialCatalog = require('./initialCatalog');
        this.data.products = JSON.parse(JSON.stringify(initialCatalog));
      } catch (err) {
        console.error('Error loading initial catalog:', err);
      }
    }
    this.save();
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save Storefront DB to disk:', err);
    }
  }

  async transaction(fn) {
    return await this.globalMutex.runExclusive(async () => {
      const snapshot = JSON.parse(JSON.stringify(this.data));
      try {
        const result = await fn(this.data);
        this.save();
        return result;
      } catch (err) {
        this.data = snapshot;
        throw err;
      }
    });
  }

  async read(fn) {
    return await this.globalMutex.runExclusive(async () => {
      return fn(this.data);
    });
  }

  async reset(seedData) {
    return await this.globalMutex.runExclusive(async () => {
      this.data = {
        products: seedData.products || [],
        orders: seedData.orders || [],
        payments: seedData.payments || [],
        refunds: seedData.refunds || [],
        idempotencyKeys: {}
      };
      this.save();
      return this.data;
    });
  }
}

const dbPath = process.env.VERCEL
  ? path.join('/tmp', 'store_db.json')
  : (process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'store_db.json'));
const db = new StorefrontDatabase(dbPath);

module.exports = db;
