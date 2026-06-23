'use strict';
const db = require('../config/db');

const findAll = () => db.query('SELECT * FROM ReporteFallo ORDER BY fecha_rep DESC');
const findById = (id) => db.query('SELECT * FROM ReporteFallo WHERE id_rep = $1', [id]);

const create = ({ descripcion, prioridad, estado, fk_id_usu, cod_prod, observaciones_tecnicas, titulo }) => 
    db.query('INSERT INTO ReporteFallo (descripcion, prioridad, estado, fk_id_usu, cod_prod, observaciones_tecnicas, titulo) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', 
              [descripcion, prioridad || 'media', estado || 'pendiente', fk_id_usu, cod_prod || null, observaciones_tecnicas || null, titulo || null]);

const updateStatus = (id, estado) => db.query('UPDATE ReporteFallo SET estado = $1 WHERE id_rep = $2 RETURNING *', [estado, id]);
const remove = (id) => db.query('DELETE FROM ReporteFallo WHERE id_rep = $1 RETURNING *', [id]);

module.exports = { findAll, findById, create, updateStatus, remove };
