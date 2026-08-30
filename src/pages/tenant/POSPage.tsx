import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, Minus, ShoppingCart, Table2, X, Check,
  Wifi, WifiOff, Trash2, ChevronRight, MessageSquare, Clock,
  PauseCircle, PlayCircle, Tag, AlertCircle, ChefHat, ArrowLeft, Banknote
} from 'lucide-react';
import { menuApi, tablesApi, ordersApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { formatCurrency, generateId, cn } from '../../lib/utils';
import type {
  MenuItem, MenuCategory, Table, OrderItem,
  ModifierChoice, TableStatus, MenuModifier, Order
} from '../../types';

// ─── Local Types ────────────────────────────────────────────────────────────

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  modifierChoices: ModifierChoice[];
  notes: string;
  lineTotal: number;
}

interface ParkedOrder {
  id: string;
  label: string;
  cart: CartItem[];
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  tableId: string;
  customerName: string;
  discount: number;
  parkedAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PARK_KEY = 'pos_parked_orders';

const STATUS_COLORS: Record<TableStatus, string> = {
  available: 'bg-emerald-100 border-emerald-400 text-emerald-800',
  occupied:  'bg-red-100   border-red-400   text-red-800',
  reserved:  'bg-amber-100 border-amber-400  text-amber-800',
  cleaning:  'bg-surface-100 border-surface-400 text-surface-700',
};

// ─── Modifier Modal ──────────────────────────────────────────────────────────

function ModifierModal({
  item,
  onConfirm,
  onClose,
}: {
  item: MenuItem;
  onConfirm: (choices: ModifierChoice[], notes: string) => void;
  onClose: () => void;
}) {
  const modifiers: MenuModifier[] = item.menu_modifiers ?? [];
  const [selections, setSelections] = useState<Record<string, ModifierChoice>>({});
  const [notes, setNotes] = useState('');

  const toggle = (mod: MenuModifier, optLabel: string, priceDelta: number) => {
    setSelections(prev => {
      const key = mod.id;
      if (prev[key]?.option_label === optLabel) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return {
        ...prev,
        [key]: {
          modifier_id: mod.id,
          modifier_name: mod.name,
          option_label: optLabel,
          price_delta: priceDelta,
        },
      };
    });
  };

  const requiredMissing = modifiers
    .filter(m => m.is_required)
    .some(m => !selections[m.id]);

  const extraCost = Object.values(selections).reduce((s, c) => s + c.price_delta, 0);

  const confirm = () => {
    if (requiredMissing) return;
    onConfirm(Object.values(selections), notes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
        <div className="p-6 border-b border-surface-100 flex items-start gap-4">
          <div className="flex-1">
            <h3 className="font-display font-bold text-xl text-surface-900">{item.name}</h3>
            <p className="text-brand-600 font-bold mt-1">
              {formatCurrency(item.price + extraCost)}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-surface-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {modifiers.map(mod => (
            <div key={mod.id}>
              <div className="flex items-center gap-2 mb-3">
                <p className="font-bold text-surface-800 text-sm">{mod.name}</p>
                {mod.is_required && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">Required</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {mod.options.map(opt => {
                  const selected = selections[mod.id]?.option_label === opt.label;
                  return (
                    <button
                      key={opt.label}
                      onClick={() => toggle(mod, opt.label, opt.price_delta)}
                      className={cn(
                        'px-4 py-2 rounded-2xl text-sm font-semibold border-2 transition-all duration-200',
                        selected
                          ? 'bg-brand-500 border-brand-500 text-white shadow-sm shadow-brand-500/30 scale-105'
                          : 'bg-surface-50 border-surface-200 text-surface-700 hover:border-brand-300'
                      )}
                    >
                      {opt.label}
                      {opt.price_delta !== 0 && (
                        <span className={cn('ml-1.5 text-xs font-bold', selected ? 'text-white/80' : 'text-surface-400')}>
                          +{formatCurrency(opt.price_delta)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Notes */}
          <div>
            <p className="font-bold text-surface-800 text-sm mb-2">Chef's Notes (optional)</p>
            <textarea
              className="textarea resize-none text-sm"
              rows={2}
              placeholder="e.g. No onions, extra spicy…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="p-6 border-t border-surface-100 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={confirm}
            disabled={requiredMissing}
            className="btn-primary flex-1 gap-2"
          >
            <Plus className="w-4 h-4" /> Add to Order
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Table Selection Screen ──────────────────────────────────────────────────

function TableSelectionScreen({
  tables,
  orderType,
  setOrderType,
  onSelectTable,
  onSkip, // for takeaway/delivery
}: {
  tables: Table[];
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  setOrderType: (t: 'dine_in' | 'takeaway' | 'delivery') => void;
  onSelectTable: (tableId: string) => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex flex-col items-center pt-10 h-full animate-fade-in overflow-y-auto pb-10">
      <h2 className="font-display font-bold text-3xl mb-8 text-surface-900">Start New Order</h2>

      {/* Order Type Selector */}
      <div className="flex gap-2 p-1.5 bg-surface-200/50 backdrop-blur-sm rounded-2xl mb-10 border border-surface-200">
        {(['dine_in', 'takeaway', 'delivery'] as const).map(type => (
          <button
            key={type}
            className={cn(
              'px-8 py-3 rounded-xl text-sm font-bold capitalize transition-all duration-300',
              orderType === type
                ? 'bg-white shadow-md text-brand-600 border border-white'
                : 'text-surface-500 hover:text-surface-800'
            )}
            onClick={() => setOrderType(type)}
          >
            {type === 'dine_in' ? '🍽️ Dine In' : type === 'takeaway' ? '🛍️ Takeaway' : '🛵 Delivery'}
          </button>
        ))}
      </div>

      {orderType !== 'dine_in' ? (
        <div className="flex flex-col items-center gap-6">
          <div className="w-24 h-24 bg-brand-50 rounded-full flex items-center justify-center text-5xl">
            {orderType === 'takeaway' ? '🛍️' : '🛵'}
          </div>
          <p className="text-surface-600 font-medium">No table needed for {orderType} orders.</p>
          <button className="btn-primary px-10 gap-2" onClick={onSkip}>
            Proceed to Menu <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="w-full max-w-4xl px-4">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-bold text-xl text-surface-800">Select a Table</h3>
            <div className="flex gap-3">
              {(['available', 'occupied', 'reserved'] as TableStatus[]).map(s => (
                <div key={s} className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${STATUS_COLORS[s]}`}>
                  <span className="w-2 h-2 rounded-full bg-current opacity-70" />
                  {s}
                </div>
              ))}
            </div>
          </div>

          <div className="card glass-panel flex flex-wrap gap-4 justify-center min-h-[300px] p-8">
            {tables.length === 0 ? (
              <p className="text-surface-500 my-auto">No tables configured.</p>
            ) : (
              tables.map(table => (
                <button
                  key={table.id}
                  className={cn(
                    'border-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 active:scale-95',
                    STATUS_COLORS[table.status],
                    table.shape === 'circle' ? 'rounded-full' : '',
                    table.status === 'reserved' || table.status === 'cleaning'
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer'
                  )}
                  style={{ width: 100, height: 90 }}
                  onClick={() => onSelectTable(table.id)}
                  disabled={table.status === 'reserved' || table.status === 'cleaning'}
                >
                  <span className="font-display font-bold text-lg">{table.label}</span>
                  <span className="text-xs font-medium capitalize">{table.status}</span>
                  <span className="text-xs opacity-60">👥 {table.capacity}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Occupied Table Modal ─────────────────────────────────────────────────────

function OccupiedTableModal({
  table,
  existingOrder,
  onAddToExisting,
  onNewOrder,
  onClose,
}: {
  table: Table;
  existingOrder: Order;
  onAddToExisting: () => void;
  onNewOrder: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2rem] w-full max-w-sm shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-surface-900">Table {table.label} is Occupied</h3>
            <p className="text-sm text-surface-500">An order is already open for this table.</p>
          </div>
        </div>

        <div className="bg-surface-50 rounded-2xl p-4 mb-5 text-sm">
          <p className="font-semibold text-surface-700 mb-1">Current Order</p>
          <p className="text-surface-500">{existingOrder.order_items?.length ?? 0} item(s) · {formatCurrency(existingOrder.total)}</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onAddToExisting}
            className="btn-primary w-full gap-2 justify-center"
          >
            <Plus className="w-4 h-4" /> Add to Existing Order
          </button>
          <button
            onClick={onNewOrder}
            className="btn-secondary w-full gap-2 justify-center"
          >
            <ShoppingCart className="w-4 h-4" /> Start New Order Anyway
          </button>
          <button onClick={onClose} className="text-sm text-surface-500 hover:text-surface-700 text-center py-1">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
// ─── Main POS Component ───────────────────────────────────────────────────────

export default function POSPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isOnline, setPendingSyncCount } = useNetwork();
  const qc = useQueryClient();
  const restaurantId = user?.restaurant?.id ?? '';
  const taxRate = Number(user?.restaurant?.tax_rate ?? 0);

  // ── Core state ────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [discount, setDiscount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // ── Modifier modal ────────────────────────────────────────────
  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);

  // ── Occupied table modal ──────────────────────────────────────
  const [occupiedModal, setOccupiedModal] = useState<{ table: Table; existingOrder: Order } | null>(null);
  const [existingOrderId, setExistingOrderId] = useState<string | null>(null); // track if we're adding to existing

  // ── Parked orders ─────────────────────────────────────────────
  const [parkedOrders, setParkedOrders] = useState<ParkedOrder[]>(() => {
    try { return JSON.parse(localStorage.getItem(PARK_KEY) ?? '[]'); } catch { return []; }
  });
  const [showParked, setShowParked] = useState(false);

  // ── Notes editing ─────────────────────────────────────────────
  const [editingNoteIdx, setEditingNoteIdx] = useState<number | null>(null);

  // ── Data fetching ─────────────────────────────────────────────
  const { data: categories = [] } = useQuery({
    queryKey: ['menu-categories'],
    queryFn: () => menuApi.getCategories() as Promise<MenuCategory[]>,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu-items'],
    queryFn: () => menuApi.getItems() as Promise<MenuItem[]>,
    refetchInterval: 15_000, // Refresh every 15s to catch 86'd items
  });

  const { data: tables = [] } = useQuery({
    queryKey: ['tables'],
    queryFn: () => tablesApi.list() as Promise<Table[]>,
    refetchInterval: 15_000,
  });

  // ── Derived values ────────────────────────────────────────────
  const filtered = menuItems.filter(item => {
    const matchesCat = selectedCategory === 'all' || item.category_id === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const subtotal = cart.reduce((s, i) => s + i.lineTotal, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount - discount;

  // ── Park & restore helpers ────────────────────────────────────
  const saveParked = (orders: ParkedOrder[]) => {
    setParkedOrders(orders);
    localStorage.setItem(PARK_KEY, JSON.stringify(orders));
  };

  const holdOrder = () => {
    if (cart.length === 0) return;
    const tableLabel = tables.find(t => t.id === selectedTable)?.label;
    const label = orderType === 'dine_in' && tableLabel
      ? `Table ${tableLabel}`
      : customerName || orderType;

    const parked: ParkedOrder = {
      id: generateId(),
      label,
      cart,
      orderType,
      tableId: selectedTable,
      customerName,
      discount,
      parkedAt: new Date().toISOString(),
    };
    saveParked([...parkedOrders, parked]);
    resetOrder();
  };

  const resumeParked = (p: ParkedOrder) => {
    setCart(p.cart);
    setOrderType(p.orderType);
    setSelectedTable(p.tableId);
    setCustomerName(p.customerName);
    setDiscount(p.discount);
    // Remove from parked
    saveParked(parkedOrders.filter(o => o.id !== p.id));
    setShowParked(false);
  };

  const deleteParked = (id: string) => {
    saveParked(parkedOrders.filter(o => o.id !== id));
  };

  // ── Cart helpers ──────────────────────────────────────────────
  const addToCart = (item: MenuItem, choices: ModifierChoice[], notes: string) => {
    const extraCost = choices.reduce((s, c) => s + c.price_delta, 0);
    const unitPrice = item.price + extraCost;

    setCart(prev => {
      // Only merge if same item and no modifier choices (simple items)
      if (choices.length === 0) {
        const existing = prev.find(c => c.menuItem.id === item.id && c.modifierChoices.length === 0);
        if (existing) {
          return prev.map(c =>
            c === existing
              ? { ...c, quantity: c.quantity + 1, lineTotal: (c.quantity + 1) * unitPrice }
              : c
          );
        }
      }
      return [...prev, { menuItem: item, quantity: 1, modifierChoices: choices, notes, lineTotal: unitPrice }];
    });
  };

  const handleItemTap = (item: MenuItem) => {
    if (!item.is_available) return;
    const hasModifiers = (item.menu_modifiers ?? []).length > 0;
    if (hasModifiers) {
      setModifierItem(item);
    } else {
      addToCart(item, [], '');
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart(prev => {
      const updated = [...prev];
      const it = { ...updated[index] };
      it.quantity = Math.max(0, it.quantity + delta);
      if (it.quantity === 0) {
        updated.splice(index, 1);
      } else {
        const extraCost = it.modifierChoices.reduce((s, m) => s + m.price_delta, 0);
        it.lineTotal = it.quantity * (it.menuItem.price + extraCost);
        updated[index] = it;
      }
      return updated;
    });
  };

  const updateNote = (index: number, note: string) => {
    setCart(prev => prev.map((c, i) => i === index ? { ...c, notes: note } : c));
  };

  const resetOrder = () => {
    setCart([]);
    setSelectedTable('');
    setCustomerName('');
    setDiscount(0);
    setExistingOrderId(null);
    setEditingNoteIdx(null);
  };

  const clearOrder = () => {
    if (window.confirm('Clear entire order and start over?')) {
      setOrderType('dine_in');
      resetOrder();
    }
  };

  // ── Table selection flow ──────────────────────────────────────
  const handleSelectTable = async (tableId: string) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    if (table.status === 'occupied') {
      // Check for open order
      try {
        const openOrder = await ordersApi.openForTable(tableId) as Order | null;
        if (openOrder) {
          setOccupiedModal({ table, existingOrder: openOrder });
          return;
        }
      } catch (e) { /* continue */ }
    }

    setSelectedTable(tableId);
  };

  // ── Order placement ───────────────────────────────────────────
  const placeOrder = async (checkoutImmediately = false) => {
    if (cart.length === 0) return;
    setSubmitting(true);

    const items = cart.map(c => ({
      menu_item_id: c.menuItem.id,
      menu_item_name: c.menuItem.name,
      quantity: c.quantity,
      unit_price: c.menuItem.price,
      modifier_choices: c.modifierChoices,
      notes: c.notes || null,
    }));

    const totals = { subtotal, tax_amount: taxAmount, discount_amount: discount, total };

    try {
      let resultingOrderId = existingOrderId;
      
      if (existingOrderId) {
        // Adding to an existing open order
        await ordersApi.addItems(existingOrderId, { items, ...totals });
      } else {
        const localId = generateId();
        const payload = {
          restaurant_id: restaurantId,
          table_id: selectedTable && selectedTable !== '__skip__' ? selectedTable : null,
          order_type: orderType,
          status: 'new',
          ...totals,
          customer_name: customerName || null,
          local_id: localId,
          synced_at: isOnline ? new Date().toISOString() : null,
          items,
        };

        if (isOnline) {
          const res = await ordersApi.create(payload) as any;
          resultingOrderId = res?.id;
        } else {
          const pending = JSON.parse(sessionStorage.getItem('pendingOrders') ?? '[]');
          pending.push(payload);
          sessionStorage.setItem('pendingOrders', JSON.stringify(pending));
          setPendingSyncCount(pending.length);
          resultingOrderId = localId;
        }
      }

      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['tables'] });

      resetOrder();
      setOrderType('dine_in');
      
      if (checkoutImmediately && resultingOrderId) {
        navigate('/dashboard/checkout', { state: { orderId: resultingOrderId } });
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Order failed:', err);
      alert('Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Parked tray ───────────────────────────────────────────────
  if (showParked) {
    return (
      <div className="animate-fade-in pb-10">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => setShowParked(false)}
            className="p-2 hover:bg-surface-100 rounded-2xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-surface-600" />
          </button>
          <h2 className="font-display font-bold text-2xl text-surface-900">Parked Orders</h2>
          <span className="bg-amber-100 text-amber-700 text-sm font-bold px-3 py-1 rounded-full">
            {parkedOrders.length}
          </span>
        </div>

        {parkedOrders.length === 0 ? (
          <div className="card text-center py-16">
            <PauseCircle className="w-16 h-16 text-surface-200 mx-auto mb-4" />
            <p className="font-bold text-surface-500">No parked orders</p>
          </div>
        ) : (
          <div className="grid gap-4 max-w-2xl">
            {parkedOrders.map(p => (
              <div key={p.id} className="card flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-bold text-surface-900">{p.label}</p>
                  <p className="text-sm text-surface-500">
                    {p.cart.length} item(s) · {formatCurrency(p.cart.reduce((s, i) => s + i.lineTotal, 0))} · Parked {new Date(p.parkedAt).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => resumeParked(p)}
                    className="btn-primary btn-sm gap-1"
                  >
                    <PlayCircle className="w-4 h-4" /> Resume
                  </button>
                  <button
                    onClick={() => deleteParked(p.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Table selection (first screen) ────────────────────────────
  if (orderType === 'dine_in' && !selectedTable && !existingOrderId) {
    return (
      <>
        {/* Parked badge */}
        {parkedOrders.length > 0 && (
          <button
            onClick={() => setShowParked(true)}
            className="fixed top-4 right-4 z-40 flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-2xl shadow-lg hover:bg-amber-600 transition-colors font-bold text-sm"
          >
            <PauseCircle className="w-4 h-4" />
            {parkedOrders.length} Parked
          </button>
        )}
        <TableSelectionScreen
          tables={tables}
          orderType={orderType}
          setOrderType={ot => { setOrderType(ot); }}
          onSelectTable={handleSelectTable}
          onSkip={() => setSelectedTable('__skip__')}
        />
        {occupiedModal && (
          <OccupiedTableModal
            table={occupiedModal.table}
            existingOrder={occupiedModal.existingOrder}
            onAddToExisting={() => {
              setSelectedTable(occupiedModal.table.id);
              setExistingOrderId(occupiedModal.existingOrder.id);
              setOccupiedModal(null);
            }}
            onNewOrder={() => {
              setSelectedTable(occupiedModal.table.id);
              setOccupiedModal(null);
            }}
            onClose={() => setOccupiedModal(null)}
          />
        )}
      </>
    );
  }

  // ── Main POS layout ───────────────────────────────────────────
  return (
    <>
      {modifierItem && (
        <ModifierModal
          item={modifierItem}
          onConfirm={(choices, notes) => {
            addToCart(modifierItem, choices, notes);
            setModifierItem(null);
          }}
          onClose={() => setModifierItem(null)}
        />
      )}

      <div className="flex h-full gap-4 animate-fade-in" style={{ height: 'calc(100vh - 80px)' }}>
        {/* ── Menu Panel ─────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 pr-2">
          {/* Search bar + connection + parked */}
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
              <input
                className="input pl-11 shadow-sm text-base py-3.5"
                placeholder="Search menu…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {parkedOrders.length > 0 && (
              <button
                onClick={() => setShowParked(true)}
                className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-2xl shadow-sm font-bold text-sm hover:bg-amber-600 transition-colors"
              >
                <PauseCircle className="w-4 h-4" />
                {parkedOrders.length}
              </button>
            )}
            <div className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold shadow-sm flex-shrink-0',
              isOnline
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                : 'bg-red-50 text-red-700 border border-red-100'
            )}>
              {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {isOnline ? 'Live' : 'Offline'}
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide mb-5 pb-2">
            {[{ id: 'all', name: 'All' }, ...categories].map(cat => (
              <button
                key={cat.id}
                className={cn(
                  'flex-shrink-0 px-5 py-2 rounded-full text-sm font-bold transition-all duration-300',
                  selectedCategory === cat.id
                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30 -translate-y-0.5'
                    : 'bg-white text-surface-600 hover:bg-surface-50 border border-surface-200/50'
                )}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Menu grid */}
          <div className="flex-1 overflow-y-auto pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(item => {
                const unavailable = !item.is_available;
                return (
                  <button
                    key={item.id}
                    className={cn(
                      'group rounded-[2rem] border p-3 text-left transition-all duration-300 flex flex-col',
                      unavailable
                        ? 'bg-surface-100 border-surface-200 opacity-50 cursor-not-allowed'
                        : 'bg-white/80 backdrop-blur-sm border-white/50 hover:border-brand-300 shadow-sm hover:shadow-card-hover hover:-translate-y-1 active:scale-[0.98] cursor-pointer'
                    )}
                    onClick={() => handleItemTap(item)}
                    disabled={unavailable}
                  >
                    {item.image_url ? (
                      <div className="w-full h-28 rounded-[1.5rem] overflow-hidden mb-3 shadow-sm">
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                    ) : (
                      <div className={cn(
                        'w-full h-28 rounded-[1.5rem] mb-3 flex items-center justify-center border',
                        unavailable ? 'bg-surface-200 border-surface-300' : 'bg-gradient-to-br from-brand-50 to-surface-50 border-brand-100/50'
                      )}>
                        <span className={cn('text-4xl transition-transform duration-300', !unavailable && 'group-hover:scale-110 drop-shadow-sm')}>
                          {unavailable ? '🚫' : '🍽️'}
                        </span>
                      </div>
                    )}
                    <div className="px-1 flex-1 flex flex-col">
                      <p className="font-bold text-surface-900 text-sm leading-tight mb-1 line-clamp-2">{item.name}</p>
                      <div className="flex items-center justify-between mt-auto">
                        <p className="font-extrabold text-brand-600 text-base tracking-tight">
                          {formatCurrency(item.price)}
                        </p>
                        {(item.menu_modifiers ?? []).length > 0 && !unavailable && (
                          <span className="text-xs bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full font-semibold">
                            Options
                          </span>
                        )}
                        {unavailable && (
                          <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-semibold">
                            86'd
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Cart Panel ─────────────────────────────────────────── */}
        <div className="w-96 flex flex-col glass-panel flex-shrink-0 ml-auto h-[calc(100vh-100px)] overflow-hidden -mt-4">
          {/* Cart Header */}
          <div className="p-4 border-b border-surface-200/50 bg-white/40 flex-shrink-0">
            {/* Order context pill */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 bg-surface-100 rounded-2xl px-4 py-2.5 flex items-center gap-2">
                {orderType === 'dine_in' && selectedTable ? (
                  <>
                    <Table2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span className="text-sm font-bold text-surface-800">
                      Table {tables.find(t => t.id === selectedTable)?.label ?? '—'}
                    </span>
                    {existingOrderId && (
                      <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Adding</span>
                    )}
                    <button
                      className="ml-auto text-xs text-brand-600 font-semibold hover:underline"
                      onClick={resetOrder}
                    >
                      Change
                    </button>
                  </>
                ) : orderType !== 'dine_in' ? (
                  <>
                    <span className="text-sm font-bold text-surface-800 capitalize">{orderType}</span>
                    <button className="ml-auto text-xs text-brand-600 font-semibold hover:underline" onClick={resetOrder}>Change</button>
                  </>
                ) : null}
              </div>
              <button
                onClick={clearOrder}
                className="p-2 text-surface-400 hover:text-red-600 transition-colors hover:bg-red-50 rounded-xl"
                title="Clear order"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            {/* Customer name for takeaway/delivery */}
            {(orderType === 'takeaway' || orderType === 'delivery') && (
              <input
                className="input text-sm"
                placeholder="Customer name (optional)"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
              />
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-50/30">
            {cart.length === 0 ? (
              <div className="text-center py-14">
                <div className="w-20 h-20 bg-white shadow-sm rounded-full flex items-center justify-center mx-auto mb-4 border border-surface-100">
                  <ShoppingCart className="w-10 h-10 text-surface-300" />
                </div>
                <p className="text-surface-900 font-bold text-lg tracking-tight">Cart is empty</p>
                <p className="text-surface-400 text-sm mt-1">Tap items to add them</p>
              </div>
            ) : (
              cart.map((item, i) => (
                <div key={i} className="bg-white rounded-[1.25rem] shadow-sm border border-surface-100/50 overflow-hidden">
                  <div className="flex items-start gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-surface-900 leading-tight truncate">{item.menuItem.name}</p>
                      {item.modifierChoices.length > 0 && (
                        <p className="text-xs text-brand-600 font-medium mt-0.5">
                          {item.modifierChoices.map(m => m.option_label).join(', ')}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-amber-600 italic mt-0.5">"{item.notes}"</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 bg-surface-50 p-1 rounded-full border border-surface-200/50">
                      <button
                        className="w-6 h-6 rounded-full bg-white flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-colors shadow-sm"
                        onClick={() => updateQuantity(i, -1)}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-extrabold w-5 text-center text-surface-900">{item.quantity}</span>
                      <button
                        className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-colors shadow-sm"
                        onClick={() => updateQuantity(i, 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p className="text-sm font-extrabold text-surface-900 w-16 text-right">{formatCurrency(item.lineTotal)}</p>
                      <button
                        className="p-1 text-surface-300 hover:text-amber-500 transition-colors rounded-lg"
                        onClick={() => setEditingNoteIdx(editingNoteIdx === i ? null : i)}
                        title="Add note"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Inline note editor */}
                  {editingNoteIdx === i && (
                    <div className="px-3 pb-3">
                      <input
                        autoFocus
                        className="input text-xs py-2"
                        placeholder="Chef's note (e.g. no onions)…"
                        value={item.notes}
                        onChange={e => updateNote(i, e.target.value)}
                        onBlur={() => setEditingNoteIdx(null)}
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Totals + Actions */}
          {cart.length > 0 && (
            <div className="p-4 border-t border-surface-200/50 bg-white/60 space-y-2.5 flex-shrink-0 rounded-b-3xl">
              <div className="flex justify-between text-sm font-medium text-surface-500">
                <span>Subtotal</span>
                <span className="text-surface-700">{formatCurrency(subtotal)}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between text-sm font-medium text-surface-500">
                  <span>Tax ({taxRate}%)</span>
                  <span className="text-surface-700">{formatCurrency(taxAmount)}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
                <Tag className="w-3.5 h-3.5" />
                <span>Discount</span>
                <input
                  type="number"
                  className="input py-1 text-sm h-8 w-20 ml-auto text-right font-bold text-surface-900 shadow-sm"
                  value={discount || ''}
                  placeholder="0"
                  onChange={e => setDiscount(Number(e.target.value) || 0)}
                />
              </div>
              <div className="flex justify-between font-extrabold text-surface-900 border-t border-surface-200/50 pt-2.5 mb-1">
                <span className="text-lg">Total</span>
                <span className="text-brand-600 text-2xl tracking-tight">{formatCurrency(total)}</span>
              </div>

              {/* Hold + Place Order */}
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex gap-2">
                  <button
                    onClick={holdOrder}
                    className="btn-secondary gap-1.5 flex-shrink-0 px-3"
                    title="Park order for later"
                  >
                    <PauseCircle className="w-4 h-4" />
                    Hold
                  </button>
                  <button
                    className="btn-primary flex-1 justify-center gap-2 text-sm shadow-glow shadow-brand-500/40 relative overflow-hidden group"
                    disabled={submitting}
                    onClick={() => placeOrder(false)}
                    id="place-order-btn"
                  >
                    <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-500 -translate-x-full skew-x-12" />
                    {submitting ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : success ? (
                      <><Check className="w-4 h-4" /> Sent!</>
                    ) : existingOrderId ? (
                      <><Plus className="w-4 h-4" /> Add to Order</>
                    ) : (
                      <><ChefHat className="w-4 h-4" /> Send to Kitchen {!isOnline && '(Offline)'}</>
                    )}
                  </button>
                </div>
                
                <button
                  className="w-full bg-surface-900 hover:bg-black text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  disabled={submitting}
                  onClick={() => placeOrder(true)}
                >
                  <Banknote className="w-5 h-5 text-emerald-400" />
                  Pay Now / Checkout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
