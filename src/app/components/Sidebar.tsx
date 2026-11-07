'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ChangeEvent, useRef } from 'react';
import { Home, Package, ShoppingCart, Users, BarChart3, Download, Upload, Trash2 } from 'lucide-react';
import { clearAllAppData, createBackupJson, restoreBackupJson } from '../lib/store';

export default function Sidebar() {
  const pathname = usePathname();
  const backupInputRef = useRef<HTMLInputElement>(null);

  const menuItems = [
    { name: 'Inicio', href: '/', icon: Home },
    { name: 'Productos', href: '/productos', icon: Package },
    { name: 'Ventas POS', href: '/ventas', icon: ShoppingCart },
    { name: 'Clientes', href: '/clientes', icon: Users },
    { name: 'Reportes', href: '/reportes', icon: BarChart3 },
  ];

  const handleDownloadBackup = () => {
    const backup = new Blob([createBackupJson()], { type: 'application/json' });
    const url = URL.createObjectURL(backup);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nexo-copia-seguridad-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleEmpezarDeCero = () => {
    try {
      handleDownloadBackup();
    } catch (error) {
      console.error('No se pudo descargar la copia de seguridad antes del borrado.', error);
      window.alert('No se pudo generar la copia de seguridad. No se borró ningún dato.');
      return;
    }

    const backupConfirmed = window.confirm(
      'Se inició la descarga de la copia de seguridad. ¿Confirmas que el archivo se descargó correctamente? Si no lo descargaste, cancela para conservar todos los datos.'
    );
    if (!backupConfirmed) return;

    const deleteConfirmed = window.confirm(
      '¿Seguro que quieres borrar TODO? Esta acción no se puede deshacer'
    );
    if (!deleteConfirmed) return;

    const typedConfirmation = window.prompt('Escribe BORRAR para confirmar el borrado total.');
    if (typedConfirmation !== 'BORRAR') {
      window.alert('Confirmación incorrecta. No se borró ningún dato.');
      return;
    }

    try {
      clearAllAppData();
      window.location.reload();
    } catch (error) {
      console.error('No se pudieron borrar todos los datos de Nexo Digital.', error);
      window.alert('No se pudieron borrar todos los datos. Revisa el almacenamiento del navegador e inténtalo de nuevo.');
    }
  };

  const handleRestoreBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      restoreBackupJson(await file.text());
      window.alert('Copia restaurada. Se conservaron los datos existentes y se actualizará la aplicación.');
      window.location.reload();
    } catch (error) {
      console.error('No se pudo restaurar la copia de seguridad.', error);
      window.alert(error instanceof Error ? error.message : 'No se pudo restaurar la copia de seguridad.');
    }
  };

  return (
    <aside className="w-64 bg-[#131b2e] border-r border-slate-800 flex-col justify-between hidden md:flex">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-lg">
            N
          </div>
          <div>
            <h1 className="font-bold text-white text-sm tracking-wide">Nexo Digital</h1>
            <span className="text-[10px] text-emerald-400 font-semibold tracking-widest uppercase">Sucre ERP</span>
          </div>
        </div>

        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                  isActive 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 pt-6 border-t border-slate-800 space-y-2">
          <button
            onClick={handleDownloadBackup}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-300 border border-slate-700 hover:bg-slate-800/50 hover:text-white transition"
          >
            <Download className="w-5 h-5" />
            Descargar Copia de Seguridad
          </button>
          <button
            onClick={() => backupInputRef.current?.click()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-300 border border-slate-700 hover:bg-slate-800/50 hover:text-white transition"
          >
            <Upload className="w-5 h-5" />
            Restaurar Copia
          </button>
          <button
            onClick={handleEmpezarDeCero}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold bg-red-600/10 text-red-400 border border-red-600/20 hover:bg-red-600 hover:text-white transition"
          >
            <Trash2 className="w-5 h-5" />
            Empezar de Cero
          </button>
          <input
            ref={backupInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleRestoreBackup}
            className="hidden"
          />
        </div>
      </div>

      <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
        v2.5 · Sincelejo, Colombia
      </div>
    </aside>
  );
}