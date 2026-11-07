'use client';

import { useState, useEffect } from 'react';
import { getDatabase, getVentaDate } from './lib/store';
import { Producto, Venta } from './lib/types';
import { formatMoney } from './lib/format';
import { Package, ShoppingCart, Users, BarChart3, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function HomeDashboard() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const database = getDatabase();
      setProductos(database.productos);
      setVentas(database.ventas);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const totalVentas = ventas.reduce((acc, venta) => (
    acc + venta.articulos.reduce((saleTotal, item) => {
      const price = Number(item.price);
      const quantity = Number(item.quantity);
      return saleTotal + (Number.isFinite(price) && Number.isFinite(quantity) ? price * quantity : 0);
    }, 0)
  ), 0);
  const totalProductosCount = productos.length;
  const stockCriticoCount = productos.filter(p => p.stockActual <= 5).length;
  const ultimasVentas = [...ventas]
    .sort((a, b) => (getVentaDate(b)?.getTime() ?? 0) - (getVentaDate(a)?.getTime() ?? 0))
    .slice(0, 5);

  return (
    <main className="flex-1 flex flex-col overflow-y-auto bg-[#0b0f19]">
      <header className="bg-[#131b2e] border-b border-slate-800 px-8 py-5 flex items-center justify-between shadow-lg">
        <div>
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">NEXO DIGITAL SUCRE · ERP CORPORATIVO</span>
          <h2 className="text-xl font-black text-white mt-0.5">Panel de Control General</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
            🟢 Sistema Operativo
          </span>
        </div>
      </header>

      <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#131b2e] border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute right-4 top-4 p-3 bg-emerald-500/10 rounded-xl text-emerald-400"><TrendingUp className="w-6 h-6" /></div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ventas Totales</p>
              <p className="text-3xl font-black text-white mt-2">${formatMoney(totalVentas)}</p>
            </div>
            <p className="text-xs text-emerald-400 font-semibold mt-4">{ventas.length} transacciones registradas en caja</p>
          </div>

          <div className="bg-[#131b2e] border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute right-4 top-4 p-3 bg-blue-500/10 rounded-xl text-blue-400"><Package className="w-6 h-6" /></div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Catálogo Activo</p>
              <p className="text-3xl font-black text-white mt-2">{totalProductosCount}</p>
            </div>
            <p className="text-xs text-blue-400 font-semibold mt-4">Artículos en inventario general</p>
          </div>

          <div className="bg-[#131b2e] border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute right-4 top-4 p-3 bg-amber-500/10 rounded-xl text-amber-400"><AlertTriangle className="w-6 h-6" /></div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alertas de Stock</p>
              <p className={`text-3xl font-black mt-2 ${stockCriticoCount > 0 ? 'text-amber-400' : 'text-white'}`}>{stockCriticoCount}</p>
            </div>
            <p className="text-xs text-slate-400 font-semibold mt-4">Productos con stock crítico</p>
          </div>
        </div>

        <div className="bg-[#131b2e] border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Accesos Directos a Módulos</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link href="/ventas" className="p-4 bg-[#0b0f19] hover:bg-slate-800/80 border border-slate-800 rounded-xl transition flex flex-col items-center text-center gap-2 group">
              <ShoppingCart className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition" />
              <span className="text-xs font-bold text-slate-200">Punto de Venta POS</span>
            </Link>
            <Link href="/productos" className="p-4 bg-[#0b0f19] hover:bg-slate-800/80 border border-slate-800 rounded-xl transition flex flex-col items-center text-center gap-2 group">
              <Package className="w-6 h-6 text-blue-400 group-hover:scale-110 transition" />
              <span className="text-xs font-bold text-slate-200">Inventario y Precios</span>
            </Link>
            <Link href="/clientes" className="p-4 bg-[#0b0f19] hover:bg-slate-800/80 border border-slate-800 rounded-xl transition flex flex-col items-center text-center gap-2 group">
              <Users className="w-6 h-6 text-purple-400 group-hover:scale-110 transition" />
              <span className="text-xs font-bold text-slate-200">Directorio Clientes</span>
            </Link>
            <Link href="/reportes" className="p-4 bg-[#0b0f19] hover:bg-slate-800/80 border border-slate-800 rounded-xl transition flex flex-col items-center text-center gap-2 group">
              <BarChart3 className="w-6 h-6 text-amber-400 group-hover:scale-110 transition" />
              <span className="text-xs font-bold text-slate-200">Informes y PDF/Excel</span>
            </Link>
          </div>
        </div>

        <div className="bg-[#131b2e] border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-white text-base">Últimas Transacciones Registradas</h3>
            <Link href="/reportes" className="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-1">
              Ver reporte completo <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase">
                  <th className="py-3 px-4">Recibo</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Método de Pago</th>
                  <th className="py-3 px-4">Fecha / Hora</th>
                  <th className="py-3 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {ultimasVentas.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center text-slate-500">No hay transacciones registradas todavía.</td></tr>
                ) : (
                  ultimasVentas.map(v => (
                    <tr key={v.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-300 font-semibold">{v.numeroFactura || v.id}</td>
                      <td className="py-3.5 px-4 font-semibold text-white">{v.clienteNombre || v.cliente || 'Cliente General'}</td>
                      <td className="py-3.5 px-4"><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">{v.metodoPago}</span></td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">{v.fecha}</td>
                      <td className="py-3.5 px-4 text-right font-black text-emerald-400">${formatMoney(v.total)}</td>
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