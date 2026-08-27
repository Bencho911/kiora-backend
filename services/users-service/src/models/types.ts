export interface Cliente {
    id_usu?: number;
    nom_usu: string;
    correo_usu: string;
    password_usu?: string;
    rol_usu?: string;
    scope_type?: 'GLOBAL' | 'REGIONAL' | 'TIENDA' | null;
    scope_id?: number | null;
    tel_usu?: string;
    intentos_fallidos?: number;
    bloqueado_hasta?: Date | null;
    activo?: boolean;
    session_version?: number;
}

export interface ReporteFallo {
    id_rep?: number;
    descripcion: string;
    prioridad: 'baja' | 'media' | 'alta';
    estado: 'pendiente' | 'en_progreso' | 'resuelto' | 'cerrado';
    fk_id_usu: number;
    cod_prod?: number | null;
    observaciones_tecnicas?: string | null;
    titulo?: string | null;
    fecha_rep?: Date;
}
