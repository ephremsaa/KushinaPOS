import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Table2, Banknote, QrCode, Copy,
  Check, Users, Trash2, Download, ShoppingCart, Utensils,
  Sparkles, Layers, Printer, Receipt
} from 'lucide-react';
import { tablesApi, ordersApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { cn, formatCurrency } from '../../lib/utils';
import type { Table, TableStatus } from '../../types';
import { Button, Badge, Modal, Input } from '../../components/ui';
import { TableStandModal } from '../../components/pos';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../components/ui/Toast';
import { globalConfirm } from '../../contexts/ConfirmContext';
import { assetUrl } from '../../lib/assetUrl';

const STATUS_CONFIG: Record<TableStatus, { bg: string; border: string; text: string; dot: string; label: string; badgeStatus: 'ready' | 'cancelled' | 'pending' | 'served' }> = {
  available: {
    bg: 'bg-brand-50/80 hover:bg-brand-100/80',
    border: 'border-brand-300 hover:border-brand-500',
    text: 'text-brand-800',
    dot: 'bg-brand-500 shadow-glow-sm',
    label: 'Available',
    badgeStatus: 'ready',
  },
  occupied: {
    bg: 'bg-rose-50 hover:bg-rose-100',
    border: 'border-rose-300 hover:border-rose-500',
    text: 'text-rose-800',
    dot: 'bg-rose-500 animate-pulse',
    label: 'Occupied',
    badgeStatus: 'cancelled',
  },
  reserved: {
    bg: 'bg-gold-50 hover:bg-gold-100',
    border: 'border-gold-300 hover:border-gold-500',
    text: 'text-gold-800',
    dot: 'bg-gold-500',
    label: 'Reserved',
    badgeStatus: 'pending',
  },
  cleaning: {
    bg: 'bg-surface-100 hover:bg-surface-200',
    border: 'border-surface-300 hover:border-surface-400',
    text: 'text-surface-600',
    dot: 'bg-surface-400',
    label: 'Cleaning',
    badgeStatus: 'served',
  },
};

function TableCard({ table, onClick }: { table: Table; onClick: () => void }) {
  const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.available;
  const isCircle = table.shape === 'circle';

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-center justify-between p-4 border-2 transition-all duration-200 shadow-sm hover:shadow-card hover:-translate-y-1 active:scale-95 cursor-pointer',
        cfg.bg,
        cfg.border,
        isCircle ? 'rounded-[2.5rem] aspect-square w-32' : 'rounded-3xl w-36 h-32'
      )}
    >
      <div className="flex items-center justify-between w-full">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted bg-surface/70 backdrop-blur-xs px-2 py-0.5 rounded-full border border-white/60">
          <Users className="w-3 h-3 text-surface-400" />
          {table.capacity}
        </span>
        <span className={cn('w-2.5 h-2.5 rounded-full shadow-xs', cfg.dot)} />
      </div>

      <div className="text-center my-auto">
        <span className="font-display font-black text-2xl text-primary leading-none group-hover:scale-110 transition-transform block">
          {table.label}
        </span>
        <span className={cn('text-xs font-bold capitalize mt-1 block', cfg.text)}>
          {cfg.label}
        </span>
      </div>

      <div className="w-full text-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 opacity-0 group-hover:opacity-100 transition-opacity">
          Manage →
        </span>
      </div>
    </button>
  );
}

function TableModal({
  table,
  allTables = [],
  onClose,
  onOpenStand,
}: {
  table?: Table;
  allTables?: Table[];
  onClose: () => void;
  onOpenStand?: (table: Table) => void;
}) {
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
  const [transferTargetId, setTransferTargetId] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);
  
  const confirm = useConfirm();
  const { toast } = useToast();
  const [showTransferBox, setShowTransferBox] = useState(false);
  const upd = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const { data: openOrder } = useQuery({
    queryKey: ['openOrder', table?.id],
    queryFn: () => ordersApi.openForTable(table!.id) as Promise<any>,
    enabled: !!table && table.status === 'occupied',
  });

  const staffRole = user?.staffRole ?? (user?.role === 'restaurant_owner' ? 'owner' : undefined);
  const canEditTables = ['owner', 'manager'].includes(staffRole as string);

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
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!table) return;
    if (!(await confirm(`Are you sure you want to delete Table ${table.label}?`))) return;
    await tablesApi.delete(table.id);
    qc.invalidateQueries({ queryKey: ['tables'] });
    onClose();
  };

  const handleStartOrder = () => {
    if (!table) return;
    onClose();
    navigate('/dashboard/pos', { state: { tableId: table.id, orderType: 'dine_in' } });
  };

  const handleTransferTable = async () => {
    if (!transferTargetId || !openOrder || !table) return;
    setIsTransferring(true);
    try {
      await ordersApi.update(openOrder.id, { table_id: transferTargetId });
      await tablesApi.update(table.id, { status: 'cleaning' });
      await tablesApi.update(transferTargetId, { status: 'occupied' });
      qc.invalidateQueries({ queryKey: ['tables'] });
      qc.invalidateQueries({ queryKey: ['openOrder'] });
      onClose();
    } catch (err) {
      console.error('Failed to transfer table:', err);
      toast({ type: 'error', title: 'Failed to transfer table' });
    } finally {
      setIsTransferring(false);
    }
  };

  const eligibleTransferTables = allTables.filter(t => t.id !== table?.id && (t.status === 'available' || t.status === 'reserved'));

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={table ? `Table ${table.label}` : 'Add New Table'}
      description="Floor configuration and QR self-order placement"
      icon={<Table2 className="w-5 h-5 text-brand-500" />}
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          {table && canEditTables ? (
            <Button variant="danger" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={remove}>
              Delete
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" loading={loading} onClick={save} disabled={canEditTables && !form.label}>
              {table ? 'Save Changes' : 'Create Table'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Quick Operational Action Banners */}
        {table && table.status === 'available' && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-900">Table is Free</p>
              <p className="text-xs text-emerald-700">Ready to take customer order</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<Utensils className="w-3.5 h-3.5" />}
              onClick={handleStartOrder}
            >
              Start Order
            </Button>
          </div>
        )}

        {/* Active Ticket Banner */}
        {openOrder && (
          <div className="p-4 bg-brand-500/10 border border-brand-500/20 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-extrabold text-brand-900">Active Order #{openOrder.local_id || openOrder.id.slice(0, 6)}</p>
                <p className="text-xs text-brand-700 font-bold mt-0.5">Total: {formatCurrency(openOrder.total)}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<ShoppingCart className="w-3.5 h-3.5" />}
                  onClick={() => {
                    onClose();
                    navigate('/dashboard/pos', { state: { tableId: table?.id, orderType: 'dine_in' } });
                  }}
                >
                  Add Items
                </Button>
                {staffRole === 'waiter' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Receipt className="w-3.5 h-3.5" />}
                    onClick={() => {
                      toast({ type: 'success', title: 'Bill requested (Cashier notified)' });
                      onClose();
                    }}
                  >
                    Request Bill
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Banknote className="w-3.5 h-3.5" />}
                    onClick={() => {
                      onClose();
                      navigate('/dashboard/checkout', { state: { orderId: openOrder.id } });
                    }}
                  >
                    Checkout
                  </Button>
                )}
              </div>
            </div>

            {/* Table Transfer Drawer */}
            <div className="pt-2 border-t border-brand-500/20">
              {!showTransferBox ? (
                <button
                  type="button"
                  onClick={() => setShowTransferBox(true)}
                  className="text-xs font-bold text-brand-700 hover:text-brand-900 flex items-center gap-1 cursor-pointer"
                >
                  <span>⇄ Transfer / Move Order to Another Table</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <select
                    className="select flex-1 text-xs py-1.5"
                    value={transferTargetId}
                    onChange={(e) => setTransferTargetId(e.target.value)}
                  >
                    <option value="">Select destination table...</option>
                    {eligibleTransferTables.map((et) => (
                      <option key={et.id} value={et.id}>
                        Table {et.label} ({et.capacity} seats - {et.status})
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="gold"
                    size="sm"
                    loading={isTransferring}
                    disabled={!transferTargetId}
                    onClick={handleTransferTable}
                  >
                    Transfer
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTransferBox(false)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {canEditTables && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Table Label</label>
              <Input
                value={form.label}
                onChange={(e) => upd('label', e.target.value)}
                placeholder="T1, Patio-4…"
              />
            </div>
            <div>
              <label className="label">Guest Capacity</label>
              <Input
                type="number"
                min={1}
                max={50}
                value={String(form.capacity)}
                onChange={(e) => upd('capacity', e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {canEditTables && (
            <div>
              <label className="label">Table Shape</label>
              <select className="select" value={form.shape} onChange={(e) => upd('shape', e.target.value)}>
                <option value="rect">Rectangle</option>
                <option value="circle">Circle / Round</option>
              </select>
            </div>
          )}
          <div className={!canEditTables ? 'col-span-2' : ''}>
            <label className="label">Current Status</label>
            <select className="select font-bold" value={form.status} onChange={(e) => upd('status', e.target.value)}>
              <option value="available">🟢 Available</option>
              <option value="occupied">🔴 Occupied</option>
              <option value="reserved">🟡 Reserved</option>
              <option value="cleaning">⚪ Cleaning</option>
            </select>
          </div>
        </div>

        {/* QR Stand Section for Table */}
        {table && (
          <div className="pt-3 border-t border-default/80 space-y-3">
            <div className="p-4 rounded-2xl bg-brand-50/70 border border-brand-200/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-xs">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-xs text-primary">Table Stand & QR Card</p>
                  <p className="text-[11px] text-muted">Preview & print table flyer</p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<Sparkles className="w-3.5 h-3.5 text-brand-500" />}
                onClick={() => {
                  onClose();
                  onOpenStand?.(table);
                }}
              >
                Open Stand
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function TablesPage() {
  const { user } = useAuth();
  const staffRole = user?.staffRole ?? (user?.role === 'restaurant_owner' ? 'owner' : undefined);
  const canEditTables = ['owner', 'manager'].includes(staffRole as string);

  const [modal, setModal] = useState<{ open: boolean; table?: Table }>({ open: false });
  const [standModal, setStandModal] = useState<{ open: boolean; table?: Table | null; printAll?: boolean }>({ open: false });
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ['tables'],
    queryFn: async () => {
      return (await tablesApi.list()) as Table[];
    },
    refetchInterval: 10_000,
  });

  const { data: myOrders = [] } = useQuery({
    queryKey: ['orders-my', staffRole],
    queryFn: async () => (await ordersApi.list({ status: 'active' })) as any[],
    enabled: staffRole === 'waiter',
  });

  const myTableIds = new Set(myOrders.map(o => o.table_id));

  const stats = {
    total: tables.length,
    available: tables.filter(t => t.status === 'available').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    reserved: tables.filter(t => t.status === 'reserved').length,
    myTables: tables.filter(t => myTableIds.has(t.id)).length,
  };

  const filteredTables = filterStatus === 'all'
    ? tables
    : filterStatus === 'my'
    ? tables.filter(t => myTableIds.has(t.id))
    : tables.filter(t => t.status === filterStatus);

  const filterTabs = [
    { id: 'all', label: 'All Tables', count: stats.total },
    ...(staffRole === 'waiter' ? [{ id: 'my', label: 'My Tables', count: stats.myTables }] : []),
    { id: 'available', label: 'Available', count: stats.available },
    { id: 'occupied', label: 'Occupied', count: stats.occupied },
    { id: 'reserved', label: 'Reserved', count: stats.reserved },
  ];

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="page-header bg-surface/60 p-6 rounded-3xl backdrop-blur-sm border border-white/80 shadow-card">
        <div>
          <h1 className="page-title">Dining Room Floor Plan</h1>
          <p className="page-subtitle">Real-time table status, seating capacity, and QR self-order placement</p>
        </div>
        <div className="flex items-center gap-3">
          {tables.length > 0 && (
            <Button
              variant="secondary"
              icon={<Printer className="w-4 h-4 text-brand-500" />}
              onClick={() => setStandModal({ open: true, printAll: true })}
            >
              Print All Table Stands ({tables.length})
            </Button>
          )}
          {canEditTables && (
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setModal({ open: true })}>
              Add Table
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-surface/80 p-1.5 rounded-2xl border border-default/80 shadow-xs">
          {filterTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer',
                filterStatus === tab.id
                  ? 'bg-surface-900 text-white shadow-sm'
                  : 'text-surface-600 hover:text-primary hover:bg-surface-100'
              )}
            >
              <span>{tab.label}</span>
              <span className="ml-1.5 opacity-60 font-mono">({tab.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tables Grid Layout */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-32 bg-surface/60 rounded-3xl animate-pulse border border-default/60" />
          ))}
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="card text-center py-20">
          <div className="w-20 h-20 bg-surface-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Table2 className="w-10 h-10 text-surface-400" />
          </div>
          <h3 className="font-display font-bold text-lg text-primary">No tables in this view</h3>
          <p className="text-surface-400 text-xs mt-1">Change your filter or add new tables to customize your floor layout.</p>
          {canEditTables && (
            <Button variant="primary" className="mt-5" onClick={() => setModal({ open: true })}>
              Add First Table
            </Button>
          )}
        </div>
      ) : (
        <div className="card bg-surface/70 backdrop-blur-xl border border-white/80 p-8 shadow-card-premium">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
            {filteredTables.map((table) => (
              <TableCard key={table.id} table={table} onClick={() => setModal({ open: true, table })} />
            ))}
          </div>
        </div>
      )}

      {modal.open && (
        <TableModal
          table={modal.table}
          allTables={tables}
          onClose={() => setModal({ open: false })}
          onOpenStand={(t) => setStandModal({ open: true, table: t, printAll: false })}
        />
      )}

      {/* ── Table Stand Generator Modal ──────────────────────── */}
      {standModal.open && (
        <TableStandModal
          table={standModal.table}
          allTables={tables}
          restaurantName={(user?.restaurant as any)?.name ?? user?.restaurantName ?? 'Restaurant'}
          restaurantLogo={assetUrl((user?.restaurant as any)?.logo_url)}
          restaurantSlug={(user?.restaurant as any)?.slug ?? user?.restaurantId ?? 'menu'}
          themeColor={(user?.restaurant as any)?.theme_color ?? '#2F7D32'}
          onClose={() => setStandModal({ open: false })}
        />
      )}
    </div>
  );
}
