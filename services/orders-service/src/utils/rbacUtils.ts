import { Request } from 'express';
import logger from '../config/logger';

const STORES_SERVICE_URL = process.env.STORES_SERVICE_URL || 'http://localhost:3005';

export interface UserScope {
    role: string | null;
    scopeType: string | null;
    scopeId: number | null;
}

export function getUserScope(req: Request): UserScope {
    const role = (req.headers['x-user-role'] as string) || null;
    const scopeType = (req.headers['x-user-scope-type'] as string) || null;
    const scopeId = req.headers['x-user-scope-id'] ? parseInt(req.headers['x-user-scope-id'] as string) : null;
    
    return { role, scopeType, scopeId };
}

export async function getAllowedStoreIds(req: Request): Promise<number[] | 'ALL'> {
    const { role, scopeType, scopeId } = getUserScope(req);

    if (role === 'admin' || scopeType === 'GLOBAL') {
        return 'ALL';
    }

    if (!scopeType || !scopeId) {
        // Para customers o sin scope, retornamos array vacío
        // En los endpoints de negocio, deberán proveer el store_id en el body o no tendrán acceso.
        return [];
    }

    if (scopeType === 'TIENDA') {
        return [scopeId];
    }

    // CIUDAD o REGIONAL -> fetch from stores-service
    try {
        const response = await fetch(`${STORES_SERVICE_URL}/api/stores/by-scope?scope_type=${scopeType}&scope_id=${scopeId}`);
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        logger.error('Error fetching stores by scope from stores-service', { error: (error as Error).message });
        return [];
    }
}
