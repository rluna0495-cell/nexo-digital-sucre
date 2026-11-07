'use client';

import { useState, useEffect } from 'react';
import { getClientes, saveCliente, getDatabase, saveDatabase } from '../lib/store';
import { Cliente } from '../lib/types';
import { formatMoney } from '../lib/format';
import { Users, Plus, Search, Edit, Trash2 } from 'lucide-react';

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [tipo, setTipo] = useState<'Persona' | 'Empresa'>('Persona');
  const [nit, setNit] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [direccion, setDireccion] = useState('Sincelejo');
  const [limiteCredito, setLimiteCredito] = useState('500000');
  const [estado, setEstado] = useState<'Activo' | 'Inactivo'>('Activo');

  useEffect(() => {
    setClientes(getClientes());
  }, []);

  const handleOpenModal = (cli?: Cliente) => {
    if (cli) {
      setEditingId(cli.id);
      setTipo(cli.tipo);
      setNit(cli.nit);
      setNombre(cli.nombre);
      setTelefono(cli.telefono);
      setCorreo(cli.correo);
      setDireccion(cli.direccion);
      setLimiteCredito(cli.limiteCredito.toString());
      setEstado(cli.estado);
    } else {
      setEditingId(null);
      setTipo('Persona');
      setNit('');
      setNombre('');
      setTelefono('');
      setCorreo('');
      setDireccion('Sincelejo');
      setLimiteCredito('500000');
      setEstado('Activo');
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nit || !nombre || !telefono) {
      alert('Por favor complete los campos obligatorios.');
      return;
    }

    const db = getDatabase();
    const lCredito = parseFloat(limiteCredito) || 500000;

    if (editingId) {
      db.clientes = db.clientes.map(c => c.id === editingId ? {
        ...c,
        tipo,
        nit,
        nombre,
        telefono,
        correo: correo || 'Sin correo',
        direccion,
        limiteCredito: lCredito,
        estado
      } : c);
      saveDatabase(db);
    } else {
      saveCliente({
        tipo,
        nit,
        nombre,
        telefono,
        correo: correo || 'Sin correo',
        direccion,
        limiteCredito: lCredito,
        deuda: 0,
        estado
      });
    }

    setClientes(getClientes());
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Está seguro de eliminar este cliente del directorio?')) {
      const db = getDatabase();
      db.clientes = db.clientes.filter(c => c.id !== id);
      saveDatabase(db);
      setClientes(getClientes());
    }
  };

  const filtered = clientes.filter(c => 
    (c.nombre || '').toLowerCase().includes(search.toLowerCase()) || 
    (c.nit || '').includes(search) ||
    (c.telefono || '').includes(search)
  );

  return (
    <main className="flex-1 flex flex-col overflow-y-auto bg-[#0b0f19]">
      <header className="bg-[#131b2e] border-b border-slate-800 px-8 py-5 shadow-lg flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">MÓDULO DE RELACIÓN COMERCIAL</span>
          <h2 className="text-xl font-black text-white mt-0.5">Directorio de Clientes y Créditos</h2>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-900/30 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nuevo Cliente
        </button>
      </header>

      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="Buscar por nombre, NIT / Cédula o teléfono..." 
            className="w-full pl-10 pr-4 py-2.5 bg-[#131b2e] border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="bg-[#131b2e] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase bg-[#0b0f19]/60">
                <th className="py-4 px-6">NIT / Cédula</th>
                <th className="py-4 px-6">Nombre / Razón Social</th>
                <th className="py-4 px-6">Contacto</th>
                <th className="py-4 px-6">Límite Crédito</th>
                <th className="py-4 px-6">Deuda Actual</th>
                <th className="py-4 px-6">Estado</th>
                <th className="py-4 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-slate-400">No hay clientes registrados en el directorio.</td></tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-4 px-6 font-mono text-xs text-slate-300 font-semibold">
                      {c.nit}
                      <span className="block text-[10px] text-slate-500">{c.tipo}</span>
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-bold text-white">{c.nombre}</p>
                      <p className="text-xs text-slate-400">{c.direccion}</p>
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-300">
                      <p>{c.telefono}</p>
                      <p className="text-slate-500">{c.correo}</p>
                    </td>
                    <td className="py-4 px-6 text-slate-300 font-medium">$ {formatMoney(c.limiteCredito || 500000)}</td>
                    <td className="py-4 px-6 font-bold text-emerald-400">${formatMoney(c.deuda)}</td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${c.estado === 'Activo' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {c.estado}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <button onClick={() => handleOpenModal(c)} className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl transition" title="Editar cliente">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition" title="Eliminar cliente">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#131b2e] border border-slate-800 rounded-2xl w-full max-w-xl p-8 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white">{editingId ? 'Editar Cliente / Empresa' : 'Registrar Nuevo Cliente'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Tipo de Cliente</label>
                  <select value={tipo} onChange={(e) => setTipo(e.target.value as any)} className="w-full px-4 py-2.5 bg-[#0b0f19] border border-slate-800 rounded-xl text-sm text-white">
                    <option value="Persona">Persona Natural</option>
                    <option value="Empresa">Empresa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">NIT / Cédula *</label>
                  <input type="text" required placeholder="1005123456" value={nit} onChange={(e) => setNit(e.target.value)} className="w-full px-4 py-2.5 bg-[#0b0f19] border border-slate-800 rounded-xl text-sm text-white font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Nombre Completo o Razón Social *</label>
                <input type="text" required placeholder="Ej. Carlos Mendoza" value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full px-4 py-2.5 bg-[#0b0f19] border border-slate-800 rounded-xl text-sm text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Teléfono *</label>
                  <input type="text" required placeholder="3001234567" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="w-full px-4 py-2.5 bg-[#0b0f19] border border-slate-800 rounded-xl text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Correo Electrónico</label>
                  <input type="email" placeholder="cliente@correo.com" value={correo} onChange={(e) => setCorreo(e.target.value)} className="w-full px-4 py-2.5 bg-[#0b0f19] border border-slate-800 rounded-xl text-sm text-white" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Dirección</label>
                  <input type="text" placeholder="Sincelejo" value={direccion} onChange={(e) => setDireccion(e.target.value)} className="w-full px-4 py-2.5 bg-[#0b0f19] border border-slate-800 rounded-xl text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Límite Crédito ($)</label>
                  <input type="number" min="0" placeholder="500000" value={limiteCredito} onChange={(e) => setLimiteCredito(e.target.value)} className="w-full px-4 py-2.5 bg-[#0b0f19] border border-slate-800 rounded-xl text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Estado</label>
                  <select value={estado} onChange={(e) => setEstado(e.target.value as any)} className="w-full px-4 py-2.5 bg-[#0b0f19] border border-slate-800 rounded-xl text-sm text-white">
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold">Cancelar</button>
                <button type="submit" className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-900/30">Guardar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}