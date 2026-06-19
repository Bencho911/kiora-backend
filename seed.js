const { Client } = require('pg');

async function seed() {
  console.log('Iniciando script de seeding...');

  // Database connections inside the docker network
  const productsClient = new Client({ connectionString: 'postgres://postgres:rootpassword@products-db:5432/kiora_products' });
  const inventoryClient = new Client({ connectionString: 'postgres://postgres:rootpassword@inventory-db:5432/kiora_inventory' });
  const ordersClient = new Client({ connectionString: 'postgres://postgres:rootpassword@orders-db:5432/kiora_orders' });

  await productsClient.connect();
  await inventoryClient.connect();
  await ordersClient.connect();

  try {
    console.log('1. Obteniendo productos existentes...');
    const prodRes = await productsClient.query('SELECT cod_prod, nom_prod, precio_unitario FROM producto WHERE activo = true');
    const productos = prodRes.rows;

    if (productos.length === 0) {
      console.log('No hay productos en la base de datos.');
      return;
    }

    console.log(`Encontrados ${productos.length} productos.`);

    // Crear 10 Sesiones en los últimos 7 días
    console.log('2. Generando 10 sesiones de caja cerradas...');
    const sessionIds = [];
    for (let i = 9; i >= 0; i--) {
      // Fecha apertura: i días atrás a las 08:00
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(8, Math.floor(Math.random() * 30), 0, 0);

      const dCierre = new Date(d);
      dCierre.setHours(18, Math.floor(Math.random() * 30), 0, 0);

      const resSesion = await ordersClient.query(
        `INSERT INTO sesion_caja (hora_apertura, hora_cierre, estado, total_ventas, usuario_id) 
         VALUES ($1, $2, 'CERRADA', 0, 3) RETURNING id`,
        [d, dCierre]
      );
      sessionIds.push({ id: resSesion.rows[0].id, fecha: d, total: 0 });
    }

    // Generar 80 Ventas distribuidas en esas sesiones
    console.log('3. Generando 80 ventas y movimientos de salida...');
    for (let v = 0; v < 80; v++) {
      const session = sessionIds[Math.floor(Math.random() * sessionIds.length)];
      
      // Fecha venta dentro del turno
      const saleDate = new Date(session.fecha);
      saleDate.setHours(8 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 59));

      const numItems = Math.floor(Math.random() * 4) + 1;
      let montoFinal = 0;
      
      const ventaProds = [];

      for (let j = 0; j < numItems; j++) {
        const prod = productos[Math.floor(Math.random() * productos.length)];
        const cantidad = Math.floor(Math.random() * 3) + 1;
        const precio = Number(prod.precio_unitario);
        montoFinal += (precio * cantidad);

        ventaProds.push({ cod_prod: prod.cod_prod, nom_prod: prod.nom_prod, cantidad, precio });
      }

      const metodoPago = Math.random() > 0.3 ? 'EFECTIVO' : 'TARJETA';

      // Insertar Venta
      const resVenta = await ordersClient.query(
        `INSERT INTO ventas (fecha_vent, precio_prod_final, montofinal_vent, metodopago_usu, estado, sesion_id)
         VALUES ($1, $2, $3, $4, 'completada', $5) RETURNING id_vent`,
        [saleDate, montoFinal, montoFinal, metodoPago, session.id]
      );
      const idVenta = resVenta.rows[0].id_vent;

      // Insertar items de venta y movimientos de inventario
      for (const vp of ventaProds) {
        await ordersClient.query(
          `INSERT INTO producto_venta (fk_id_vent, cod_prod, cantidad, precio_unit, nom_prod, tax_status)
           VALUES ($1, $2, $3, $4, $5, '19')`,
          [idVenta, vp.cod_prod, vp.cantidad, vp.precio, vp.nom_prod]
        );

        // Movimiento de salida en inventario
        await inventoryClient.query(
          `INSERT INTO inventario (tipo_mov, fecha_mov, cantidad, cod_prod, desc_mov)
           VALUES ('salida', $1, $2, $3, 'Venta generada (Seed)')`,
          [saleDate, vp.cantidad, vp.cod_prod]
        );
        
        // No descontaré físicamente el lote para evitar desajustes en el kardex si ya no hay stock real,
        // pero sí crearé el movimiento para el historial.
      }

      session.total += montoFinal;
    }

    // Actualizar totales de sesión
    for (const s of sessionIds) {
      await ordersClient.query('UPDATE sesion_caja SET total_ventas = $1 WHERE id = $2', [s.total, s.id]);
    }

    // Insertar Lotes de Inventario para los productos para que salgan en la app
    console.log('4. Generando Lotes Aleatorios de entrada...');
    for (const prod of productos) {
      const numLotes = Math.floor(Math.random() * 2) + 1;
      for (let l = 0; l < numLotes; l++) {
        const dIngreso = new Date();
        dIngreso.setDate(dIngreso.getDate() - Math.floor(Math.random() * 30));

        const dVencimiento = new Date();
        // Generar un lote por vencer (20-30 días) o ya lejano
        dVencimiento.setDate(dVencimiento.getDate() + Math.floor(Math.random() * 60) + 5);

        const cantidadLote = Math.floor(Math.random() * 20) + 10;
        
        // Insert Lote
        await inventoryClient.query(
          `INSERT INTO lotes (cod_prod, numero_lote, fecha_vencimiento, cantidad_inicial, cantidad_actual, fecha_ingreso, estado)
           VALUES ($1, $2, $3, $4, $4, $5, 'ACTIVO')`,
          [prod.cod_prod, `LOTE-SEED-${Date.now()}-${l}`, dVencimiento, cantidadLote, dIngreso]
        );
      }
    }

    console.log('¡Seeding completado con éxito!');
  } catch (error) {
    console.error('Error durante el seeding:', error);
  } finally {
    await productsClient.end();
    await inventoryClient.end();
    await ordersClient.end();
  }
}

seed();
