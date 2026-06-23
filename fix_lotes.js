const { Client } = require('pg');

async function fixLotes() {
  console.log('Sincronizando lotes con el stock físico de cada producto...');
  
  // Usar los nombres de host de la red de docker si se corre desde adentro
  const productsClient = new Client({ connectionString: 'postgres://postgres:rootpassword@products-db:5432/kiora_products' });
  const inventoryClient = new Client({ connectionString: 'postgres://postgres:rootpassword@inventory-db:5432/kiora_inventory' });

  await productsClient.connect();
  await inventoryClient.connect();

  try {
    console.log('1. Borrando lotes inconsistentes creados por el seed anterior...');
    await inventoryClient.query("DELETE FROM lotes WHERE numero_lote LIKE 'LOTE-SEED-%'");
    
    console.log('2. Obteniendo stock real de los productos...');
    const prodRes = await productsClient.query('SELECT cod_prod, stock_actual, nom_prod FROM producto WHERE activo = true');
    const productos = prodRes.rows;

    let lotesCreados = 0;
    
    for (const prod of productos) {
        if (prod.stock_actual > 0) {
            const dIngreso = new Date();
            dIngreso.setDate(dIngreso.getDate() - Math.floor(Math.random() * 10)); // ingresó hace unos días
            
            const dVencimiento = new Date();
            // vencimiento entre 1 y 6 meses en el futuro
            dVencimiento.setDate(dVencimiento.getDate() + Math.floor(Math.random() * 150) + 30);

            await inventoryClient.query(
              `INSERT INTO lotes (cod_prod, numero_lote, fecha_vencimiento, cantidad_inicial, cantidad_actual, fecha_ingreso, estado)
               VALUES ($1, $2, $3, $4, $4, $5, 'ACTIVO')`,
              [prod.cod_prod, `LOTE-CORRECTO-${Date.now()}-${prod.cod_prod}`, dVencimiento, prod.stock_actual, dIngreso]
            );
            lotesCreados++;
        }
    }
    console.log(`¡Sincronización completa! Se crearon ${lotesCreados} lotes válidos.`);
  } catch (error) {
    console.error('Error sincronizando lotes:', error);
  } finally {
    await productsClient.end();
    await inventoryClient.end();
  }
}

fixLotes();
