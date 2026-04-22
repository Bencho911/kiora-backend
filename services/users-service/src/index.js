require('./config/env');  // Valida variables de entorno antes de arrancar
const app = require('./app');
const logger = require('./config/logger');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    logger.info(`Users Service ejecutándose en el puerto ${PORT}`);
});