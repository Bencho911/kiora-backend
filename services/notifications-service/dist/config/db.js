'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const env_js_1 = __importDefault(require("./env.js"));
const logger_js_1 = __importDefault(require("./logger.js"));
const pool = new pg_1.Pool({
    user: env_js_1.default.db.user,
    host: env_js_1.default.db.host,
    database: env_js_1.default.db.name,
    password: env_js_1.default.db.password,
    port: env_js_1.default.db.port,
});
pool.on('error', (err) => {
    logger_js_1.default.error('err', { error: err.message });
    process.exit(-1);
});
exports.default = {
    query: (text, params) => pool.query(text, params),
    pool,
};
