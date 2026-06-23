const { Client } = require('pg');

async function seedMovimientos() {
  const inventoryClient = new Client({ connectionString: 'postgres://postgres:rootpassword@inventory-db:5432/kiora_inventory' });

  try {
    await inventoryClient.connect();
    
    // Obtener todos los lotes actuales que no tienen un movimiento asociado
    const lotesRes = await inventoryClient.query(`
      SELECT l.id, l.cantidad_inicial, l.fecha_ingreso 
      FROM lotes l
      LEFT JOIN movimientos_lote ml ON ml.lote_id = l.id
      WHERE ml.id IS NULL
    `);
    
    const lotesSinMovimiento = lotesRes.rows;
    let creados = 0;

    for (const lote of lotesSinMovimiento) {
      await inventoryClient.query(
        `INSERT INTO movimientos_lote (lote_id, tipo_mov, cantidad, fecha_mov, desc_mov)
         VALUES ($1, 'entrada', $2, $3, 'Ajuste inicial de inventario')`,
        [lote.id, lote.cantidad_inicial, lote.fecha_ingreso]
      );
      creados++;
    }

    console.log(`¡Historial actualizado! Se añadieron ${creados} movimientos de entrada.`);
  } catch (error) {
    console.error('Error insertando movimientos:', error);
  } finally {
    await inventoryClient.end();
  }
}

seedMovimientos();
