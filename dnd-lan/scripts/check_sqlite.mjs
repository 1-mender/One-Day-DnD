import { getDb, DB_PATH } from '../server/src/db.js';

try {
  console.log('DB_PATH=', DB_PATH);
  const db = getDb();
  console.log('Opened DB successfully');
  const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log('Tables:', rows.map(r=>r.name).join(', '));
  const migration = db.prepare('SELECT version, name FROM schema_migrations ORDER BY version').all();
  console.log('Migrations applied:', migration.map(m=>`${m.version}:${m.name}`).join(', '));
  process.exit(0);
} catch (err) {
  console.error('Error opening DB:', err && err.stack ? err.stack : err);
  process.exit(2);
}
