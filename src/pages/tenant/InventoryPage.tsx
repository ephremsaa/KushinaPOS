import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, X, AlertTriangle, Package, TrendingDown, TrendingUp, Search,
  Truck, ArrowRightLeft, Clock, MapPin, Mail, Phone, Edit2, Trash2, Check, AlertCircle, FileText, Printer
} from 'lucide-react';
import { inventoryApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { cn, formatCurrency, formatDateTime } from '../../lib/utils';
import { PurchaseOrderModal } from '../../components/pos';
import type { InventoryItem, InventoryTransaction, Supplier } from '../../types';
import { globalConfirm } from '../../contexts/ConfirmContext';

// ─── Item Form Panel ─────────────────────────────────────────────────────────

function ItemPanel({
  item, suppliers, onClose, onSaved
}: {
  item?: InventoryItem; suppliers: Supplier[]; onClose: () => void; onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: item?.name ?? '',
    unit: item?.unit ?? 'pcs',
    quantity: item?.quantity ?? 0,
    low_stock_threshold: item?.low_stock_threshold ?? 5,
    cost_per_unit: item?.cost_per_unit ?? 0,
    supplier_id: item?.supplier_id ?? '',
  });
  const [txDelta, setTxDelta] = useState(0);
  const [txType, setTxType] = useState<'restock' | 'adjustment' | 'waste'>('restock');
  const [txNote, setTxNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'details' | 'adjust' | 'history'>('details');

  const { data: transactions = [] } = useQuery({
    queryKey: ['inventory-transactions', item?.id],
    queryFn: () => inventoryApi.transactions(item!.id) as Promise<InventoryTransaction[]>,
    enabled: !!item && tab === 'history',
  });

  const upd = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name) { setError('Name is required'); return; }
    setSaving(true); setError('');
    const payload = { ...form, quantity: Number(form.quantity), low_stock_threshold: Number(form.low_stock_threshold), cost_per_unit: Number(form.cost_per_unit) };
    try {
      if (item && tab === 'adjust' && txDelta !== 0) {
        await inventoryApi.adjust(item.id, {
          type: txType,
          quantity_delta: txType === 'waste' ? -Math.abs(txDelta) : txDelta,
          note: txNote
        });
      } else if (item && tab === 'details') {
        await inventoryApi.update(item.id, payload);
      } else if (!item) {
        await inventoryApi.create(payload);
      }
      qc.invalidateQueries({ queryKey: ['inventory'] });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!item) return;
    if (!(await globalConfirm(`Delete "${item.name}"? This removes it from recipes too.`))) return;
    await inventoryApi.delete(item.id);
    qc.invalidateQueries({ queryKey: ['inventory'] });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-surface shadow-2xl flex flex-col h-full animate-slide-up overflow-hidden"
        style={{ borderRadius: '2rem 0 0 2rem' }}>
        
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-surface-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-xl text-primary">
              {item ? item.name : 'New Inventory Item'}
            </h3>
            <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-full"><X className="w-5 h-5 text-surface-400" /></button>
          </div>
          {item && (
            <div className="flex gap-1 bg-surface-100 rounded-2xl p-1">
              {[
                { k: 'details', l: 'Details', i: Edit2 },
                { k: 'adjust', l: 'Adjust Stock', i: ArrowRightLeft },
                { k: 'history', l: 'History', i: Clock }
              ].map(t => (
                <button key={t.k} onClick={() => setTab(t.k as any)}
                  className={cn('flex-1 py-2 rounded-xl text-xs font-bold transition-all flex justify-center items-center gap-1.5',
                    tab === t.k ? 'bg-surface shadow-sm text-primary' : 'text-muted hover:text-surface-700')}>
                  <t.i className="w-3.5 h-3.5" /> {t.l}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {tab === 'details' && (
            <>
              <div>
                <label className="label">Item name *</label>
                <input className="input" value={form.name} onChange={e => upd('name', e.target.value)} placeholder="e.g. Tomatoes" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Unit</label>
                  <input className="input" value={form.unit} onChange={e => upd('unit', e.target.value)} placeholder="kg, L, pcs" />
                </div>
                {!item && (
                  <div>
                    <label className="label">Opening stock</label>
                    <input type="number" className="input" value={form.quantity} onChange={e => upd('quantity', e.target.value)} />
                  </div>
                )}
                <div>
                  <label className="label">Low stock alert</label>
                  <input type="number" className="input" value={form.low_stock_threshold} onChange={e => upd('low_stock_threshold', e.target.value)} />
                </div>
                <div>
                  <label className="label">Cost per unit (ETB)</label>
                  <input type="number" className="input" value={form.cost_per_unit} onChange={e => upd('cost_per_unit', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><Truck className="w-3 h-3" /> Supplier (Optional)</label>
                <select className="select" value={form.supplier_id} onChange={e => upd('supplier_id', e.target.value)}>
                  <option value="">None</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </>
          )}

          {tab === 'adjust' && item && (
            <>
              <div className="p-4 bg-surface-50 rounded-2xl border border-surface-100 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted font-semibold mb-1">Current Stock</p>
                  <p className="font-bold text-primary text-2xl">{item.quantity} <span className="text-sm font-normal text-muted">{item.unit}</span></p>
                </div>
                <Package className="w-10 h-10 text-surface-200" />
              </div>

              <div>
                <label className="label">Adjustment Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['restock', 'adjustment', 'waste'] as const).map(t => (
                    <button key={t} onClick={() => setTxType(t)}
                      className={cn('py-2 rounded-xl text-xs font-bold transition-all capitalize border-2',
                        txType === t ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-default text-surface-600')}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">{txType === 'waste' ? 'Waste Amount' : 'Quantity to Add / Change'}</label>
                <div className="relative">
                  <input type="number" className="input pr-12 text-lg font-bold" value={txDelta || ''} onChange={e => setTxDelta(Number(e.target.value))} placeholder="0" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400 font-semibold">{item.unit}</span>
                </div>
                <p className="text-xs text-surface-400 mt-1.5">
                  {txType === 'waste' ? 'This amount will be subtracted from current stock.' : 'Use negative numbers to manually subtract stock if adjustment.'}
                </p>
              </div>

              <div>
                <label className="label flex items-center gap-1.5"><FileText className="w-3 h-3" /> Note (Optional)</label>
                <input className="input text-sm" value={txNote} onChange={e => setTxNote(e.target.value)} placeholder="Reason for adjustment" />
              </div>
            </>
          )}

          {tab === 'history' && item && (
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <div className="text-center py-10 text-surface-400">No transactions recorded yet.</div>
              ) : (
                transactions.map(tx => (
                  <div key={tx.id} className="p-3 bg-surface-50 border border-surface-100 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
                          tx.type === 'restock' ? 'bg-emerald-100 text-emerald-700' :
                          tx.type === 'waste' ? 'bg-red-100 text-red-700' :
                          tx.type === 'order_usage' ? 'bg-amber-100 text-amber-700' : 'bg-surface-200 text-surface-700'
                        )}>{tx.type.replace('_', ' ')}</span>
                        <span className="text-xs text-muted">{formatDateTime(tx.created_at)}</span>
                      </div>
                      {tx.note && <p className="text-xs text-surface-600 mt-1 italic">"{tx.note}"</p>}
                    </div>
                    <span className={cn('font-bold text-sm', Number(tx.quantity_delta) > 0 ? 'text-emerald-600' : 'text-red-500')}>
                      {Number(tx.quantity_delta) > 0 ? '+' : ''}{Number(tx.quantity_delta)} {item.unit}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-100 flex items-center gap-3 flex-shrink-0">
          {item && tab === 'details' && (
            <button onClick={remove} className="text-sm font-semibold text-red-500 hover:text-red-700 mr-auto">Delete Item</button>
          )}
          {tab !== 'history' && (
            <>
              <button onClick={onClose} className="btn-secondary ml-auto">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary gap-2 min-w-[100px]">
                {saving ? '…' : tab === 'adjust' ? 'Confirm Adjustment' : 'Save Details'}
              </button>
            </>
          )}
          {tab === 'history' && <button onClick={onClose} className="btn-primary w-full">Done</button>}
        </div>
      </div>
    </div>
  );
}

// ─── Supplier Form Panel ──────────────────────────────────────────────────────

function SupplierPanel({ supplier, onClose, onSaved }: { supplier?: Supplier; onClose: () => void; onSaved: () => void; }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: supplier?.name ?? '', contact_name: supplier?.contact_name ?? '',
    phone: supplier?.phone ?? '', email: supplier?.email ?? '',
    address: supplier?.address ?? '', notes: supplier?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      if (supplier) await inventoryApi.updateSupplier(supplier.id, form);
      else await inventoryApi.createSupplier(form);
      qc.invalidateQueries({ queryKey: ['inventory-suppliers'] });
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-sm bg-surface shadow-2xl flex flex-col h-full animate-slide-up" style={{ borderRadius: '2rem 0 0 2rem' }}>
        <div className="px-6 py-5 border-b border-surface-100 flex items-center justify-between">
          <h3 className="font-display font-bold text-xl text-primary">{supplier ? 'Edit Supplier' : 'New Supplier'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-full"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div><label className="label">Company Name *</label><input className="input" value={form.name} onChange={e => upd('name', e.target.value)} /></div>
          <div><label className="label">Contact Person</label><input className="input" value={form.contact_name} onChange={e => upd('contact_name', e.target.value)} /></div>
          <div><label className="label flex items-center gap-1"><Phone className="w-3 h-3"/> Phone</label><input className="input" value={form.phone} onChange={e => upd('phone', e.target.value)} /></div>
          <div><label className="label flex items-center gap-1"><Mail className="w-3 h-3"/> Email</label><input type="email" className="input" value={form.email} onChange={e => upd('email', e.target.value)} /></div>
          <div><label className="label flex items-center gap-1"><MapPin className="w-3 h-3"/> Address</label><textarea className="input min-h-[60px]" value={form.address} onChange={e => upd('address', e.target.value)} /></div>
          <div><label className="label">Notes</label><textarea className="input min-h-[60px]" value={form.notes} onChange={e => upd('notes', e.target.value)} /></div>
        </div>
        <div className="px-6 py-4 flex gap-3 border-t border-surface-100">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={save} disabled={saving || !form.name} className="btn-primary flex-1">{saving ? '…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Inventory Page ──────────────────────────────────────────────────────

export default function InventoryPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'items' | 'suppliers'>('items');
  const [search, setSearch] = useState('');
  const [panelItem, setPanelItem] = useState<{ open: boolean; item?: InventoryItem }>({ open: false });
  const [panelSupplier, setPanelSupplier] = useState<{ open: boolean; supplier?: Supplier }>({ open: false });
  const [showPurchaseOrder, setShowPurchaseOrder] = useState(false);

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryApi.list() as Promise<InventoryItem[]>,
  });

  const { data: suppliers = [], isLoading: suppLoading } = useQuery({
    queryKey: ['inventory-suppliers'],
    queryFn: () => inventoryApi.getSuppliers() as Promise<Supplier[]>,
  });

  const filteredItems = useMemo(() => items.filter(i => !search.trim() || i.name.toLowerCase().includes(search.toLowerCase())), [items, search]);
  const filteredSuppliers = useMemo(() => suppliers.filter(s => !search.trim() || s.name.toLowerCase().includes(search.toLowerCase())), [suppliers, search]);
  const lowStockItems = items.filter(i => i.quantity <= i.low_stock_threshold);

  return (
    <>
      {panelItem.open && <ItemPanel item={panelItem.item} suppliers={suppliers} onClose={() => setPanelItem({ open: false })} onSaved={() => setPanelItem({ open: false })} />}
      {panelSupplier.open && <SupplierPanel supplier={panelSupplier.supplier} onClose={() => setPanelSupplier({ open: false })} onSaved={() => setPanelSupplier({ open: false })} />}

      <div className="animate-fade-in space-y-6">
        <div className="page-header bg-surface/40 p-5 rounded-[2rem] backdrop-blur-sm border border-white/60 shadow-sm flex-wrap gap-4">
          <div>
            <h1 className="page-title flex items-center gap-2"><Package className="w-6 h-6 text-brand-500" /> Inventory & Stock</h1>
            <p className="page-subtitle">
              {items.length} items · {suppliers.length} suppliers 
              {lowStockItems.length > 0 && <span className="ml-2 text-red-500 font-bold">· {lowStockItems.length} low stock</span>}
            </p>
          </div>
          <div className="flex gap-2 bg-surface/50 p-1 rounded-2xl border border-default">
            <button onClick={() => setTab('items')} className={cn('px-4 py-2 rounded-xl text-sm font-bold transition-all', tab === 'items' ? 'bg-surface shadow-sm text-primary' : 'text-muted')}>Items</button>
            <button onClick={() => setTab('suppliers')} className={cn('px-4 py-2 rounded-xl text-sm font-bold transition-all', tab === 'suppliers' ? 'bg-surface shadow-sm text-primary' : 'text-muted')}>Suppliers</button>
          </div>
          <div className="flex items-center gap-2">
            {lowStockItems.length > 0 && (
              <button
                onClick={() => setShowPurchaseOrder(true)}
                className="btn-secondary gap-1.5 border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100"
              >
                <Truck className="w-4 h-4 text-amber-600" />
                Reorder Sheet ({lowStockItems.length})
              </button>
            )}
            <button className="btn-primary gap-2" onClick={() => tab === 'items' ? setPanelItem({ open: true }) : setPanelSupplier({ open: true })}>
              <Plus className="w-4 h-4" /> Add {tab === 'items' ? 'Item' : 'Supplier'}
            </button>
          </div>
        </div>

        {tab === 'items' && lowStockItems.length > 0 && !search && (
          <div className="bg-red-50 border border-red-200 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="font-bold text-red-800">Low Stock Alerts</h3>
              </div>
              <button
                onClick={() => setShowPurchaseOrder(true)}
                className="text-xs font-bold text-red-700 hover:text-red-900 flex items-center gap-1 cursor-pointer bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-xl transition-colors"
              >
                <Printer className="w-3.5 h-3.5" /> Generate Purchase Reorder Sheet
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              {lowStockItems.map(item => (
                <div key={item.id} onClick={() => setPanelItem({ open: true, item })}
                  className="bg-surface border border-red-100 rounded-2xl px-4 py-2.5 flex items-center gap-4 cursor-pointer hover:border-red-300 transition-colors shadow-sm">
                  <div>
                    <p className="font-bold text-sm text-primary">{item.name}</p>
                    <p className="text-xs text-muted">Threshold: {item.low_stock_threshold}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-red-600 text-lg leading-tight">{item.quantity} <span className="text-xs font-normal">{item.unit}</span></p>
                    {item.quantity <= 0 && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Out of stock</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="relative max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input className="input pl-10 w-full" placeholder={`Search ${tab}…`} value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {tab === 'items' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {itemsLoading ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-32 bg-surface-100 rounded-3xl animate-pulse" />) :
             filteredItems.length === 0 ? <div className="col-span-full text-center py-20 text-surface-400 font-semibold">No items found</div> :
             filteredItems.map(item => {
               const isLow = item.quantity <= item.low_stock_threshold;
               const isZero = Number(item.quantity) <= 0;
               return (
                 <div key={item.id} onClick={() => setPanelItem({ open: true, item })}
                   className={cn('bg-surface rounded-3xl border-2 p-5 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 group',
                     isZero ? 'border-red-200 bg-red-50/30' : isLow ? 'border-amber-200' : 'border-default hover:border-brand-200')}>
                   <div className="flex justify-between items-start mb-4">
                     <div>
                       <p className="font-bold text-primary leading-tight">{item.name}</p>
                       <p className="text-xs text-surface-400 flex items-center gap-1 mt-0.5"><Truck className="w-3 h-3" /> {item.supplier_name || 'No supplier'}</p>
                     </div>
                     {isZero ? (
                       <span className="badge-red font-bold text-[10px] uppercase tracking-widest shadow-sm">Empty</span>
                     ) : isLow ? (
                       <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Low</span>
                     ) : (
                       <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold text-[10px]">OK</span>
                     )}
                   </div>
                   <div className="flex items-end justify-between mt-auto">
                     <div>
                       <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-widest">In Stock</p>
                       <p className={cn('text-2xl font-extrabold leading-none', isZero ? 'text-red-500' : isLow ? 'text-amber-600' : 'text-primary')}>
                         {item.quantity} <span className="text-sm font-normal text-muted">{item.unit}</span>
                       </p>
                     </div>
                     <p className="text-xs font-semibold text-brand-600">{item.cost_per_unit ? `${formatCurrency(item.cost_per_unit)}/${item.unit}` : '—'}</p>
                   </div>
                 </div>
               );
             })}
          </div>
        )}

        {tab === 'suppliers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {suppLoading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-surface-100 rounded-3xl animate-pulse" />) :
             filteredSuppliers.length === 0 ? <div className="col-span-full text-center py-20 text-surface-400 font-semibold">No suppliers found</div> :
             filteredSuppliers.map(s => {
               const suppliedItemsCount = items.filter(i => i.supplier_id === s.id).length;
               return (
                 <div key={s.id} onClick={() => setPanelSupplier({ open: true, supplier: s })}
                   className="bg-surface rounded-3xl border-2 border-default p-5 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-brand-200 group">
                   <div className="flex items-center gap-3 mb-3">
                     <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600"><Truck className="w-5 h-5" /></div>
                     <div><p className="font-bold text-primary">{s.name}</p></div>
                   </div>
                   <div className="space-y-1.5">
                     {s.contact_name && <p className="text-xs text-muted flex items-center gap-1.5"><span className="w-4 inline-block text-center">👤</span> {s.contact_name}</p>}
                     {s.phone && <p className="text-xs text-muted flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-surface-400" /> {s.phone}</p>}
                     {s.email && <p className="text-xs text-muted flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-surface-400" /> {s.email}</p>}
                   </div>
                   <div className="mt-4 pt-3 border-t border-surface-100">
                     <p className="text-xs font-semibold text-brand-600 bg-brand-50 inline-block px-2 py-1 rounded-lg">Supplies {suppliedItemsCount} item{suppliedItemsCount !== 1 ? 's' : ''}</p>
                   </div>
                 </div>
               );
             })}
          </div>
        )}
      </div>

      {showPurchaseOrder && (
        <PurchaseOrderModal
          items={items}
          suppliers={suppliers}
          restaurantName={(user?.restaurant as any)?.name ?? user?.restaurantName ?? 'Restaurant'}
          onClose={() => setShowPurchaseOrder(false)}
        />
      )}
    </>
  );
}
