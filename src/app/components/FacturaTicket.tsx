'use client';

import { Venta } from '../lib/types';
import { getClientes } from '../lib/store';
import { formatMoney } from '../lib/format';
import { Printer, MessageCircle } from 'lucide-react';

interface FacturaTicketProps {
  venta: Venta;
  onClose: () => void;
}

export default function FacturaTicket({ venta, onClose }: FacturaTicketProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleEnviarWhatsApp = () => {
    // 1. Buscar teléfono del cliente
    let telefono = '';
    if (venta.clienteId) {
      try {
        const clientes = getClientes();
        const clienteObj: any = clientes.find((c: any) => c.id === venta.clienteId);
        if (clienteObj) {
          telefono = clienteObj.telefono || clienteObj.celular || clienteObj.phone || clienteObj.whatsapp || '';
        }
      } catch (e) {}
    }

    // 2. Si no tiene teléfono, pedirlo
    if (!telefono) {
      telefono = window.prompt('Escribe el WhatsApp del cliente (ej: 3001234567):', '') || '';
      if (!telefono) return;
    }

    let numeroLimpio = telefono.replace(/\D/g, '');
    if (numeroLimpio.length === 10) numeroLimpio = '57' + numeroLimpio;
    if (numeroLimpio.length !== 12) {
      alert('El número no parece válido. Debe tener 10 dígitos, ej: 3001234567');
      return;
    }

    const lineasProductos = venta.articulos
      .map(a => `- ${a.nombre} x${a.quantity} - $${formatMoney(a.price * a.quantity)}`)
      .join('\n');

    const mensaje = `*NEXO DIGITAL - FACTURA*\n\n` +
      `Factura: ${venta.numeroFactura || venta.id || ''}\n` +
      `Cliente: ${venta.clienteNombre}\n` +
      `Fecha: ${venta.fecha}\n` +
      `Pago: ${venta.metodoPago}\n\n` +
      `*Productos:*\n${lineasProductos}\n\n` +
      `Subtotal: $${formatMoney(venta.subtotal)}\n` +
      `*Total: $${formatMoney(venta.total)}*\n\n` +
      `Gracias por su compra en Nexo Digital, Sincelejo!`;

    window.open(`https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      
      <div className="bg-[#131b2e] border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center space-y-6">
        
        <div className="factura-ticket ticket-print w-[280px] bg-white text-black p-3 font-mono text-[11px] leading-tight rounded shadow-inner space-y-2">
          <div className="text-center space-y-0.5 border-b border-dashed border-black pb-2">
            <h2 className="font-bold text-xs uppercase">Nexo Digital Sucre ERP</h2>
            <p>NIT: 900.123.456-1</p>
            <p>Sincelejo, Sucre</p>
            <p>Tel: 300 123 4567</p>
          </div>

          <div className="border-b border-dashed border-black pb-2 space-y-0.5">
            <p className="font-bold text-center">{venta.numeroFactura}</p>
            <p><strong>Fecha:</strong> {venta.fecha}</p>
            <p><strong>Cliente:</strong> {venta.clienteNombre || 'Cliente General'}</p>
            <p><strong>NIT/CC:</strong> {venta.clienteNIT || 'N/A'}</p>
            <p><strong>Dir:</strong> {venta.clienteDireccion || 'Sincelejo'}</p>
          </div>

          <div className="border-b border-dashed border-black pb-2">
            <div className="grid grid-cols-12 font-bold border-b border-black pb-0.5 mb-1">
              <span className="col-span-6 text-left">ITEM</span>
              <span className="col-span-2 text-center">CANT</span>
              <span className="col-span-4 text-right">TOTAL</span>
            </div>
            {venta.articulos.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 py-0.5">
                <span className="col-span-6 text-left truncate">{item.nombre}</span>
                <span className="col-span-2 text-center">{item.quantity}</span>
                <span className="col-span-4 text-right">${formatMoney(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-0.5 border-b border-dashed border-black pb-2">
            <div className="flex justify-between"><span>Subtotal:</span><span>${formatMoney(venta.subtotal)}</span></div>
            <div className="flex justify-between font-bold pt-1 border-t border-black text-xs">
              <span>TOTAL A PAGAR:</span>
              <span>${formatMoney(venta.total)}</span>
            </div>
            <div className="flex justify-between pt-1"><span>Método Pago:</span><span className="font-bold">{venta.metodoPago}</span></div>
          </div>

          {venta.metodoPago === 'Crédito' && venta.deudaAnterior !== undefined && (
            <div className="border-b border-dashed border-black pb-2 space-y-0.5">
              <p className="font-bold text-center">ESTADO DE CRÉDITO</p>
              <div className="flex justify-between"><span>Deuda anterior:</span><span>${formatMoney(venta.deudaAnterior)}</span></div>
              <div className="flex justify-between"><span>Esta venta:</span><span>+${formatMoney(venta.total)}</span></div>
              <div className="flex justify-between font-bold pt-0.5 border-t border-black">
                <span>Deuda actual:</span>
                <span>${formatMoney(venta.deudaActual ?? 0)}</span>
              </div>
            </div>
          )}

          <div className="text-center pt-1 text-[10px] space-y-1">
            <p>¡Gracias por su compra!</p>
            <p className="font-bold">Nexo Digital - Sistema ERP</p>
            <div className="pt-3 pb-1 text-center font-bold tracking-widest text-[9px]">
              <p className="whitespace-pre">--- CORTAR AQUÍ ---</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 w-full no-print">
          <button 
            onClick={handlePrint}
            className="no-print flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button 
            onClick={handleEnviarWhatsApp}
            className="no-print flex-1 py-3 bg-[#25D366] hover:bg-[#1eb856] text-white font-bold text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </button>
          <button 
            onClick={onClose}
            className="no-print px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm rounded-xl transition"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}