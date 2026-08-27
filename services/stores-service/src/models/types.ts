export interface Regional {
    id: number;
    nombre: string;
}

export interface Ciudad {
    id: number;
    nombre: string;
    fk_regional_id: number;
    regional_nombre?: string; // Optional since it might come from JOINs
}

export interface Tienda {
    id_tienda: number;
    nombre: string;
    direccion: string;
    telefono: string | null;
    factus_prefix: string;
    activa: boolean;
    estado: string;
    latitud: number | null;
    longitud: number | null;
    creado_en: string;
    fk_ciudad_id: number | null;
    ciudad_nombre?: string;
    regional_id?: number;
    regional_nombre?: string;
}

export interface Mesa {
    id_mesa: number;
    numero: number;
    estado: string;
    fk_tienda_id: number;
}
