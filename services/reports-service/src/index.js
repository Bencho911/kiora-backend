require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env.local' });
require('./config/env');  // Valida variables de entorno antes de arrancar
const app = require('./app');
const logger = require('./config/logger');

const port = process.env.PORT || 3006;

app.listen(port, () => {
    logger.info(`reports-service corriendo en el puerto ${port}`);
});
