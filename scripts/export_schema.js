const fs = require('fs');
const path = require('path');

const services = ['users-service', 'products-service', 'inventory-service', 'orders-service'];
const outDir = path.join(__dirname, '../docs/chartdb_exports');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

services.forEach(svc => {
  const migrationsDir = path.join(__dirname, `../services/${svc}/src/db/migrations`);
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let merged = `-- Schema export for ${svc}\n\n`;
  files.forEach(f => {
    merged += fs.readFileSync(path.join(migrationsDir, f), 'utf-8') + '\n\n';
  });

  fs.writeFileSync(path.join(outDir, `${svc}_schema.sql`), merged);
});

console.log('Schemas exported to docs/chartdb_exports');