export interface ArticuloVenta {
  id: string;
  nombre: string;
  price: number;
  quantity: number;
  unidad?: string;
}

export interface Venta {
  id: string;
  numeroFactura: string;
  cliente: string;
  clienteId?: string;
  clienteNombre?: string;
  clienteNIT?: string;
  clienteDireccion?: string;
  articulos: ArticuloVenta[];
  subtotal: number;
  total: number;
  metodoPago: string;
  vendedor?: string;
  deudaAnterior?: number;
  deudaActual?: number;
  fecha: string;
  fechaISO?: string;
}

export interface Producto {
  id: string;
  sku: string;
  nombre: string;
  categoria: string;
  precioCompra: number;
  precioVenta: number;
  margen: number;
  stockActual: number;
  unidad?: string;
  stockMinimo: number;
  proveedor: string;
}

export interface Cliente {
  id: string;
  tipo: 'Persona' | 'Empresa';
  nit: string;
  nombre: string;
  telefono: string;
  correo: string;
  direccion: string;
  limiteCredito: number;
  deuda: number;
  estado: 'Activo' | 'Inactivo';
}