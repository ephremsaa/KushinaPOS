import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, X, Table2, Banknote } from 'lucide-react';
import { tablesApi, ordersApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import type { Table, TableStatus } from '../../types';

const STATUS_COLORS: Record<TableStatus, string> = {
  available: 'bg-emerald-100 border-emerald-400 text-emerald-800',
  occupied:  'bg-red-100 border-red-400 text-red-800',
  reserved:  'bg-amber-100 border-amber-400 text-amber-800',
  cleaning:  'bg-surface-100 border-surface-400 text-surface-700',
};

function TableCard({ table, onClick }: { table: Table; onClick: () => void }) {
  return (
    <button
      className={cn(
        'border-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 active:scale-95',
        STATUS_COLORS[table.status],
        table.shape === 'circle' ? 'rounded-full' : '',
      )}
      style={{ width: 90, height: 80 }}
      onClick={onClick}
    >
      <span className="font-display font-bold text-lg">{table.label}</span>
      <span className="text-xs font-medium capitalize">{table.status}</span>
      <span className="text-xs opacity-60">👥 {table.capacity}</span>
    </button>
  );
}

function TableModal({ table, onClose }: { table?: Table; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const restaurantSlug = (user?.restaurant as any)?.slug || user?.restaurantId || 'menu';
  const [form, setForm] = useState({
    label: table?.label ?? '',
    capacity: table?.capacity ?? 4,
    shape: table?.shape ?? 'rect',
    status: table?.status ?? 'available',
  });
  const [loading, setLoading] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const upd = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const { data: openOrder } = useQuery({
    queryKey: ['openOrder', table?.id],
    queryFn: () => ordersApi.openForTable(table!.id) as Promise<any>,
    enabled: !!table && table.status === 'occupied',
  });

  const staffRole = user?.staffRole ?? (user?.role === 'restaurant_owner' ? 'owner' : undefined);
  const canEditTables = ['owner', 'manager'].includes(staffRole as string);

  const qrUrl = `${window.location.origin}/r/${restaurantSlug}?table=${encodeURIComponent(table?.label || '')}`;
  const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrUrl)}`;

  const save = async () => {
    setLoading(true);
    const payload = { ...form, capacity: Number(form.capacity) };
    try {
      if (table) {
        const updatePayload = canEditTables ? payload : { status: form.status };
        await tablesApi.update(table.id, updatePayload);
      } else if (canEditTables) {
        await tablesApi.create(payload);
      }
      qc.invalidateQueries({ queryKey: ['tables'] });
    } finally {
      setLoading(false);
      onClose();
    }
  };

  const remove = async () => {
    if (!table) return;
    await tablesApi.delete(table.id);
    qc.invalidateQueries({ queryKey: ['tables'] });
    onClose();
  };

  const copyQrLink = () => {
    navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-display font-bold text-surface-900">{table ? `Table ${table.label}` : 'Add Table'}</h3>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-4 h-4" /></button>
        </div>
        <div className="modal-body space-y-4">
          {canEditTables && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Table Label</label>
                <input className="input" value={form.label} onChange={(e) => upd('label', e.target.value)} placeholder="T1, VIP-A…" />
              </div>
              <div>
                <label className="label">Capacity</label>
                <input type="number" min={1} className="input" value={form.capacity} onChange={(e) => upd('capacity', e.target.value)} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {canEditTables && (
              <div>
                <label className="label">Shape</label>
                <select className="select" value={form.shape} onChange={(e) => upd('shape', e.target.value)}>
                  <option value="rect">Rectangle</option>
                  <option value="circle">Circle</option>
                </select>
              </div>
            )}
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={(e) => upd('status', e.target.value)}>
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="reserved">Reserved</option>
                <option value="cleaning">Cleaning</option>
              </select>
            </div>
          </div>

          {/* QR Code Section for Table */}
          {table && (
            <div className="pt-3 border-t border-surface-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-surface-700">Customer QR Code</span>
                <button onClick={() => setShowQr(!showQr)} className="text-xs font-bold text-brand-600 hover:underline">
                  {showQr ? 'Hide QR Code' : 'Show QR Stand'}
                </button>
              </div>

              {showQr && (
                <div className="bg-surface-50 p-4 rounded-2xl border border-surface-200 text-center space-y-3 animate-fade-in">
                  <img src={qrImage} alt={`QR Code for Table ${table.label}`} className="w-40 h-40 mx-auto rounded-xl border border-surface-200 bg-white p-2" />
                  <p className="text-xs text-surface-500 font-mono break-all">{qrUrl}</p>
                  <div className="flex justify-center gap-2">
                    <button onClick={copyQrLink} className="btn-secondary btn-sm text-xs">
                      {copied ? 'Copied!' : 'Copy Link'}
                    </button>
                    <a href={qrImage} download={`Table-${table.label}-QR.png`} target="_blank" rel="noreferrer" className="btn-primary btn-sm text-xs">
                      Download QR
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          {table && canEditTables && <button onClick={remove} className="btn-danger btn-sm mr-auto">Delete</button>}
          {openOrder && openOrder.id && (
            <button
              onClick={() => navigate('/dashboard/checkout', { state: { orderId: openOrder.id } })}
              className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 mr-auto transition-colors"
            >
              <Banknote className="w-4 h-4" /> Checkout Table
            </button>
          )}
          <div className={openOrder ? "flex gap-2" : "flex gap-2 ml-auto"}>
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={loading || (canEditTables && !form.label)} className="btn-primary">
              {loading ? '…' : table ? 'Save' : 'Add Table'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TablesPage() {
  const { user } = useAuth();
  const restaurantId = user?.restaurant?.id ?? '';
  const staffRole = user?.staffRole ?? (user?.role === 'restaurant_owner' ? 'owner' : undefined);
  const canEditTables = ['owner', 'manager'].includes(staffRole as string);

  const [modal, setModal] = useState<{ open: boolean; table?: Table }>({ open: false });

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ['tables'],
    queryFn: async () => {
      return (await tablesApi.list()) as Table[];
    },
    refetchInterval: 10_000,
  });

  const stats = {
    available: tables.filter(t => t.status === 'available').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    reserved: tables.filter(t => t.status === 'reserved').length,
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Floor Plan</h1>
          <p className="page-subtitle">
            🟢 {stats.available} available &nbsp; 🔴 {stats.occupied} occupied &nbsp; 🟡 {stats.reserved} reserved
          </p>
        </div>
        {canEditTables && (
          <button className="btn-primary gap-2" onClick={() => setModal({ open: true })}>
            <Plus className="w-4 h-4" /> Add Table
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-6">
        {(['available', 'occupied', 'reserved', 'cleaning'] as TableStatus[]).map((s) => (
          <div key={s} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${STATUS_COLORS[s]}`}>
            <span className="w-2 h-2 rounded-full bg-current opacity-70" />
            {s}
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-wrap gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="w-24 h-20 bg-surface-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : tables.length === 0 ? (
        <div className="card text-center py-16">
          <Table2 className="w-12 h-12 text-surface-200 mx-auto mb-4" />
          <p className="text-surface-500">No tables added yet</p>
          {canEditTables && (
            <button className="btn-primary mt-4" onClick={() => setModal({ open: true })}>Add your first table</button>
          )}
        </div>
      ) : (
        <div className="card min-h-64">
          <div className="flex flex-wrap gap-4">
            {tables.map((table) => (
              <TableCard key={table.id} table={table} onClick={() => setModal({ open: true, table })} />
            ))}
          </div>
        </div>
      )}

      {modal.open && <TableModal table={modal.table} onClose={() => setModal({ open: false })} />}
    </div>
  );
}
