import { ArticuloVenta, Cliente, Producto, Venta } from './types';

interface Database {
  productos: Producto[];
  clientes: Cliente[];
  ventas: Venta[];
}

const STORAGE_KEYS = {
  productos: 'nexo_productos',
  clientes: 'nexo_clientes',
  ventas: 'nexo_ventas',
} as const;
const AUTOMATIC_BACKUP_KEY = 'nexo_copia_automatica';
const CANONICAL_STORAGE_KEYS = new Set<string>([...Object.values(STORAGE_KEYS), AUTOMATIC_BACKUP_KEY]);

const LEGACY_DATABASE_KEY = 'nexo_digital_sucre_db';
let storageInitialized = false;

const initialDatabase: Database = {
  productos: [],
  clientes: [],
  ventas: []
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value !== 'string') {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  const cleaned = value.trim().replace(/[^\d.,-]/g, '');
  if (!cleaned) return fallback;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized = cleaned;

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandSeparator = decimalSeparator === ',' ? '.' : ',';
    normalized = cleaned.split(thousandSeparator).join('').replace(decimalSeparator, '.');
  } else if (lastComma !== -1) {
    normalized = /,\d{1,2}$/.test(cleaned)
      ? cleaned.replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (lastDot !== -1 && !/\.\d{1,2}$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, '');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeProducto(value: unknown, index: number): Producto | null {
  if (!isRecord(value)) return null;
  const nombre = stringValue(firstValue(value, ['nombre', 'name']));
  const isProduct = ['sku', 'SKU', 'codigo', 'codigoBarras', 'barcode', 'barcodeValue', 'precioCompra', 'costo', 'precioVenta', 'stockActual', 'stock']
    .some(key => value[key] !== undefined);
  if (!nombre || !isProduct) return null;

  const precioCompra = numberValue(firstValue(value, ['precioCompra', 'costo', 'cost']));
  const precioVenta = numberValue(firstValue(value, ['precioVenta', 'precio', 'price']));
  const margen = firstValue(value, ['margen', 'margin']);
  const storedUnit = stringValue(firstValue(value, ['unidad', 'unit'])).trim();
  return {
    id: stringValue(firstValue(value, ['id', 'productoId']), `producto-${index + 1}`),
    sku: stringValue(firstValue(value, ['sku', 'SKU', 'codigo', 'codigoBarras', 'barcode', 'barcodeValue'])),
    nombre,
    categoria: stringValue(firstValue(value, ['categoria', 'category'])),
    precioCompra,
    precioVenta,
    margen: margen === undefined
      ? precioCompra > 0 ? Number((((precioVenta - precioCompra) / precioCompra) * 100).toFixed(1)) : 0
      : numberValue(margen),
    stockActual: numberValue(firstValue(value, ['stockActual', 'stock', 'cantidad'])),
    unidad: !storedUnit || storedUnit.toLocaleLowerCase().includes('ident') ? 'unid' : storedUnit,
    stockMinimo: numberValue(firstValue(value, ['stockMinimo', 'stockMin', 'minimo'])),
    proveedor: stringValue(firstValue(value, ['proveedor', 'supplier'])),
  };
}

function normalizeArticulo(value: unknown, index: number): ArticuloVenta | null {
  if (!isRecord(value)) return null;
  const nombre = stringValue(firstValue(value, ['nombre', 'name']));
  if (!nombre) return null;
  const storedUnit = stringValue(firstValue(value, ['unidad', 'unit'])).trim();
  return {
    id: stringValue(firstValue(value, ['id', 'productoId', 'sku']), `articulo-${index + 1}`),
    nombre,
    price: numberValue(firstValue(value, ['price', 'precio', 'precioVenta'])),
    quantity: numberValue(firstValue(value, ['quantity', 'cantidad', 'qty'])),
    unidad: !storedUnit || storedUnit.toLocaleLowerCase().includes('ident') ? '' : storedUnit,
  };
}

function findProductForArticle(productos: Producto[], articulo: ArticuloVenta): Producto | undefined {
  const normalizedName = articulo.nombre.trim().toLocaleLowerCase();
  return productos.find(product =>
    product.id === articulo.id
    || product.sku.trim().toLocaleLowerCase() === articulo.id.trim().toLocaleLowerCase()
    || product.nombre.trim().toLocaleLowerCase() === normalizedName
  );
}

function normalizeSalesUnits(ventas: Venta[], productos: Producto[]): Venta[] {
  return ventas.map(venta => ({
    ...venta,
    articulos: venta.articulos.map(articulo => {
      const product = findProductForArticle(productos, articulo);
      const storedUnit = articulo.unidad?.trim() || '';
      return {
        ...articulo,
        unidad: !storedUnit || storedUnit.toLocaleLowerCase().includes('ident')
          ? product?.unidad?.trim() || 'unid'
          : storedUnit,
      };
    }),
  }));
}

function normalizeVenta(value: unknown, index: number): Venta | null {
  if (!isRecord(value)) return null;
  const rawArticles = firstValue(value, ['articulos', 'items', 'productos']);
  const total = firstValue(value, ['total', 'monto', 'amount']);
  if (!Array.isArray(rawArticles) || total === undefined) return null;

  const id = stringValue(firstValue(value, ['id', 'ventaId', 'uuid']), `venta-${index + 1}`);
  const articulos = rawArticles
    .map(normalizeArticulo)
    .filter((item): item is ArticuloVenta => item !== null);
  const subtotal = articulos.length > 0
    ? articulos.reduce((sum, item) => sum + item.price * item.quantity, 0)
    : numberValue(firstValue(value, ['subtotal']), numberValue(total));
  const clienteNombre = stringValue(firstValue(value, ['clienteNombre', 'cliente', 'customerName']), 'Cliente General');
  return {
    id,
    numeroFactura: stringValue(firstValue(value, ['numeroFactura', 'recibo', 'factura', 'receiptNumber']), id),
    cliente: stringValue(firstValue(value, ['cliente', 'clienteNombre', 'customerName']), clienteNombre),
    clienteId: stringValue(firstValue(value, ['clienteId', 'customerId'])),
    clienteNombre,
    clienteNIT: stringValue(firstValue(value, ['clienteNIT', 'nit', 'customerNit']), 'N/A'),
    clienteDireccion: stringValue(firstValue(value, ['clienteDireccion', 'direccion', 'address']), 'Sincelejo'),
    articulos,
    subtotal,
    total: subtotal,
    metodoPago: stringValue(firstValue(value, ['metodoPago', 'paymentMethod', 'metodo']), 'Sin especificar'),
    vendedor: stringValue(firstValue(value, ['vendedor', 'seller'])),
    deudaAnterior: typeof value.deudaAnterior === 'number' ? value.deudaAnterior : undefined,
    deudaActual: typeof value.deudaActual === 'number' ? value.deudaActual : undefined,
    fecha: stringValue(firstValue(value, ['fecha', 'date', 'createdAt'])),
    fechaISO: stringValue(firstValue(value, ['fechaISO', 'createdAtISO'])),
  };
}

function normalizeCliente(value: unknown, index: number): Cliente | null {
  if (!isRecord(value)) return null;
  const nombre = stringValue(firstValue(value, ['nombre', 'name']));
  const isClient = ['nit', 'NIT', 'documento', 'telefono', 'phone', 'correo', 'email', 'limiteCredito']
    .some(key => value[key] !== undefined);
  if (!nombre || !isClient) return null;
  return {
    id: stringValue(firstValue(value, ['id', 'clienteId']), `cliente-${index + 1}`),
    tipo: value.tipo === 'Empresa' ? 'Empresa' : 'Persona',
    nit: stringValue(firstValue(value, ['nit', 'NIT', 'documento'])),
    nombre,
    telefono: stringValue(firstValue(value, ['telefono', 'phone'])),
    correo: stringValue(firstValue(value, ['correo', 'email'])),
    direccion: stringValue(firstValue(value, ['direccion', 'address'])),
    limiteCredito: numberValue(firstValue(value, ['limiteCredito', 'creditLimit'])),
    deuda: numberValue(firstValue(value, ['deuda', 'balance'])),
    estado: value.estado === 'Inactivo' ? 'Inactivo' : 'Activo',
  };
}

function normalizeArray<T>(
  values: unknown[],
  normalize: (value: unknown, index: number) => T | null,
): T[] {
  return values.map(normalize).filter((value): value is T => value !== null);
}

function mergeUnique<T>(items: T[], keyFor: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = keyFor(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isInventedSeedClient(cliente: Cliente): boolean {
  return cliente.nit === '1005234890'
    && cliente.nombre.trim().toLocaleLowerCase() === 'carlos andrés martínez'
    && cliente.correo.trim().toLocaleLowerCase() === 'carlos.martinez@gmail.com';
}

function parseStorageValue(key: string): unknown {
  const stored = localStorage.getItem(key);
  if (stored === null) return null;
  try {
    return JSON.parse(stored) as unknown;
  } catch (error) {
    console.error(`No se pudo leer el almacenamiento "${key}".`, error);
    throw new Error(`Los datos guardados en "${key}" no contienen JSON válido.`);
  }
}

function addLegacyArray(
  value: unknown,
  products: Producto[],
  clients: Cliente[],
  sales: Venta[],
): boolean {
  if (!Array.isArray(value)) return false;
  const normalizedProducts = normalizeArray(value, normalizeProducto);
  const normalizedClients = normalizeArray(value, normalizeCliente);
  const normalizedSales = normalizeArray(value, normalizeVenta);
  if (normalizedProducts.length) products.push(...normalizedProducts);
  if (normalizedClients.length) clients.push(...normalizedClients);
  if (normalizedSales.length) sales.push(...normalizedSales);
  return normalizedProducts.length + normalizedClients.length + normalizedSales.length > 0;
}

function migrateLegacyStorage(): void {
  if (typeof window === 'undefined' || storageInitialized) return;

  const products = readCanonicalArray(STORAGE_KEYS.productos, normalizeProducto);
  const clients = readCanonicalArray(STORAGE_KEYS.clientes, normalizeCliente);
  const sales = readCanonicalArray(STORAGE_KEYS.ventas, normalizeVenta);
  const legacyKeysToRemove: string[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || CANONICAL_STORAGE_KEYS.has(key)) continue;
    if (!/nexo_digital_sucre_db|venta|sale|transaction|producto|product|cliente|customer|database|(^|[_-])db($|[_-])|(^|[_-])pos($|[_-])/i.test(key)) continue;

    const legacy = parseStorageValue(key);
    if (legacy === null) continue;
    const before = products.length + clients.length + sales.length;
    let recognized = false;

    if (key === LEGACY_DATABASE_KEY && isRecord(legacy)) {
      recognized = addLegacyArray(legacy.productos ?? legacy.products, products, clients, sales)
        || recognized;
      recognized = addLegacyArray(legacy.clientes ?? legacy.clients, products, clients, sales)
        || recognized;
      recognized = addLegacyArray(legacy.ventas ?? legacy.sales ?? legacy.transactions, products, clients, sales)
        || recognized;
    } else {
      recognized = addLegacyArray(legacy, products, clients, sales);
      if (isRecord(legacy)) {
        recognized = addLegacyArray(legacy.productos ?? legacy.products, products, clients, sales)
          || recognized;
        recognized = addLegacyArray(legacy.clientes ?? legacy.clients, products, clients, sales)
          || recognized;
        recognized = addLegacyArray(legacy.ventas ?? legacy.sales ?? legacy.transactions, products, clients, sales)
          || recognized;
      }
    }

    if (recognized || products.length + clients.length + sales.length > before) {
      legacyKeysToRemove.push(key);
    }
  }

  const mergedProducts = mergeUnique([...products, ...initialDatabase.productos], item =>
    item.sku ? `sku:${item.sku.toLowerCase()}` : `id:${item.id}`);
  const mergedClients = mergeUnique(
    [...clients, ...initialDatabase.clientes].filter(cliente => !isInventedSeedClient(cliente)),
    item => item.nit ? `nit:${item.nit}` : `id:${item.id}`,
  );
  const mergedSales = normalizeSalesUnits(mergeUnique(sales, item =>
    item.numeroFactura ? `factura:${item.numeroFactura}` : `id:${item.id}`), mergedProducts);

  localStorage.setItem(STORAGE_KEYS.productos, JSON.stringify(mergedProducts));
  localStorage.setItem(STORAGE_KEYS.clientes, JSON.stringify(mergedClients));
  localStorage.setItem(STORAGE_KEYS.ventas, JSON.stringify(mergedSales));
  legacyKeysToRemove.forEach(key => localStorage.removeItem(key));
  storageInitialized = true;
}

function readCanonicalArray<T>(
  key: string,
  normalize: (value: unknown, index: number) => T | null,
): T[] {
  const value = parseStorageValue(key);
  if (value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error(`El almacenamiento "${key}" debe contener una lista.`);
  }
  return normalizeArray(value, normalize);
}

export function getDatabase(): Database {
  if (typeof window === 'undefined') return initialDatabase;
  migrateLegacyStorage();
  const database = {
    productos: readCanonicalArray(STORAGE_KEYS.productos, normalizeProducto),
    clientes: readCanonicalArray(STORAGE_KEYS.clientes, normalizeCliente),
    ventas: readCanonicalArray(STORAGE_KEYS.ventas, normalizeVenta),
  };
  const normalizedSales = normalizeSalesUnits(database.ventas, database.productos);
  if (JSON.stringify(normalizedSales) !== JSON.stringify(database.ventas)) {
    database.ventas = normalizedSales;
    localStorage.setItem(STORAGE_KEYS.ventas, JSON.stringify(normalizedSales));
  }
  return database;
}

export function saveDatabase(db: Database): void {
  if (typeof window === 'undefined') return;
  migrateLegacyStorage();
  const database = {
    ...db,
    clientes: db.clientes.filter(cliente => !isInventedSeedClient(cliente)),
  };
  localStorage.setItem(STORAGE_KEYS.productos, JSON.stringify(database.productos));
  localStorage.setItem(STORAGE_KEYS.clientes, JSON.stringify(database.clientes));
  localStorage.setItem(STORAGE_KEYS.ventas, JSON.stringify(database.ventas));
  localStorage.setItem(AUTOMATIC_BACKUP_KEY, JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    data: database,
  }));
}

export function createBackupJson(): string {
  const db = getDatabase();
  return JSON.stringify({
    application: 'Nexo Digital Sucre',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: db,
  }, null, 2);
}

function mergeRestoredRecords<T>(
  current: T[],
  restored: T[],
  matches: (existing: T, incoming: T) => boolean,
): T[] {
  const merged = [...current];
  restored.forEach(incoming => {
    const index = merged.findIndex(existing => matches(existing, incoming));
    if (index === -1) merged.push(incoming);
    else merged[index] = incoming;
  });
  return merged;
}

export function restoreBackupJson(backupJson: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(backupJson) as unknown;
  } catch (error) {
    console.error('No se pudo leer la copia de seguridad JSON.', error);
    throw new Error('El archivo no contiene un JSON válido.');
  }

  if (!isRecord(parsed) || !isRecord(parsed.data)) {
    throw new Error('La copia de seguridad no tiene el formato esperado.');
  }

  const rawProducts = parsed.data.productos;
  const rawClients = parsed.data.clientes;
  const rawSales = parsed.data.ventas;
  if (!Array.isArray(rawProducts) || !Array.isArray(rawClients) || !Array.isArray(rawSales)) {
    throw new Error('La copia debe incluir productos, clientes y ventas.');
  }

  const restoredProducts = normalizeArray(rawProducts, normalizeProducto);
  const restoredClients = normalizeArray(rawClients, normalizeCliente);
  const restoredSales = normalizeArray(rawSales, normalizeVenta);
  const current = getDatabase();
  const merged: Database = {
    productos: mergeRestoredRecords(current.productos, restoredProducts, (existing, incoming) =>
      existing.id === incoming.id
      || Boolean(existing.sku && incoming.sku && existing.sku.trim().toLocaleLowerCase() === incoming.sku.trim().toLocaleLowerCase())
    ),
    clientes: mergeRestoredRecords(current.clientes, restoredClients, (existing, incoming) =>
      existing.id === incoming.id
      || Boolean(existing.nit && incoming.nit && existing.nit === incoming.nit)
    ),
    ventas: mergeRestoredRecords(current.ventas, restoredSales, (existing, incoming) =>
      existing.id === incoming.id
      || Boolean(existing.numeroFactura && incoming.numeroFactura && existing.numeroFactura === incoming.numeroFactura)
    ),
  };
  saveDatabase(merged);
}

export function clearAllAppData(): void {
  if (typeof window === 'undefined') return;

  const keysToRemove: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && (
      CANONICAL_STORAGE_KEYS.has(key)
      || key === LEGACY_DATABASE_KEY
      || /nexo_digital_sucre_db|venta|sale|transaction|producto|product|cliente|customer|database|(^|[_-])db($|[_-])|(^|[_-])pos($|[_-])/i.test(key)
    )) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
  storageInitialized = false;
}

export function getProductos(): Producto[] {
  return getDatabase().productos;
}

function nextProductSku(productos: Producto[]): string {
  const nextNumber = productos.reduce((highest, producto) => {
    const match = producto.sku.trim().match(/^PRD-(\d+)$/i);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0) + 1;
  return `PRD-${String(nextNumber).padStart(3, '0')}`;
}

export function getNextProductSku(): string {
  return nextProductSku(getProductos());
}

export function saveProducto(productoData: Omit<Producto, 'id' | 'margen'>): Producto {
  const db = getDatabase();
  const sku = productoData.sku.trim() || nextProductSku(db.productos);
  const normalizedSku = sku.toLocaleLowerCase();
  if (db.productos.some(product => product.sku.trim().toLocaleLowerCase() === normalizedSku)) {
    throw new Error('Este código ya existe');
  }

  const margen = productoData.precioCompra > 0
    ? Number((((productoData.precioVenta - productoData.precioCompra) / productoData.precioCompra) * 100).toFixed(1))
    : 0;
  const newProducto: Producto = {
    ...productoData,
    sku,
    unidad: productoData.unidad?.trim() || 'unid',
    stockActual: numberValue(productoData.stockActual),
    id: Date.now().toString(),
    margen,
  };

  db.productos.push(newProducto);
  saveDatabase(db);
  return newProducto;
}

export function getClientes(): Cliente[] {
  return getDatabase().clientes;
}

export function saveCliente(clienteData: Omit<Cliente, 'id'>): Cliente {
  const db = getDatabase();
  const newCliente: Cliente = {
    ...clienteData,
    id: Date.now().toString(),
  };
  db.clientes.push(newCliente);
  saveDatabase(db);
  return newCliente;
}

export function getVentas(): Venta[] {
  return getDatabase().ventas;
}

export function deleteVenta(ventaId: string): boolean {
  const db = getDatabase();
  const ventaIndex = db.ventas.findIndex(venta => venta.id === ventaId);
  if (ventaIndex === -1) return false;

  const [venta] = db.ventas.splice(ventaIndex, 1);
  venta.articulos.forEach(articulo => {
    const producto = findProductForArticle(db.productos, articulo);
    if (producto) {
      producto.stockActual = numberValue(producto.stockActual) + numberValue(articulo.quantity);
    }
  });

  saveDatabase(db);
  return true;
}

export function getVentaDate(venta: Venta): Date | null {
  const isoDate = venta.fechaISO || '';
  if (isoDate) {
    const parsedISO = new Date(isoDate);
    if (!Number.isNaN(parsedISO.getTime())) return parsedISO;
  }

  const localizedDate = venta.fecha || '';
  const match = localizedDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:,\s*(\d{1,2}):(\d{2})(?:\s*([ap])\.?\s*m\.?)?)?/i);
  if (match) {
    const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
    let hour = Number(match[4] ?? 0);
    const meridiem = match[6]?.toLowerCase();
    if (meridiem === 'p' && hour < 12) hour += 12;
    if (meridiem === 'a' && hour === 12) hour = 0;
    const parsedLocalized = new Date(year, Number(match[2]) - 1, Number(match[1]), hour, Number(match[5] ?? 0));
    if (!Number.isNaN(parsedLocalized.getTime())) return parsedLocalized;
  }

  const parsed = new Date(localizedDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function saveVenta(ventaData: {
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
}): Venta {
  const db = getDatabase();
  const articulos = ventaData.articulos.map(item => {
    const producto = findProductForArticle(db.productos, item);
    return {
      ...item,
      unidad: producto?.unidad?.trim() || item.unidad?.trim() || 'unid',
    };
  });
  const subtotal = articulos.reduce((sum, item) => sum + item.price * item.quantity, 0);

  articulos.forEach(itemVenta => {
    const producto = findProductForArticle(db.productos, itemVenta);
    if (producto) {
      producto.stockActual = Math.max(0, numberValue(producto.stockActual) - itemVenta.quantity);
    }
  });

  const usedInvoiceNumbers = new Set(db.ventas.map(venta => venta.numeroFactura));
  let invoiceSequence = db.ventas.length + 1;
  let numeroFactura = `FAC-${invoiceSequence.toString().padStart(4, '0')}`;
  while (usedInvoiceNumbers.has(numeroFactura)) {
    invoiceSequence += 1;
    numeroFactura = `FAC-${invoiceSequence.toString().padStart(4, '0')}`;
  }

  const now = new Date();
  const nuevaVenta: Venta = {
    id: Date.now().toString(),
    numeroFactura,
    cliente: ventaData.clienteNombre || 'Cliente General',
    clienteId: ventaData.clienteId || '',
    clienteNombre: ventaData.clienteNombre || 'Cliente General',
    clienteNIT: ventaData.clienteNIT || 'N/A',
    clienteDireccion: ventaData.clienteDireccion || 'Sincelejo',
    articulos,
    subtotal,
    total: subtotal,
    metodoPago: ventaData.metodoPago,
    vendedor: ventaData.vendedor?.trim() || 'Administrador',
    deudaAnterior: ventaData.deudaAnterior,
    deudaActual: ventaData.deudaActual,
    fecha: now.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }),
    fechaISO: now.toISOString(),
  };

  db.ventas.unshift(nuevaVenta);
  saveDatabase(db);
  return nuevaVenta;
}
