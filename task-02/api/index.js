const { app } = require('../src/server');
const { seedStorefront } = require('../src/db/seed');

let seeded = false;

module.exports = async (req, res) => {
  if (!seeded) {
    try {
      await seedStorefront();
    } catch (err) {
      console.error('Storefront database seed error on Vercel initialization:', err);
    }
    seeded = true;
  }
  return app(req, res);
};
