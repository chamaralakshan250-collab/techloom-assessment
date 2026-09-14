const { app } = require('../task-01/src/server');
const { seedDatabase } = require('../task-01/src/db/seed');

let seeded = false;

module.exports = async (req, res) => {
  if (!seeded) {
    try {
      await seedDatabase();
    } catch (err) {
      console.error('Database seed error on Vercel initialization:', err);
    }
    seeded = true;
  }
  return app(req, res);
};
