import matplotlib
matplotlib.use('Agg')  # Configurar backend sin interfaz gráfica para servidores
import matplotlib.pyplot as plt
import io
import base64
from datetime import datetime, timedelta

def generate_sales_chart_base64(orders: list) -> str:
    """
    Toma una lista de órdenes y genera un gráfico de barras de las ventas de los últimos 7 días.
    Retorna la imagen en base64.
    """
    daily_totals = {}
    
    # Extraer totales por fecha
    for order in orders:
        try:
            date_str = order.get("fecha_ord", "").split("T")[0]
            if not date_str:
                continue
            daily_totals[date_str] = daily_totals.get(date_str, 0) + float(order.get("montofinal_vent", 0))
        except Exception:
            pass

    # Generar los últimos 7 días para asegurar que se vean incluso si no hubo ventas
    today = datetime.now()
    last_7_days = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
    
    sales = [daily_totals.get(day, 0) for day in last_7_days]
    
    # Crear gráfico
    fig, ax = plt.subplots(figsize=(8, 5))
    
    # Estilo moderno
    ax.bar(last_7_days, sales, color='#14b8a6', edgecolor='none', width=0.6, alpha=0.9)
    
    ax.set_title('Ventas de los últimos 7 días (Kiora)', fontsize=14, pad=15, color='#333333', fontweight='bold')
    ax.set_ylabel('Total Vendido ($)', fontsize=11, color='#666666')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#dddddd')
    ax.spines['bottom'].set_color('#dddddd')
    ax.tick_params(colors='#666666')
    plt.xticks(rotation=45, ha='right')
    
    # Formatear el eje Y como moneda
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f"${x:,.0f}"))
    
    plt.grid(axis='y', linestyle='--', alpha=0.3)
    plt.tight_layout()

    # Guardar a Base64
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=120)
    plt.close(fig)
    
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    
    return img_base64
