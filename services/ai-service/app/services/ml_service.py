import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from datetime import datetime, timedelta
from itertools import combinations
from collections import Counter

def predict_stock_depletion_ml(orders_data: list, product_id: int, current_stock: int) -> dict:
    """
    Analiza un historial de órdenes para un producto específico,
    calcula la tendencia de ventas usando Media Móvil Ponderada (WMA) y predice cuándo se agotará.
    Esto le da más peso a las ventas recientes y es robusto frente a picos anómalos.
    """
    if not orders_data or current_stock <= 0:
        return {
            "ml_velocity_per_day": 0,
            "days_until_empty": "N/A (Sin stock actual)",
            "trend": "neutral"
        }

    # Extraer ventas diarias del producto
    daily_sales = {}
    for order in orders_data:
        try:
            date_str = order.get("fecha_ord", "").split("T")[0]
            if not date_str:
                continue
                
            qty = 0
            for det in order.get("detalles", []):
                if det.get("fk_cod_prod") == product_id:
                    qty += det.get("cant_prod", 0)
            
            if qty > 0:
                daily_sales[date_str] = daily_sales.get(date_str, 0) + qty
        except Exception:
            pass

    if not daily_sales:
        return {
            "ml_velocity_per_day": 0,
            "days_until_empty": "Incalculable (Sin ventas históricas)",
            "trend": "neutral"
        }

    # Convertir a DataFrame y rellenar días sin ventas
    dates = sorted(daily_sales.keys())
    start_date = datetime.strptime(dates[0], "%Y-%m-%d")
    end_date = datetime.strptime(dates[-1], "%Y-%m-%d")
    
    # Si hay muy pocos días de diferencia (ej. todas las ventas en un solo día), usar promedio simple
    if (end_date - start_date).days < 2:
        avg = sum(daily_sales.values()) / max(len(dates), 1)
        return {
            "ml_velocity_per_day": round(avg, 2),
            "days_until_empty": round(current_stock / avg, 1) if avg > 0 else "Incalculable",
            "trend": "insufficient_data"
        }

    all_dates = [start_date + timedelta(days=x) for x in range((end_date - start_date).days + 1)]
    df = pd.DataFrame({"date": all_dates})
    df["date_str"] = df["date"].dt.strftime("%Y-%m-%d")
    
    sales_df = pd.DataFrame(list(daily_sales.items()), columns=["date_str", "qty"])
    df = df.merge(sales_df, on="date_str", how="left").fillna({"qty": 0})
    
    # Manejo de Outliers (Recorte al percentil 95 o 3 desviaciones estandar)
    mean_qty = df["qty"].mean()
    std_qty = df["qty"].std()
    upper_bound = mean_qty + (3 * std_qty if not pd.isna(std_qty) else 0)
    if upper_bound > 0:
        df["qty"] = df["qty"].clip(upper=upper_bound)

    # Media Móvil Ponderada (WMA) de los últimos N días
    n_days = len(df)
    weights = np.arange(1, n_days + 1)
    
    # Calcular velocidad ponderada
    wma_velocity = (df["qty"] * weights).sum() / weights.sum()
    
    # Evaluar tendencia comparando la 1ra mitad vs 2da mitad
    half = n_days // 2
    first_half_mean = df["qty"].iloc[:half].mean()
    second_half_mean = df["qty"].iloc[half:].mean()
    
    if wma_velocity <= 0.01:
        days_left = "Más de 3 meses (Baja rotación)"
        trend = "down"
    else:
        days_left = round(current_stock / wma_velocity, 1)
        if second_half_mean > first_half_mean * 1.1:
            trend = "up"
        elif second_half_mean < first_half_mean * 0.9:
            trend = "down"
        else:
            trend = "neutral"

    return {
        "ml_velocity_per_day": round(wma_velocity, 2),
        "days_until_empty": days_left,
        "trend": trend,
        "data_points": len(df),
        "total_sold_in_period": int(df["qty"].sum())
    }

def analyze_basket_cross_selling_ml(orders_data: list, products_data: list) -> dict:
    """
    Analiza el historial de órdenes para encontrar los pares de productos 
    que más frecuentemente se compran juntos (Market Basket Analysis básico).
    Incluye protección contra explosión combinatoria limitando el tamaño del carrito.
    """
    if not orders_data:
        return {"error": "No hay datos de ventas suficientes."}
        
    product_map = {}
    if isinstance(products_data, list):
        for p in products_data:
            product_map[p.get("cod_prod")] = p.get("nom_prod", "Desconocido")

    baskets = []
    ignored_baskets = 0
    
    for order in orders_data:
        items = set()
        for det in order.get("detalles", []):
            fk_prod = det.get("fk_cod_prod")
            if fk_prod:
                items.add(fk_prod)
                
        # Ignorar carritos con un solo producto
        if len(items) <= 1:
            continue
            
        # Proteccion O(N^2): Ignorar carritos gigantes (ej. compras B2B mayoristas)
        if len(items) > 15:
            ignored_baskets += 1
            continue
            
        baskets.append(list(items))
            
    if not baskets:
        return {"message": "No hay suficientes ventas con múltiples productos para realizar análisis de carrito."}
        
    pair_counts = Counter()
    for basket in baskets:
        # Generar todas las combinaciones posibles de 2 elementos en el carrito
        pairs = combinations(sorted(basket), 2)
        for pair in pairs:
            pair_counts[pair] += 1
            
    # Obtener los 10 pares más frecuentes
    top_pairs = pair_counts.most_common(10)
    
    recommendations = []
    for pair, count in top_pairs:
        prod1_id, prod2_id = pair
        name1 = product_map.get(prod1_id, f"ID {prod1_id}")
        name2 = product_map.get(prod2_id, f"ID {prod2_id}")
        
        # Calcular la confianza (porcentaje de veces que si compras prod1 llevas prod2)
        count_prod1 = sum(1 for b in baskets if prod1_id in b)
        confidence = (count / count_prod1) * 100 if count_prod1 > 0 else 0
        
        recommendations.append({
            "product_id_A": prod1_id,
            "product_A": name1,
            "product_id_B": prod2_id,
            "product_B": name2,
            "times_bought_together": count,
            "confidence_percent": round(confidence, 1),
            "suggestion": f"Si un cliente compra '{name1}', ofrécele '{name2}'."
        })
        
    return {
        "total_analyzed_baskets": len(baskets),
        "ignored_large_baskets": ignored_baskets,
        "top_cross_selling_opportunities": recommendations
    }

