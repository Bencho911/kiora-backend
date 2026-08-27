export interface Producto {
    id_pro?: number;
    nom_pro: string;
    des_pro?: string;
    val_pro: number;
    val_promocion?: number;
    id_categoria?: number;
    id_subcategoria?: number;
    imagen_url?: string;
    codigo_barras?: string;
    es_combo?: boolean;
    activo?: boolean;
    created_at?: Date;
    updated_at?: Date;
}

export interface Categoria {
    id_categoria?: number;
    nom_categoria: string;
    des_categoria?: string;
    activo?: boolean;
}

export interface Subcategoria {
    id_subcategoria?: number;
    id_categoria: number;
    nom_subcategoria: string;
    des_subcategoria?: string;
    activo?: boolean;
}

export interface Etiqueta {
    id_etiqueta?: number;
    nom_etiqueta: string;
}
