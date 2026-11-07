'use client';

import { useState, useEffect } from 'react';
import { getNextProductSku, getProductos, saveProducto, getDatabase, saveDatabase } from '../lib/store';
import { Producto } from '../lib/types';
import { formatMoney } from '../lib/format';
import { Trash2, Edit, Plus, Search } from 'lucide-react';

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [sku, setSku] = useState('');
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('Abarrotes');
  const [precioCompra, setPrecioCompra] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [stockActual, setStockActual] = useState('');
  const [stockMinimo, setStockMinimo] = useState('5');
  const [proveedor, setProveedor] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setProductos(getProductos()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleOpenModal = (prod?: Producto) => {
    if (prod) {
      setEditingId(prod.id);
      setSku(prod.sku);
      setNombre(prod.nombre);
      setCategoria(prod.categoria);
      setPrecioCompra(prod.precioCompra.toString());
      setPrecioVenta(prod.precioVenta.toString());
      setStockActual(prod.stockActual.toString());
      setStockMinimo(prod.stockMinimo.toString());
      setProveedor(prod.proveedor);
    } else {
      setEditingId(null);
      setSku('');
      setNombre('');
      setCategoria('Abarrotes');
      setPrecioCompra('');
      setPrecioVenta('');
      setStockActual('');
      setStockMinimo('5');
      setProveedor('');
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !precioCompra || !precioVenta || !stockActual) {
      alert('Por favor complete los campos obligatorios.');
      return;
    }

    const finalSku = sku.trim() || getNextProductSku();
    const duplicateSku = getDatabase().productos.some(product =>
      product.id !== editingId
      && product.sku.trim().toLocaleLowerCase() === finalSku.toLocaleLowerCase()
    );
    if (duplicateSku) {
      alert('Este código ya existe');
      return;
    }

    const pCompra = parseFloat(precioCompra) || 0;
    const pVenta = parseFloat(precioVenta) || 0;
    const margen = pCompra > 0 ? parseFloat((((pVenta - pCompra) / pCompra) * 100).toFixed(1)) : 0;

    const db = getDatabase();

    if (editingId) {
      db.productos = db.productos.map(p => p.id === editingId ? {
        ...p,
        sku: finalSku,
        nombre,
        categoria,
        precioCompra: pCompra,
        precioVenta: pVenta,
        margen,
        stockActual: parseInt(stockActual) || 0,
        stockMinimo: parseInt(stockMinimo) || 5,
        proveedor
      } : p);
      saveDatabase(db);
    } else {
      try {
        saveProducto({
          sku: finalSku,
          nombre,
          categoria,
          precioCompra: pCompra,
          precioVenta: pVenta,
          stockActual: parseInt(stockActual) || 0,
          stockMinimo: parseInt(stockMinimo) || 5,
          proveedor: proveedor || 'Proveedor Local'
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'Este código ya existe') {
          alert(error.message);
          return;
        }
        throw error;
      }
    }

    setProductos(getProductos());
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Está seguro de eliminar este producto del inventario?')) {
      const db = getDatabase();
      db.productos = db.productos.filter(p => p.id !== id);
      saveDatabase(db);
      setProductos(getProductos());
    }
  };

  const filtered = productos.filter(p => 
    (p.nombre || '').toLowerCase().includes(search.toLowerCase()) || 
    (p.sku || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.categoria || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="flex-1 flex flex-col overflow-y-auto bg-[#0b0f19]">
      <header className="bg-[#131b2e] border-b border-slate-800 px-8 py-5 flex items-center justify-between shadow-lg">
        <div>
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">MÓDULO DE INVENTARIO Y CATÁLOGO</span>
          <h2 className="text-xl font-black text-white mt-0.5">Gestión de Productos y Márgenes</h2>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-900/30 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nuevo Producto
        </button>
      </header>

      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex justify-between items-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              placeholder="Buscar por SKU, nombre o categoría..." 
              className="w-full pl-10 pr-4 py-2.5 bg-[#131b2e] border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="bg-[#131b2e] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase bg-[#0b0f19]/60">
                <th className="py-4 px-6">SKU / Código de Barras</th>
                <th className="py-4 px-6">Nombre / Proveedor</th>
                <th className="py-4 px-6">Categoría</th>
                <th className="py-4 px-6">Costo</th>
                <th className="py-4 px-6">Venta</th>
                <th className="py-4 px-6">Margen</th>
                <th className="py-4 px-6">Stock</th>
                <th className="py-4 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center text-slate-400">No hay productos registrados en el inventario.</td></tr>
              ) : (
                filtered.map(p => {
                  const isLow = p.stockActual <= p.stockMinimo;
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-4 px-6 font-mono text-xs text-slate-300 font-semibold">{p.sku}</td>
                      <td className="py-4 px-6">
                        <p className="font-bold text-white">{p.nombre}</p>
                        <p className="text-xs text-slate-400">{p.proveedor}</p>
                      </td>
                      <td className="py-4 px-6 text-slate-300 text-xs">{p.categoria}</td>
                      <td className="py-4 px-6 text-slate-300">$ {formatMoney(p.precioCompra)}</td>
                      <td className="py-4 px-6 text-emerald-400 font-bold">$ {formatMoney(p.precioVenta)}</td>
                      <td className="py-4 px-6"><span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-semibold">{p.margen}%</span></td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${isLow ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          {p.stockActual} {p.unidad?.trim() || 'unid'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        <button onClick={() => handleOpenModal(p)} className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl transition" title="Editar">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#131b2e] border border-slate-800 rounded-2xl w-full max-w-xl p-8 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white">{editingId ? 'Editar Producto' : 'Registrar Nuevo Producto'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">SKU / Código de Barras</label>
                  <input type="text" placeholder="Vacío: automático PRD-001" value={sku} onChange={(e) => setSku(e.target.value)} className="w-full px-4 py-2.5 bg-[#0b0f19] border border-slate-800 rounded-xl text-sm text-white font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Categoría</label>
                  <input type="text" placeholder="Abarrotes" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full px-4 py-2.5 bg-[#0b0f19] border border-slate-800 rounded-xl text-sm text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Nombre del Producto *</label>
                <input type="text" required placeholder="Ej. Arroz Diana 1000g" value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full px-4 py-2.5 bg-[#0b0f19] border border-slate-800 rounded-xl text-sm text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Costo Compra ($) *</label>
                  <input type="number" required min="0" placeholder="3500" value={precioCompra} onChange={(e) => setPrecioCompra(e.target.value)} className="w-full px-4 py-2.5 bg-[#0b0f19] border border-slate-800 rounded-xl text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Precio Venta ($) *</label>
                  <input type="number" required min="0" placeholder="5000" value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)} className="w-full px-4 py-2.5 bg-[#0b0f19] border border-slate-800 rounded-xl text-sm text-white" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Stock Actual *</label>
                  <input type="number" required min="0" placeholder="50" value={stockActual} onChange={(e) => setStockActual(e.target.value)} className="w-full px-4 py-2.5 bg-[#0b0f19] border border-slate-800 rounded-xl text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Stock Mínimo</label>
                  <input type="number" min="0" placeholder="5" value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)} className="w-full px-4 py-2.5 bg-[#0b0f19] border border-slate-800 rounded-xl text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Proveedor</label>
                  <input type="text" placeholder="Distribuidor S.A." value={proveedor} onChange={(e) => setProveedor(e.target.value)} className="w-full px-4 py-2.5 bg-[#0b0f19] border border-slate-800 rounded-xl text-sm text-white" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold">Cancelar</button>
                <button type="submit" className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-900/30">Guardar Producto</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}