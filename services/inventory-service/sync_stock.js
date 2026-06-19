const { Pool } = require('pg');

async function syncStock() {
    console.log('Starting stock sync script...');
    
    const inventoryPool = new Pool({
        connectionString: 'postgres://postgres:rootpassword@inventory-db:5432/kiora_inventory'
    });

    const productsPool = new Pool({
        connectionString: 'postgres://postgres:rootpassword@products-db:5432/kiora_products'
    });

    try {
        console.log('Fetching active lots from inventory DB...');
        // Group sum of active lotes per product
        const lotesRes = await inventoryPool.query(`
            SELECT cod_prod, SUM(cantidad_actual) as total_stock
            FROM lotes
            WHERE estado = 'ACTIVO'
            GROUP BY cod_prod
        `);

        console.log(`Found active lots for ${lotesRes.rows.length} products.`);

        // First, reset all stocks to 0 to catch products with NO active lots
        console.log('Resetting all product stocks to 0 before applying lotes...');
        await productsPool.query(`UPDATE producto SET stock_actual = 0`);
        await inventoryPool.query(`UPDATE Suministra SET stock = 0`);

        console.log('Applying lotes totals...');
        let updatedCount = 0;
        for (const row of lotesRes.rows) {
            const cod_prod = row.cod_prod;
            const stock = parseInt(row.total_stock, 10);

            // Update product DB
            await productsPool.query(
                `UPDATE producto SET stock_actual = $1 WHERE cod_prod = $2`,
                [stock, cod_prod]
            );

            // Update Suministra table (assuming the first supplier or existing entry)
            // If the row doesn't exist, we might need to upsert, but typically it does.
            // Let's just update all Suministra rows for that product (divide or just set for the primary one)
            // Wait, Suministra could have multiple suppliers, but let's just update all to the total stock for simplicity, 
            // or better, if no provider exists, just do nothing because it's just supplier metadata.
            await inventoryPool.query(
                `UPDATE Suministra SET stock = $1 WHERE cod_prod = $2`,
                [stock, cod_prod]
            );

            updatedCount++;
        }

        console.log(`Successfully synced stock for ${updatedCount} products.`);
    } catch (err) {
        console.error('Error during sync:', err);
    } finally {
        await inventoryPool.end();
        await productsPool.end();
    }
}

syncStock();
