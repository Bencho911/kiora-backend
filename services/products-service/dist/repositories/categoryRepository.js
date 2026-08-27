"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.remove = exports.update = exports.create = exports.findById = exports.countAll = exports.findAll = void 0;
const db_1 = __importDefault(require("../config/db"));
const findAll = ({ limit = 100, offset = 0 } = {}) => db_1.default.query('SELECT * FROM Categoria WHERE activo = true ORDER BY cod_cat LIMIT $1 OFFSET $2', [limit, offset]);
exports.findAll = findAll;
const countAll = () => db_1.default.query('SELECT COUNT(*) FROM Categoria WHERE activo = true');
exports.countAll = countAll;
const findById = (cod_cat) => db_1.default.query('SELECT * FROM Categoria WHERE cod_cat = $1 AND activo = true', [cod_cat]);
exports.findById = findById;
const create = ({ nom_cat, descrip_cat }) => db_1.default.query('INSERT INTO Categoria (nom_cat, descrip_cat) VALUES ($1, $2) RETURNING *', [nom_cat, descrip_cat || null]);
exports.create = create;
const update = (cod_cat, fields) => {
    const allowed = ['nom_cat', 'descrip_cat'];
    const entries = Object.entries(fields).filter(([key]) => allowed.includes(key));
    if (entries.length === 0)
        return Promise.resolve({ rows: [] });
    const setClauses = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
    return db_1.default.query(`UPDATE Categoria SET ${setClauses}
         WHERE cod_cat = $${entries.length + 1} AND activo = true
         RETURNING *`, [...entries.map(([, val]) => val), cod_cat]);
};
exports.update = update;
const remove = (cod_cat) => db_1.default.query('UPDATE Categoria SET activo = false WHERE cod_cat = $1 AND activo = true RETURNING cod_cat', [cod_cat]);
exports.remove = remove;
