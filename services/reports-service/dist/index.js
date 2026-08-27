"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: process.env.DOTENV_CONFIG_PATH || '.env.local' });
require("./config/env"); // Valida variables de entorno antes de arrancar
const app_js_1 = __importDefault(require("./app.js"));
const logger_js_1 = __importDefault(require("./config/logger.js"));
const port = process.env.PORT || 3006;
app_js_1.default.listen(port, () => {
    logger_js_1.default.info(`reports-service corriendo en el puerto ${port}`);
});
