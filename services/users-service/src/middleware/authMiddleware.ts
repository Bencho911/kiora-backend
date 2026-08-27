import jwt from 'jsonwebtoken';
import { add, has, BLACKLIST_UNAVAILABLE } from '../config/blacklist';
import * as userRepository from '../repositories/userRepository';
import { Request, Response, NextFunction } from 'express';
import { Cliente } from '../models/types';

export interface AuthenticatedRequest extends Request {
    usuario?: Cliente;
    token?: string;
}

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no está definido en las variables de entorno. La aplicación no puede iniciar de forma segura.');
}

export const addToBlacklist = (token: string) => add(token);

export const verifyToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    // 1. Intentar leer de la cookie HttpOnly (clientes web)
    let token = req.cookies?.token;

    // 2. Si no hay cookie, leer del header Authorization (clientes móviles)
    if (!token) {
        const authHeader = (req.headers['authorization'] as string);
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
    }

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
    }

    // HU02 – Rechazar tokens revocados (logout)
    let isRevoked = false;
    try {
        isRevoked = await has(token);
    } catch (e: unknown) {
        if ((e as any).code === BLACKLIST_UNAVAILABLE) {
            return res.status(503).json({
                error: 'Servicio de sesiones temporalmente no disponible. Intenta de nuevo en unos segundos.',
            });
        }
        throw e;
    }
    if (isRevoked) {
        return res.status(401).json({ error: 'La sesión ha sido cerrada. Inicia sesión nuevamente.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const tokenSv = decoded.sv !== undefined && decoded.sv !== null ? decoded.sv : 0;
        const svResult = await userRepository.getSessionVersion(decoded.id_usu);
        if (svResult.rows.length === 0) {
            return res.status(401).json({ error: 'Usuario no válido. Inicia sesión nuevamente.' });
        }
        const currentSv = svResult.rows[0].session_version;
        if (currentSv !== tokenSv) {
            return res.status(401).json({ error: 'La sesión ya no es válida. Inicia sesión nuevamente.' });
        }
        req.usuario = decoded; // { id_usu, correo_usu, rol_usu, sv }
        req.token = token;     // guardar para el logout
        next();
    } catch (error: unknown) {
        // HU03 – Distinguir token expirado vs inválido
        if ((error as Error).name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'La sesión ha expirado. Inicia sesión nuevamente.' });
        }
        return res.status(403).json({ error: 'Token inválido.' });
    }
};

export const isAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): any => {
    if (!req.usuario || req.usuario.rol_usu !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Solo el administrador puede realizar esta acción.' });
    }
    next();
};
