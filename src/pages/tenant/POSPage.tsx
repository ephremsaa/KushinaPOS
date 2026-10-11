import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, Minus, ShoppingCart, Table2, Trash2, ChevronRight,
  MessageSquare, PauseCircle, PlayCircle, Tag, AlertCircle, ChefHat,
  ArrowLeft, Banknote, Check, Wifi, WifiOff, Smartphone, QrCode, Receipt,
  Users, X
} from 'lucide-react';
import { menuApi, tablesApi, ordersApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatCurrency, generateId, cn } from '../../lib/utils';
import { syncEngine } from '../../lib/sync';
import { Button, Badge, Modal, Input, LanguageSwitcher, EmptyState } from '../../components/ui';
import { QuickPaymentModal, ThermalReceipt, CustomerSelectorModal } from '../../components/pos';
import { globalConfirm } from '../../contexts/ConfirmContext';
import { globalToast } from '../../components/ui/Toast';
import { assetUrl } from '../../lib/assetUrl';
import type {
  MenuItem, MenuCategory, Table,
  ModifierChoice, TableStatus, MenuModifier, Order, Customer
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

const PARK_KEY = 'pos_parked_orders';

const STATUS_COLORS: Record<TableStatus, string> = {
  available: 'bg-emerald-100 border-emerald-400 text-emerald-800',
  occupied:  'bg-red-100 border-red-400 text-red-800',
  reserved:  'bg-amber-100 border-amber-400 text-amber-800',
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
    <Modal
      open={true}
      onClose={onClose}
      title={item.name}
      description={`Base price: ${formatCurrency(item.price)} · Total: ${formatCurrency(item.price + extraCost)}`}
      icon={<ChefHat className="w-5 h-5 text-brand-500" />}
      size="md"
      footer={
        <div className="flex gap-2 justify-end w-full">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={requiredMissing}
            icon={<Plus className="w-4 h-4" />}
            onClick={confirm}
          >
            Add to Order ({formatCurrency(item.price + extraCost)})
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {modifiers.map(mod => (
          <div key={mod.id}>
            <div className="flex items-center gap-2 mb-3">
              <p className="font-bold text-surface-800 text-sm">{mod.name}</p>
              {mod.is_required && (
                <Badge status="new">Required</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {mod.options.map(opt => {
                const selected = selections[mod.id]?.option_label === opt.label;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={async () => toggle(mod, opt.label, opt.price_delta)}
                    className={cn(
                      'px-4 py-2 rounded-2xl text-sm font-semibold border-2 transition-all duration-200 cursor-pointer',
                      selected
                        ? 'bg-brand-500 border-brand-500 text-white shadow-sm shadow-brand-500/30 scale-105'
                        : 'bg-surface-50 border-default text-surface-700 hover:border-brand-300'
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
          <label className="label">Chef's Notes (optional)</label>
          <textarea
            className="input resize-none text-sm min-h-[60px]"
            rows={2}
            placeholder="e.g. No onions, extra spicy…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}

// ─── Table Selection Screen ──────────────────────────────────────────────────

function TableSelectionScreen({
  tables,
  orderType,
  setOrderType,
  onSelectTable,
  onSkip,
}: {
  tables: Table[];
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  setOrderType: (t: 'dine_in' | 'takeaway' | 'delivery') => void;
  onSelectTable: (tableId: string) => void;
  onSkip: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center pt-8 h-full animate-fade-in overflow-y-auto pb-10">
      <h2 className="font-display font-black text-3xl mb-6 text-primary">Start New Order</h2>

      {/* Order Type Selector */}
      <div className="flex gap-2 p-1.5 bg-surface-200/50 backdrop-blur-sm rounded-2xl mb-8 border border-default">
        {(['dine_in', 'takeaway', 'delivery'] as const).map(type => (
          <button
            key={type}
            className={cn(
              'px-8 py-3 rounded-xl text-sm font-bold capitalize transition-all duration-300 cursor-pointer',
              orderType === type
                ? 'bg-[var(--card-bg)] shadow-md text-brand-600 border border-[var(--card-border)]'
                : 'text-muted hover:text-surface-800'
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
          <Button variant="primary" size="lg" iconRight={<ChevronRight className="w-5 h-5" />} onClick={onSkip}>
            Proceed to Menu
          </Button>
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
              <EmptyState
                icon={<Table2 className="w-12 h-12" />}
                title="No tables configured"
                description="Set up your floor plan to start taking dine-in orders."
                action={{
                  label: 'Set up floor plan',
                  icon: <ChevronRight className="w-4 h-4" />,
                  onClick: () => navigate('/dashboard/tables')
                }}
              />
            ) : (
              tables.map(table => (
                <button
                  key={table.id}
                  className={cn(
                    'border-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 active:scale-95',
                    STATUS_COLORS[table.status],
                    table.shape === 'circle' ? 'rounded-full' : '',
                    table.status === 'cleaning'
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer'
                  )}
                  style={{ width: 100, height: 90 }}
                  onClick={() => onSelectTable(table.id)}
                  disabled={table.status === 'cleaning'}
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
    <Modal
      open={true}
      onClose={onClose}
      title={`Table ${table.label} is Occupied`}
      description="An active order is currently open on this table."
      icon={<AlertCircle className="w-5 h-5 text-amber-500" />}
      size="sm"
    >
      <div className="space-y-4">
        <div className="bg-surface-50 rounded-2xl p-4 text-sm">
          <p className="font-semibold text-surface-700 mb-1">Current Order #{existingOrder.local_id || existingOrder.id.slice(0, 6)}</p>
          <p className="text-muted">{existingOrder.order_items?.length ?? 0} item(s) · {formatCurrency(existingOrder.total)}</p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button variant="primary" fullWidth icon={<Plus className="w-4 h-4" />} onClick={onAddToExisting}>
            Add to Existing Order
          </Button>
          <Button variant="secondary" fullWidth icon={<ShoppingCart className="w-4 h-4" />} onClick={onNewOrder}>
            Start New Order Anyway
          </Button>
          <Button variant="ghost" fullWidth onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Reserved Table Modal ─────────────────────────────────────────────────────

function ReservedTableModal({
  table,
  onProceed,
  onClose,
}: {
  table: Table;
  onProceed: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`Table ${table.label} is Reserved`}
      description="This table is currently marked as reserved for an upcoming booking."
      icon={<AlertCircle className="w-5 h-5 text-amber-500" />}
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-sm text-surface-600">Are you sure you want to seat a walk-in or start a new order at this table?</p>
        <div className="flex flex-col gap-2 pt-2">
          <Button variant="primary" fullWidth icon={<Check className="w-4 h-4" />} onClick={onProceed}>
            Seat Anyway & Start Order
          </Button>
          <Button variant="ghost" fullWidth onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main POS Component ───────────────────────────────────────────────────────

export default function POSPage() {
  const { user } = useAuth();
  const { isOnline, setPendingSyncCount } = useNetwork();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const restaurantId = String((user?.restaurant as any)?.id || user?.restaurantId || '');
  const taxRate = Number(user?.restaurant?.tax_rate ?? 0);

  // ── Core state ────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // ── Quick Checkout & Receipt state ────────────────────────────
  const [quickPayOrder, setQuickPayOrder] = useState<Order | null>(null);
  const [receiptData, setReceiptData] = useState<{
    order: Order;
    tip: number;
    method: string;
    tendered: number;
    change: number;
  } | null>(null);

  // ── Modifier modal ────────────────────────────────────────────
  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);

  // ── Occupied table modal ──────────────────────────────────────
  const [occupiedModal, setOccupiedModal] = useState<{ table: Table; existingOrder: Order } | null>(null);
  const [reservedModal, setReservedModal] = useState<Table | null>(null);
  const [existingOrderId, setExistingOrderId] = useState<string | null>(null);

  // ── Parked orders ─────────────────────────────────────────────
  const [parkedOrders, setParkedOrders] = useState<ParkedOrder[]>(() => {
    try { return JSON.parse(localStorage.getItem(PARK_KEY) ?? '[]'); } catch { return []; }
  });
  const [showParked, setShowParked] = useState(false);

  // ── Notes editing ─────────────────────────────────────────────
  const [editingNoteIdx, setEditingNoteIdx] = useState<number | null>(null);

  // ── Check route state on mount (e.g. from TablesPage) ────────
  useEffect(() => {
    if (location.state?.tableId) {
      setSelectedTable(location.state.tableId);
      if (location.state.orderType) setOrderType(location.state.orderType);
      // clear location state so refresh doesn't force it
      navigate('.', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  // ── Data fetching ─────────────────────────────────────────────
  const { data: categories = [] } = useQuery({
    queryKey: ['menu-categories'],
    queryFn: () => menuApi.getCategories() as Promise<MenuCategory[]>,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu-items'],
    queryFn: () => menuApi.getItems() as Promise<MenuItem[]>,
    refetchInterval: 15_000,
  });

  const { data: tables = [] } = useQuery({
    queryKey: ['tables'],
    queryFn: () => tablesApi.list() as Promise<Table[]>,
    refetchInterval: 15_000,
  });

  // ── Derived values (filter only available items) ──────────────
  const availableItems = menuItems.filter(item => item.is_available);
  const filtered = availableItems.filter(item => {
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
      if (choices.length === 0 && !notes) {
        const existing = prev.find(c => c.menuItem.id === item.id && c.modifierChoices.length === 0 && !c.notes);
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

  const clearOrder = async () => {
    if (await globalConfirm('Clear entire order and start over?')) {
      setOrderType('dine_in');
      resetOrder();
    }
  };

  // ── Table selection flow ──────────────────────────────────────
  const handleSelectTable = async (tableId: string) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    if (table.status === 'occupied') {
      try {
        const openOrder = await ordersApi.openForTable(tableId) as Order | null;
        if (openOrder) {
          setOccupiedModal({ table, existingOrder: openOrder });
          return;
        }
      } catch (e) { /* continue */ }
    }

    if (table.status === 'reserved') {
      setReservedModal(table);
      return;
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
        await ordersApi.addItems(existingOrderId, { items, ...totals });
      } else {
        const localId = generateId();
        const payload = {
          restaurant_id: restaurantId,
          table_id: selectedTable && selectedTable !== '__skip__' ? selectedTable : null,
          order_type: orderType,
          status: 'new',
          ...totals,
          customer_name: selectedCustomer?.name || customerName || null,
          customer_phone: selectedCustomer?.phone || null,
          customer_id: selectedCustomer?.id || null,
          local_id: localId,
          synced_at: isOnline ? new Date().toISOString() : null,
          items,
        };

        if (isOnline) {
          const res = await ordersApi.create(payload) as any;
          resultingOrderId = res?.id;
        } else {
          syncEngine.saveLocalOrder(payload as any);
          setPendingSyncCount(syncEngine.getPendingCount());
          resultingOrderId = localId;
        }
      }

      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['tables'] });

      const tableLabel = tables.find(t => t.id === selectedTable)?.label;
      const orderForPayment: Order = {
        id: resultingOrderId || generateId(),
        restaurant_id: restaurantId || '',
        table_id: selectedTable && selectedTable !== '__skip__' ? selectedTable : undefined,
        table_label: tableLabel,
        order_type: orderType,
        status: 'new',
        payment_status: 'pending',
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discount,
        total,
        customer_name: selectedCustomer?.name || customerName || undefined,
        customer_phone: selectedCustomer?.phone || undefined,
        customer_id: selectedCustomer?.id || undefined,
        order_items: items.map((it, idx) => ({
          id: `item-${idx}`,
          order_id: resultingOrderId || '',
          menu_item_id: it.menu_item_id,
          menu_item_name: it.menu_item_name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          modifier_choices: it.modifier_choices,
          status: 'pending',
          notes: it.notes || undefined,
          created_at: new Date().toISOString(),
        })),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (checkoutImmediately && resultingOrderId) {
        setQuickPayOrder(orderForPayment);
      } else {
        resetOrder();
        setOrderType('dine_in');
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Order failed:', err);
      globalToast.info('Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Parked tray ───────────────────────────────────────────────
  if (showParked) {
    return (
      <div className="animate-fade-in pb-10 max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => setShowParked(false)}
            className="p-2 hover:bg-surface-100 rounded-2xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-surface-600" />
          </button>
          <h2 className="font-display font-bold text-2xl text-primary">Parked Orders</h2>
          <Badge status="pending">{parkedOrders.length}</Badge>
        </div>

        {parkedOrders.length === 0 ? (
          <div className="card text-center py-16">
            <PauseCircle className="w-16 h-16 text-surface-200 mx-auto mb-4" />
            <p className="font-bold text-muted">No parked orders</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {parkedOrders.map(p => (
              <div key={p.id} className="card flex items-center gap-4 p-5">
                <div className="flex-1">
                  <p className="font-bold text-primary">{p.label}</p>
                  <p className="text-sm text-muted">
                    {p.cart.length} item(s) · {formatCurrency(p.cart.reduce((s, i) => s + i.lineTotal, 0))} · Parked {new Date(p.parkedAt).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<PlayCircle className="w-4 h-4" />}
                    onClick={() => resumeParked(p)}
                  >
                    Resume
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="w-4 h-4 text-red-500" />}
                    onClick={() => deleteParked(p.id)}
                  />
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
        {parkedOrders.length > 0 && (
          <button
            onClick={() => setShowParked(true)}
            className="fixed top-4 right-4 z-40 flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-2xl shadow-lg hover:bg-amber-600 transition-colors font-bold text-sm cursor-pointer"
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
            <div className="flex-1">
              <Input
                icon={<Search className="w-4 h-4" />}
                placeholder={t('pos.search_placeholder', 'Search menu items…')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {parkedOrders.length > 0 && (
              <Button
                variant="secondary"
                icon={<PauseCircle className="w-4 h-4 text-amber-500" />}
                onClick={() => setShowParked(true)}
              >
                {parkedOrders.length} Parked
              </Button>
            )}
            <div className={cn(
              'flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold shadow-xs flex-shrink-0',
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
            {[{ id: 'all', name: t('pos.all_categories', 'All') }, ...categories].map(cat => (
              <button
                key={cat.id}
                className={cn(
                  'flex-shrink-0 px-5 py-2 rounded-full text-sm font-bold transition-all duration-300 cursor-pointer',
                  selectedCategory === cat.id
                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30 -translate-y-0.5'
                    : 'bg-[var(--card-bg)] text-surface-600 hover:bg-surface-50 border border-default/50'
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
                return (
                  <button
                    key={item.id}
                    className="group rounded-[2rem] border p-3.5 text-left transition-all duration-300 flex flex-col bg-[var(--card-bg)] border-default hover:border-brand-500 shadow-card hover:shadow-card-hover hover:-translate-y-1 active:scale-[0.98] cursor-pointer"
                    onClick={() => handleItemTap(item)}
                  >
                    {item.image_url ? (
                      <div className="w-full h-32 rounded-[1.5rem] overflow-hidden mb-3 shadow-xs">
                        <img src={assetUrl(item.image_url)} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                    ) : (
                      <div className="w-full h-32 rounded-[1.5rem] mb-3 flex items-center justify-center border bg-gradient-to-br from-brand-50 to-surface-100 border-brand-100/50">
                        <span className="text-4xl transition-transform duration-300 group-hover:scale-110 drop-shadow-sm">
                          🍽️
                        </span>
                      </div>
                    )}
                    <div className="px-1 flex-1 flex flex-col">
                      <p className="font-bold text-primary text-sm leading-tight mb-1.5 line-clamp-2">{item.name}</p>
                      <div className="flex items-center justify-between mt-auto pt-1">
                        <p className="font-extrabold text-brand-700 text-base tracking-tight font-mono">
                          {formatCurrency(item.price)}
                        </p>
                        {(item.menu_modifiers ?? []).length > 0 ? (
                          <Badge color="gold" className="text-[10px]">Custom</Badge>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-xs group-hover:bg-brand-500 group-hover:text-white transition-colors">
                            <Plus className="w-3.5 h-3.5" />
                          </div>
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
          <div className="p-4 border-b border-default/50 bg-[var(--card-bg)] flex-shrink-0">
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
                      <Badge status="pending">Adding</Badge>
                    )}
                    <button
                      className="ml-auto text-xs text-brand-600 font-semibold hover:underline cursor-pointer"
                      onClick={resetOrder}
                    >
                      Change
                    </button>
                  </>
                ) : orderType !== 'dine_in' ? (
                  <>
                    <span className="text-sm font-bold text-surface-800 capitalize">{orderType}</span>
                    <button className="ml-auto text-xs text-brand-600 font-semibold hover:underline cursor-pointer" onClick={resetOrder}>Change</button>
                  </>
                ) : null}
              </div>
              <button
                onClick={clearOrder}
                className="p-2 text-surface-400 hover:text-red-600 transition-colors hover:bg-red-50 rounded-xl cursor-pointer"
                title="Clear order"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            {/* Customer attachment / Loyalty account */}
            <div className="p-2 rounded-xl bg-default-50 border border-default text-xs">
              {selectedCustomer ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center text-[11px]">
                      {selectedCustomer.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-default-900 leading-tight">{selectedCustomer.name}</span>
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.2 rounded-full">
                          {selectedCustomer.points} pts
                        </span>
                      </div>
                      <p className="text-[10px] text-default-500 font-mono">{selectedCustomer.phone}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerName('');
                    }}
                    className="p-1 text-default-400 hover:text-red-600 rounded-md"
                    title="Remove customer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1 text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50/50 hover:bg-brand-50 rounded-lg transition-colors border border-brand-200"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Attach Customer / Loyalty</span>
                  </button>
                  {(orderType === 'takeaway' || orderType === 'delivery') && (
                    <input
                      type="text"
                      placeholder="Guest name"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      className="w-28 px-2 py-1 text-xs rounded-lg border border-default bg-card outline-none"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-50/30">
            {cart.length === 0 ? (
              <div className="text-center py-14">
                <div className="w-20 h-20 bg-[var(--card-bg)] shadow-sm rounded-full flex items-center justify-center mx-auto mb-4 border border-surface-100">
                  <ShoppingCart className="w-10 h-10 text-surface-300" />
                </div>
                <p className="text-primary font-bold text-lg tracking-tight">{t('pos.empty_cart', 'Cart is empty')}</p>
                <p className="text-surface-400 text-sm mt-1">{t('pos.empty_cart_sub', 'Tap items to add them')}</p>
              </div>
            ) : (
              cart.map((item, i) => (
                <div key={i} className="bg-[var(--card-bg)] rounded-[1.25rem] shadow-sm border border-surface-100/50 overflow-hidden">
                  <div className="flex items-start gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-primary leading-tight truncate">{item.menuItem.name}</p>
                      {item.modifierChoices.length > 0 && (
                        <p className="text-xs text-brand-600 font-medium mt-0.5">
                          {item.modifierChoices.map(m => m.option_label).join(', ')}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-amber-600 italic mt-0.5">"{item.notes}"</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 bg-surface-50 p-1 rounded-full border border-default/50">
                      <button
                        className="w-6 h-6 rounded-full bg-[var(--card-bg)] flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-colors shadow-sm cursor-pointer"
                        onClick={() => updateQuantity(i, -1)}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-extrabold w-5 text-center text-primary">{item.quantity}</span>
                      <button
                        className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-colors shadow-sm cursor-pointer"
                        onClick={() => updateQuantity(i, 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p className="text-sm font-extrabold text-primary w-16 text-right font-mono">{formatCurrency(item.lineTotal)}</p>
                      <button
                        className="p-1 text-surface-300 hover:text-amber-500 transition-colors rounded-lg cursor-pointer"
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
            <div className="p-4 border-t border-default/50 bg-[var(--card-bg)] space-y-2.5 flex-shrink-0 rounded-b-3xl">
              <div className="flex justify-between text-sm font-medium text-muted">
                <span>{t('pos.subtotal', 'Subtotal')}</span>
                <span className="text-surface-700 font-mono">{formatCurrency(subtotal)}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between text-sm font-medium text-muted">
                  <span>{t('pos.tax', 'Tax')} ({taxRate}%)</span>
                  <span className="text-surface-700 font-mono">{formatCurrency(taxAmount)}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm font-medium text-muted">
                <Tag className="w-3.5 h-3.5" />
                <span>{t('pos.discount', 'Discount')}</span>
                <input
                  type="number"
                  className="input py-1 text-sm h-8 w-20 ml-auto text-right font-bold font-mono text-primary shadow-sm"
                  value={discount || ''}
                  placeholder="0"
                  onChange={e => setDiscount(Number(e.target.value) || 0)}
                />
              </div>
              <div className="flex justify-between font-extrabold text-primary border-t border-default/50 pt-2.5 mb-1">
                <span className="text-lg">{t('pos.total', 'Total')}</span>
                <span className="text-brand-600 text-2xl tracking-tight font-mono">{formatCurrency(total)}</span>
              </div>

              {/* Hold + Place Order */}
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    icon={<PauseCircle className="w-4 h-4" />}
                    onClick={holdOrder}
                    title="Park order for later"
                  >
                    Hold
                  </Button>
                  <Button
                    variant="primary"
                    fullWidth
                    loading={submitting}
                    icon={success ? <Check className="w-4 h-4" /> : existingOrderId ? <Plus className="w-4 h-4" /> : <ChefHat className="w-4 h-4" />}
                    onClick={() => placeOrder(false)}
                    id="place-order-btn"
                  >
                    {success ? 'Sent!' : existingOrderId ? 'Add to Order' : `Send to Kitchen ${!isOnline ? '(Offline)' : ''}`}
                  </Button>
                </div>

                {user?.staffRole === 'waiter' ? (
                  <Button
                    variant="primary"
                    fullWidth
                    className="bg-surface-900 hover:bg-black text-white"
                    icon={<Receipt className="w-4 h-4 text-white" />}
                    loading={submitting}
                    onClick={() => {
                      globalToast.info('Bill requested (Cashier notified)');
                    }}
                  >
                    Request Bill
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    fullWidth
                    className="bg-surface-900 hover:bg-black text-white"
                    icon={<Banknote className="w-4 h-4 text-emerald-400" />}
                    loading={submitting}
                    onClick={() => placeOrder(true)}
                  >
                    Pay Now / Settle Bill
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Ethiopian Payment Modal ──────────────────────── */}
      {quickPayOrder && (
        <QuickPaymentModal
          order={quickPayOrder}
          restaurantName={(user?.restaurant as any)?.name ?? user?.restaurantName ?? 'Restaurant'}
          restaurantPhone={(user?.restaurant as any)?.phone ?? '+251 91 123 4567'}
          onSuccess={(paidOrder, details) => {
            setQuickPayOrder(null);
            setReceiptData({
              order: paidOrder,
              tip: details.tip,
              method: details.method,
              tendered: details.tendered,
              change: details.change,
            });
            resetOrder();
            setOrderType('dine_in');
          }}
          onClose={() => setQuickPayOrder(null)}
        />
      )}

      {/* ── Branded Thermal Receipt Modal ──────────────────────── */}
      {receiptData && (
        <ThermalReceipt
          order={receiptData.order}
          tipAmount={receiptData.tip}
          paymentMethod={receiptData.method}
          amountTendered={receiptData.tendered}
          change={receiptData.change}
          restaurantName={(user?.restaurant as any)?.name ?? user?.restaurantName ?? 'Restaurant'}
          restaurantLogo={assetUrl((user?.restaurant as any)?.logo_url)}
          taxId={(user?.restaurant as any)?.tax_id}
          address={(user?.restaurant as any)?.address}
          phone={(user?.restaurant as any)?.phone}
          receiptHeader={(user?.restaurant as any)?.receipt_header}
          receiptFooter={(user?.restaurant as any)?.receipt_footer}
          showTaxBreakdown={(user?.restaurant as any)?.receipt_show_tax_breakdown ?? true}
          showLogo={(user?.restaurant as any)?.receipt_show_logo ?? true}
          onClose={() => {
            setReceiptData(null);
            resetOrder();
          }}
        />
      )}
      {reservedModal && (
        <ReservedTableModal
          table={reservedModal}
          onProceed={() => {
            setExistingOrderId(null);
            setSelectedTable(reservedModal.id);
            setReservedModal(null);
          }}
          onClose={() => setReservedModal(null)}
        />
      )}
      <CustomerSelectorModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSelectCustomer={(c) => {
          setSelectedCustomer(c);
          setCustomerName(c.name);
        }}
      />
    </>
  );
}
