const db = require('./src/config/db');
db.query("ALTER TABLE Ventas DROP CONSTRAINT IF EXISTS ventas_estado_check; ALTER TABLE Ventas DROP CONSTRAINT IF EXISTS chk_estado; ALTER TABLE Ventas ADD CONSTRAINT ventas_estado_check CHECK (estado IN ('pendiente', 'completada', 'cancelada', 'reembolsada'))")
  .then(() => { console.log('success'); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
