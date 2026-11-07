'use client';

import { useState, useEffect, useRef } from 'react';
import { getProductos, getClientes, saveVenta, getDatabase, saveDatabase } from '../lib/store';
import { Producto, ArticuloVenta, Cliente, Venta } from '../lib/types';
import { formatMoney } from '../lib/format';
import { useAuth } from '../components/AuthShell';
import { ShoppingCart, Search, Plus, CheckCircle2 } from 'lucide-react';
import FacturaTicket from '../components/FacturaTicket';

export default function VentasPage() {
  const { user } = useAuth();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientesList, setClientesList] = useState<Cliente[]>([]);
  const [cart, setCart] = useState<ArticuloVenta[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState('Cliente General');
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [search, setSearch] = useState('');
  const [ventaCompletada, setVentaCompletada] = useState<Venta | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scanTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProductos(getProductos());
      setClientesList(getClientes());
      searchInputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => () => {
    if (scanTimerRef.current) window.clearTimeout(scanTimerRef.current);
  }, []);

  const addToCart = (p: Producto) => {
    if (p.stockActual <= 0) {
      alert('El producto se encuentra agotado.');
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === p.id);
      if (existing) {
        if (existing.quantity >= p.stockActual) {
          alert('Has alcanzado el límite del stock disponible.');
          return prev;
        }
        return prev.map(item => item.id === p.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: p.id, nombre: p.nombre, price: p.precioVenta, quantity: 1 }];
    });
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const addScannedProduct = (code: string) => {
    const scannedCode = code.trim().toLocaleLowerCase();
    const product = productos.find(item => item.sku.trim().toLocaleLowerCase() === scannedCode);
    if (!product) return false;

    addToCart(product);
    setSearch('');
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return true;
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (scanTimerRef.current) window.clearTimeout(scanTimerRef.current);
    if (!value.trim()) return;

    scanTimerRef.current = window.setTimeout(() => {
      addScannedProduct(value);
      scanTimerRef.current = null;
    }, 200);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (scanTimerRef.current) window.clearTimeout(scanTimerRef.current);
    scanTimerRef.current = null;
    addScannedProduct(search);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean) as ArticuloVenta[]);
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const total = subtotal;

  const handleCheckout = () => {
    if (!user) {
      alert('Debes iniciar sesión para registrar una venta.');
      return;
    }
    if (cart.length === 0) {
      alert('El carrito está vacío.');
      return;
    }
    let cId = '';
    let cNombre = 'Cliente General';
    let cNit = 'N/A';
    let cDireccion = 'Sincelejo';
    let deudaAnterior = 0;
    let deudaActual = 0;

    if (clienteSeleccionado !== 'Cliente General') {
      const clienteObj = clientesList.find(c => c.id === clienteSeleccionado);
      if (clienteObj) {
        cId = clienteObj.id;
        cNombre = clienteObj.nombre;
        cNit = clienteObj.nit;
        cDireccion = clienteObj.direccion || 'Sincelejo';
        deudaAnterior = clienteObj.deuda || 0;
        if (metodoPago === 'Crédito') {
          deudaActual = deudaAnterior + total;
          const db = getDatabase();
          db.clientes = db.clientes.map(cli => {
            if (cli.id === clienteObj.id) {
              return { ...cli, deuda: deudaActual };
            }
            return cli;
          });
          saveDatabase(db);
        }
      }
    }

    const nuevaVenta = saveVenta({
      clienteId: cId,
      clienteNombre: cNombre,
      clienteNIT: cNit,
      clienteDireccion: cDireccion,
      articulos: cart,
      subtotal,
      total,
      metodoPago,
      vendedor: user.displayName,
      deudaAnterior: metodoPago === 'Crédito' && clienteSeleccionado !== 'Cliente General' ? deudaAnterior : undefined,
      deudaActual: metodoPago === 'Crédito' && clienteSeleccionado !== 'Cliente General' ? deudaActual : undefined
    });

    setVentaCompletada(nuevaVenta);
    setCart([]);
    setProductos(getProductos());
    setClientesList(getClientes());
    setClienteSeleccionado('Cliente General');
  };

  const filtered = productos.filter(p => (p.nombre || '').toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="flex-1 flex flex-col overflow-y-auto bg-[#0b0f19]">
      <header className="bg-[#131b2e] border-b border-slate-800 px-8 py-5 shadow-lg flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">MÓDULO PUNTO DE VENTA (POS)</span>
          <h2 className="text-xl font-black text-white mt-0.5">Caja Registradora y Facturación</h2>
        </div>
      </header>

      <div className="p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="relative" onClick={() => searchInputRef.current?.focus()}>
            <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
            <input 
              ref={searchInputRef}
              type="text" 
              value={search} 
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Buscar por nombre o escanear SKU / código de barras..." 
              className="w-full pl-11 pr-4 py-3 bg-[#131b2e] border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.length === 0 ? (
              <div className="col-span-2 bg-[#131b2e] border border-slate-800 p-12 text-center rounded-2xl text-slate-400">
                No hay productos disponibles. Agrégalos primero en el módulo de Inventario.
              </div>
            ) : (
              filtered.map(p => (
                <div key={p.id} onClick={() => addToCart(p)} className="bg-[#131b2e] border border-slate-800 p-5 rounded-2xl shadow-lg hover:border-emerald-500/50 cursor-pointer transition flex flex-col justify-between group">
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] font-mono text-slate-400">{p.sku}</span>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${p.stockActual > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        Stock: {p.stockActual}
                      </span>
                    </div>
                    <h4 className="font-bold text-white mt-2 group-hover:text-emerald-400 transition">{p.nombre}</h4>
                  </div>
                  <div className="flex justify-between items-center mt-5 pt-3 border-t border-slate-800">
                    <span className="text-emerald-400 font-black text-lg">${formatMoney(p.precioVenta)}</span>
                    <span className="text-xs px-3 py-1.5 bg-emerald-600/10 text-emerald-400 rounded-xl font-bold flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Agregar
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-[#131b2e] border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col justify-between space-y-6">
          <div>
            <h3 className="font-bold text-white text-base mb-4 border-b border-slate-800 pb-3 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-400" /> Carrito de Facturación
            </h3>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-12">El carrito está vacío. Selecciona un producto.</p>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-[#0b0f19] p-3.5 rounded-xl border border-slate-800">
                    <div>
                      <p className="text-xs font-bold text-white">{item.nombre}</p>
                      <p className="text-xs text-emerald-400 font-semibold">${formatMoney(item.price)} c/u</p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button onClick={() => updateQuantity(item.id, -1)} className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center font-bold">-</button>
                      <span className="text-xs font-bold text-white w-5 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center font-bold">+</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-800 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1.5">Cliente</label>
              <select 
                value={clienteSeleccionado} 
                onChange={(e) => setClienteSeleccionado(e.target.value)} 
                className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-800 rounded-xl text-xs text-white font-medium"
              >
                <option value="Cliente General">Cliente General</option>
                {clientesList.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nit} - {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1.5">Método de Pago</label>
              <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-800 rounded-xl text-xs text-white font-medium">
                <option value="Efectivo">Efectivo</option>
                <option value="Nequi">Nequi</option>
                <option value="Bancolombia">Bancolombia</option>
                <option value="Crédito">Crédito</option>
              </select>
            </div>

            <div className="space-y-1.5 pt-3 border-t border-slate-800 text-xs">
              <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>${formatMoney(subtotal)}</span></div>
              <div className="flex justify-between text-white font-black text-base pt-2 border-t border-slate-800">
                <span>Total a Pagar</span>
                <span className="text-emerald-400">${formatMoney(total)}</span>
              </div>
            </div>

            <button 
              onClick={handleCheckout}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Completar Venta y Descontar Stock
            </button>
          </div>
        </div>
      </div>

      {ventaCompletada && (
        <FacturaTicket 
          venta={ventaCompletada} 
          onClose={() => setVentaCompletada(null)} 
        />
      )}
    </main>
  );
}