export {};
import request from 'supertest';
import app from '../app';
import db from '../config/db';

// Mock db.query
jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

describe('Stores Service API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Regionales API', () => {
    it('should list all regionales', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 1, nombre: 'Regional Norte' }],
      });

      const res = await request(app).get('/api/stores/regiones');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].nombre).toBe('Regional Norte');
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('should create a new regional', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 2, nombre: 'Regional Sur' }],
      });

      const res = await request(app)
        .post('/api/stores/regiones')
        .send({ nombre: 'Regional Sur' });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.nombre).toBe('Regional Sur');
    });
  });

  describe('Ciudades API', () => {
    it('should list all ciudades', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 1, nombre: 'Bogotá', fk_regional_id: 1, regional_nombre: 'Regional Centro' }],
      });

      const res = await request(app).get('/api/stores/ciudades');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].nombre).toBe('Bogotá');
    });
  });

  describe('Tiendas API', () => {
    it('should list all tiendas', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id_tienda: 1,
            nombre: 'Sede Principal',
            activa: true,
            estado: 'ABIERTO',
            fk_ciudad_id: 1,
            ciudad_nombre: 'Bogotá',
            regional_id: 1,
            regional_nombre: 'Regional Centro'
          }
        ],
      });

      const res = await request(app).get('/api/stores');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].nombre).toBe('Sede Principal');
      expect(res.body.data[0].ciudad_nombre).toBe('Bogotá');
    });

    it('should create a new tienda', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id_tienda: 2, nombre: 'Sede Norte', fk_ciudad_id: 1 }],
      });

      const res = await request(app)
        .post('/api/stores')
        .send({ nombre: 'Sede Norte', direccion: 'Calle 100', fk_ciudad_id: 1 });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.nombre).toBe('Sede Norte');
    });
  });
});
