'use client';

import { useState, useEffect } from 'react';
import { deleteVenta, getDatabase, getVentaDate } from '../lib/store';
import { Producto, Venta } from '../lib/types';
import { formatMoney } from '../lib/format';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { FileDown, Trash2 } from 'lucide-react';

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getSaleTotal(venta: Venta): number {
  const itemsTotal = venta.articulos.reduce((total, item) => {
    const price = Number(item.price);
    const quantity = Number(item.quantity);
    return total + (Number.isFinite(price) && Number.isFinite(quantity) ? price * quantity : 0);
  }, 0);

  if (venta.articulos.length > 0) return itemsTotal;
  const storedTotal = Number(venta.total);
  return Number.isFinite(storedTotal) ? storedTotal : 0;
}

export default function ReportesPage() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [fechaActual, setFechaActual] = useState<Date | null>(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const now = new Date();
      const database = getDatabase();
      setVentas(database.ventas);
      setProductos(database.productos);
      setFechaActual(now);
      setFechaSeleccionada(dateKey(now));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const ventasPorMetodo = ventas.reduce<Record<string, number>>((acc, venta) => {
    const metodo = venta.metodoPago || 'Sin especificar';
    acc[metodo] = (acc[metodo] || 0) + getSaleTotal(venta);
    return acc;
  }, {});

  const totalVentas = ventas.reduce((total, venta) => total + getSaleTotal(venta), 0);
  const gananciaNeta = ventas.reduce((total, venta) => total + venta.articulos.reduce((profit, item) => {
    const itemName = item.nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase();
    const itemId = item.id.trim().toLocaleLowerCase();
    const producto = productos.find(product =>
      product.id.trim().toLocaleLowerCase() === itemId
      || product.sku.trim().toLocaleLowerCase() === itemId
      || product.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase() === itemName
    );
    return profit + (item.price - (producto?.precioCompra ?? 0)) * item.quantity;
  }, 0), 0);
  const totalTransacciones = ventas.length;
  const ticketPromedio = totalTransacciones > 0 ? totalVentas / totalTransacciones : 0;

  const dataMetodos = Object.entries(ventasPorMetodo).map(([name, value], index, methods) => ({
    name,
    value,
    percentage: totalVentas > 0 ? value / totalVentas * 100 : 0,
    color: `hsl(${Math.round(index * 360 / Math.max(methods.length, 1))} 70% 50%)`,
  }));

  const shiftSelectedDate = (days: number) => {
    if (!fechaSeleccionada) return;
    const date = new Date(`${fechaSeleccionada}T12:00:00`);
    date.setDate(date.getDate() + days);
    setFechaSeleccionada(dateKey(date));
  };
  const today = fechaActual;
  const startOfPeriod = today
    ? new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)
    : null;
  const dailyTotals = new Map<string, number>();
  ventas.forEach(venta => {
    const date = getVentaDate(venta);
    if (date && startOfPeriod && today
      && date >= startOfPeriod
      && date <= new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)) {
      const key = dateKey(date);
      dailyTotals.set(key, (dailyTotals.get(key) || 0) + getSaleTotal(venta));
    }
  });
  const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const dataUltimosDias = startOfPeriod ? Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startOfPeriod.getFullYear(), startOfPeriod.getMonth(), startOfPeriod.getDate() + index);
    return {
      dia: weekdays[date.getDay()],
      fecha: date.toLocaleDateString('es-CO'),
      ventas: dailyTotals.get(dateKey(date)) || 0,
    };
  }) : [];

  const selectedDateKey = fechaSeleccionada;
  const ventasDelDia = ventas
    .filter(venta => {
      const date = getVentaDate(venta);
      return date !== null && dateKey(date) === selectedDateKey;
    })
    .sort((a, b) => (getVentaDate(b)?.getTime() ?? 0) - (getVentaDate(a)?.getTime() ?? 0));
  const paymentCategory = (method: string): 'Efectivo' | 'Nequi' | 'Crédito' | string => {
    const normalized = method.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    if (normalized.includes('efectivo')) return 'Efectivo';
    if (normalized.includes('nequi')) return 'Nequi';
    if (normalized.includes('credito')) return 'Crédito';
    return method || 'Sin especificar';
  };
  const totalDelDia = ventasDelDia.reduce((total, venta) => total + getSaleTotal(venta), 0);
  const totalEfectivo = ventasDelDia
    .filter(venta => paymentCategory(venta.metodoPago) === 'Efectivo')
    .reduce((total, venta) => total + getSaleTotal(venta), 0);
  const totalNequi = ventasDelDia
    .filter(venta => paymentCategory(venta.metodoPago) === 'Nequi')
    .reduce((total, venta) => total + getSaleTotal(venta), 0);
  const totalCredito = ventasDelDia
    .filter(venta => paymentCategory(venta.metodoPago) === 'Crédito')
    .reduce((total, venta) => total + getSaleTotal(venta), 0);

  const handleDeleteSale = (venta: Venta) => {
    const receipt = venta.numeroFactura || venta.id;
    if (!window.confirm(`¿Eliminar la venta ${receipt}? El stock de sus productos será restaurado.`)) return;
    if (!deleteVenta(venta.id)) {
      window.alert('No se encontró la venta. No se realizaron cambios.');
      return;
    }

    const database = getDatabase();
    setVentas(database.ventas);
    setProductos(database.productos);
  };

  const productosVendidos = new Map<string, { name: string; sku: string; unidad: string; cantidad: number }>();
  ventas.forEach(venta => venta.articulos.forEach(item => {
    const producto = productos.find(product =>
      product.id === item.id
      || product.sku === item.id
      || product.nombre.toLocaleLowerCase() === item.nombre.toLocaleLowerCase()
    );
    const sku = producto?.sku || '';
    const name = producto?.nombre || item.nombre || 'Producto sin nombre';
    const key = sku ? `sku:${sku.toLocaleLowerCase()}` : `nombre:${name.toLocaleLowerCase()}`;
    const existing = productosVendidos.get(key);
    productosVendidos.set(key, {
      name,
      sku: producto?.sku || '',
      unidad: producto?.unidad?.trim() || item.unidad?.trim() || 'unid',
      cantidad: (existing?.cantidad || 0) + item.quantity,
    });
  }));

  const topProductos = [...productosVendidos.values()]
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5);

  const exportPDF = () => {
    const doc = new jsPDF();
    const lines = [
      'Nexo Digital Sucre - Reporte Financiero',
      `Ventas Totales: $${formatMoney(totalVentas)}`,
      `Ganancia Neta Estimada: $${formatMoney(gananciaNeta)}`,
      `Ticket Promedio: $${formatMoney(ticketPromedio)}`,
      '',
      'Ventas de los últimos 7 días:',
      ...dataUltimosDias.map(day => `${day.fecha} (${day.dia}): $${formatMoney(day.ventas)}`),
      '',
      'Distribución por método de pago:',
      ...dataMetodos.map(method => `${method.name}: $${formatMoney(method.value)} (${method.percentage.toFixed(1)}%)`),
      '',
      'Top 5 productos más vendidos:',
      ...topProductos.map((product, index) => `${index + 1}. ${product.name}: ${product.cantidad} ${product.unidad}`),
      '',
      `Informe diario: ${fechaSeleccionada}`,
      `Total del día: $${formatMoney(totalDelDia)}`,
      `Ventas en efectivo: $${formatMoney(totalEfectivo)}`,
      `Ventas en Nequi: $${formatMoney(totalNequi)}`,
      `Ventas a crédito: $${formatMoney(totalCredito)}`,
      ...ventasDelDia.map(venta => `${getVentaDate(venta)?.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) || '--:--'} | ${venta.numeroFactura || venta.id} | ${venta.clienteNombre || venta.cliente} | ${paymentCategory(venta.metodoPago)} | $${formatMoney(getSaleTotal(venta))}`),
      '',
      'Transacciones:',
      ...ventas.map(venta => `${venta.numeroFactura || venta.id} | ${venta.clienteNombre || venta.cliente} | ${venta.metodoPago} | ${venta.fecha} | $${formatMoney(getSaleTotal(venta))}`),
    ];

    let y = 20;
    doc.setFontSize(10);
    lines.forEach(line => {
      const wrapped = doc.splitTextToSize(line, 180) as string[];
      if (y + wrapped.length * 6 > 285) {
        doc.addPage();
        y = 20;
      }
      doc.text(wrapped, 14, y);
      y += wrapped.length * 6;
    });
    doc.save('reporte_nexo_sucre.pdf');
  };

  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();
    const resumen = XLSX.utils.json_to_sheet([
      { Indicador: 'Ventas Totales', Valor: totalVentas },
      { Indicador: 'Ganancia Neta Estimada', Valor: gananciaNeta },
      { Indicador: 'Ticket Promedio', Valor: ticketPromedio },
      { Indicador: 'Transacciones', Valor: totalTransacciones },
    ]);
    XLSX.utils.book_append_sheet(workbook, resumen, 'Resumen');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(
      dataUltimosDias.map(day => ({ Fecha: day.fecha, Día: day.dia, Ventas: day.ventas })),
    ), 'Últimos 7 días');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(
      ventasDelDia.map(venta => ({
        Fecha: fechaSeleccionada,
        Hora: getVentaDate(venta)?.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) || '',
        Venta: venta.numeroFactura || venta.id,
        Cliente: venta.clienteNombre || venta.cliente,
        Productos: venta.articulos.map(item => `${item.nombre} x${item.quantity}`).join(', '),
        'Método de pago': paymentCategory(venta.metodoPago),
        Total: getSaleTotal(venta),
      })),
    ), 'Detalle del día');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(
      dataMetodos.map(method => ({ Método: method.name, Valor: method.value, Porcentaje: method.percentage })),
    ), 'Métodos de pago');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(
      topProductos.map((product, index) => ({ Posición: index + 1, SKU: product.sku, Producto: product.name, 'Cantidad vendida': product.cantidad })),
    ), 'Top productos');
    const dataToExport = ventas.map(venta => ({
      Recibo: venta.numeroFactura || venta.id,
      Cliente: venta.clienteNombre || venta.cliente,
      Subtotal: getSaleTotal(venta),
      Total: getSaleTotal(venta),
      MetodoPago: venta.metodoPago,
      Fecha: venta.fecha,
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ventas');
    XLSX.writeFile(workbook, 'reporte_nexo_sucre.xlsx');
  };

  return (
    <main className="flex-1 flex flex-col overflow-y-auto bg-[#0b0f19]">
      <header className="bg-[#131b2e] border-b border-slate-800 px-8 py-5 shadow-lg flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">INTELIGENCIA COMERCIAL Y REPORTES</span>
          <h2 className="text-xl font-black text-white mt-0.5">Informes Financieros y Exportación</h2>
        </div>
        <div className="flex gap-3">
          <button onClick={exportPDF} className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition shadow-lg flex items-center gap-2">
            <FileDown className="w-4 h-4" /> Exportar PDF
          </button>
          <button onClick={exportExcel} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg flex items-center gap-2">
            <FileDown className="w-4 h-4" /> Exportar Excel
          </button>
        </div>
      </header>

      <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-[#131b2e] border border-slate-800 p-6 rounded-2xl shadow-xl">
            <span className="text-xs font-bold text-slate-400 uppercase">Ganancia Neta Estimada</span>
            <p className="text-3xl font-black text-emerald-400 mt-2">${formatMoney(gananciaNeta)}</p>
          </div>
          <div className="bg-[#131b2e] border border-slate-800 p-6 rounded-2xl shadow-xl">
            <span className="text-xs font-bold text-slate-400 uppercase">Total Ventas</span>
            <p className="text-3xl font-black text-white mt-2">${formatMoney(totalVentas)}</p>
          </div>
          <div className="bg-[#131b2e] border border-slate-800 p-6 rounded-2xl shadow-xl">
            <span className="text-xs font-bold text-slate-400 uppercase">Ticket Promedio</span>
            <p className="text-3xl font-black text-blue-400 mt-2">${formatMoney(ticketPromedio)}</p>
          </div>
        </div>

        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="font-bold text-white text-base">Informe Diario por Método de Pago</h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => shiftSelectedDate(-1)}
                className="px-3 py-2 bg-[#131b2e] border border-slate-800 rounded-xl text-sm text-slate-300 hover:text-white transition"
              >
                Anterior
              </button>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <span>Ver día:</span>
                <input
                  type="date"
                  value={fechaSeleccionada}
                  onChange={event => setFechaSeleccionada(event.target.value)}
                  className="px-3 py-2 bg-[#131b2e] border border-slate-800 rounded-xl text-sm text-white"
                />
              </label>
              <button
                type="button"
                onClick={() => shiftSelectedDate(1)}
                className="px-3 py-2 bg-[#131b2e] border border-slate-800 rounded-xl text-sm text-slate-300 hover:text-white transition"
              >
                Siguiente día
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {[
              { label: 'Total del Día', total: totalDelDia, color: 'text-white' },
              { label: 'Ventas en Efectivo', total: totalEfectivo, color: 'text-emerald-400' },
              { label: 'Ventas en Nequi', total: totalNequi, color: 'text-blue-400' },
              { label: 'Ventas a Crédito', total: totalCredito, color: 'text-amber-400' },
            ].map(card => (
              <div key={card.label} className="bg-[#131b2e] border border-slate-800 p-6 rounded-2xl shadow-xl">
                <span className="text-xs font-bold text-slate-400 uppercase">{card.label}</span>
                <p className={`text-2xl font-black mt-2 ${card.color}`}>${formatMoney(card.total)}</p>
              </div>
            ))}
          </div>

          <div className="bg-[#131b2e] border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <h3 className="font-bold text-white text-base">Detalle de ventas del día</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase">
                    <th className="py-3 px-4">Hora</th>
                    <th className="py-3 px-4">N° Venta</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Productos</th>
                    <th className="py-3 px-4">Método de Pago</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {ventasDelDia.length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-xs text-slate-500">No hay ventas registradas para este día.</td></tr>
                  ) : ventasDelDia.map(venta => (
                    <tr key={venta.id} className="hover:bg-slate-800/30">
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {getVentaDate(venta)?.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-300">{venta.numeroFactura || venta.id}</td>
                      <td className="py-3.5 px-4 font-semibold text-white">{venta.clienteNombre || venta.cliente || 'Cliente General'}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-300">
                        {venta.articulos.map(item => `${item.nombre} x${item.quantity}`).join(', ')}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{paymentCategory(venta.metodoPago)}</td>
                      <td className="py-3.5 px-4 text-right font-black text-emerald-400">${formatMoney(getSaleTotal(venta))}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteSale(venta)}
                          aria-label={`Eliminar venta ${venta.numeroFactura || venta.id}`}
                          title="Eliminar venta y restaurar stock"
                          className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-400 transition hover:border-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-[#131b2e] border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider">Ventas de los Últimos 7 Días</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataUltimosDias}>
                  <XAxis dataKey="dia" stroke="#64748b" />
                  <YAxis stroke="#64748b" tickFormatter={value => formatMoney(Number(value))} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#131b2e', borderColor: '#334155', borderRadius: '12px' }}
                    formatter={value => [`$${formatMoney(Number(value))}`, 'Ventas']}
                  />
                  <Bar dataKey="ventas" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#131b2e] border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider">Distribución por Método de Pago</h3>
            <div className="h-64 flex justify-center items-center">
              {dataMetodos.length === 0 ? (
                <p className="text-xs text-slate-500">Sin transacciones registradas.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataMetodos}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value, percent }) =>
                        `${name} $${formatMoney(Number(value))} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                    >
                      {dataMetodos.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#131b2e', borderColor: '#334155', borderRadius: '12px' }}
                      formatter={value => `$${formatMoney(Number(value))}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="bg-[#131b2e] border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <h3 className="font-bold text-white text-base">Top 5 Productos Más Vendidos</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4 text-right">Cantidad Vendida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {topProductos.length === 0 ? (
                  <tr><td colSpan={3} className="py-8 text-center text-xs text-slate-500">No hay ventas registradas aún.</td></tr>
                ) : (
                  topProductos.map((prod, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-400">0{idx + 1}</td>
                      <td className="py-3.5 px-4 font-semibold text-white">{prod.name}</td>
                      <td className="py-3.5 px-4 text-right font-black text-emerald-400">{prod.cantidad} {prod.unidad || 'unid'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}