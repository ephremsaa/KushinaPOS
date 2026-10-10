import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingBag, Clock, MapPin, Phone, Search, AlertCircle,
  CheckCircle2, Plus, Minus, X, ArrowRight, UtensilsCrossed,
  Truck, Store, CreditCard, ChevronRight, Loader2, Sparkles, Check,
  Bell, Droplets, Receipt, MessageSquare, UserCheck
} from 'lucide-react';
import { publicApi } from '../../lib/api';
import { formatCurrency, cn } from '../../lib/utils';
import { useLanguage } from '../../contexts/LanguageContext';
import { LanguageSwitcher } from '../../components/ui';
import { globalToast } from '../../components/ui/Toast';
import { assetUrl } from '../../lib/assetUrl';

interface CartItem {
  menu_item_id: string;
  menu_item_name: string;
  quantity: number;
  unit_price: number;
  modifier_choices?: any[];
  notes?: string;
  station?: string;
}

export default function PublicMenuPage() {
  const { slug, tableId: urlTableId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const querySlug = slug || 'default';
  const queryTable = urlTableId || searchParams.get('table') || '';

  // Order mode state
  const [orderType, setOrderType] = useState<'dine_in' | 'delivery' | 'takeaway'>(
    queryTable ? 'dine_in' : 'dine_in'
  );
  const [tableLabel, setTableLabel] = useState(queryTable);
  const [tableId, setTableId] = useState('');
  const [tableVerified, setTableVerified] = useState(false);

  // Waiter Buzzer State
  const [waiterModalOpen, setWaiterModalOpen] = useState(false);
  const [waiterReqType, setWaiterReqType] = useState<'general' | 'bill' | 'water'>('general');
  const [waiterNotes, setWaiterNotes] = useState('');
  const [waiterCalling, setWaiterCalling] = useState(false);
  const [waiterSuccessMsg, setWaiterSuccessMsg] = useState('');
  const [waiterCooldown, setWaiterCooldown] = useState(0);

  // Customer contact info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [paymentMode, setPaymentMode] = useState<'pay_at_checkout' | 'online_paid'>('pay_at_checkout');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Selected item modal for modifiers
  const [activeItem, setActiveItem] = useState<any | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, any>>({});
  const [itemNote, setItemNote] = useState('');
  const [itemQty, setItemQty] = useState(1);

  // Fetch restaurant details
  const { data: restaurant, isLoading: restLoading, error: restError } = useQuery({
    queryKey: ['public-restaurant', querySlug],
    queryFn: () => publicApi.getRestaurant(querySlug),
    enabled: Boolean(querySlug),
  });

  // Fetch menu
  const { data: menuData, isLoading: menuLoading } = useQuery({
    queryKey: ['public-menu', querySlug],
    queryFn: () => publicApi.getMenu(querySlug),
    enabled: Boolean(querySlug),
  });

  // Fetch table if provided
  useEffect(() => {
    if (querySlug && queryTable) {
      publicApi.getTable(querySlug, queryTable)
        .then((t) => {
          if (t && t.id) {
            setTableId(t.id);
            setTableLabel(t.label);
            setTableVerified(true);
          }
        })
        .catch(() => {
          setTableVerified(false);
        });
    }
  }, [querySlug, queryTable]);

  // Waiter Buzzer Cooldown Timer
  useEffect(() => {
    if (waiterCooldown <= 0) return;
    const t = setInterval(() => {
      setWaiterCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [waiterCooldown]);

  // Call Waiter API Trigger
  const handleCallWaiter = async () => {
    if (!restaurant?.id || !tableLabel) {
      globalToast.info('Please enter your table number first.');
      return;
    }
    setWaiterCalling(true);
    try {
      const res = await publicApi.callWaiter({
        restaurant_id: restaurant.id,
        table_label: tableLabel,
        request_type: waiterReqType,
        notes: waiterNotes || undefined,
      });
      setWaiterSuccessMsg(res.message || 'Staff notified!');
      setWaiterCooldown(30);
      setWaiterNotes('');
      setTimeout(() => {
        setWaiterModalOpen(false);
        setWaiterSuccessMsg('');
      }, 2500);
    } catch (err: any) {
      globalToast.info(err?.response?.data?.error || 'Failed to notify staff.');
    } finally {
      setWaiterCalling(false);
    }
  };

  // Dynamic theme colors
  useEffect(() => {
    if (restaurant?.theme_color) {
      document.documentElement.style.setProperty('--brand-500', restaurant.theme_color);
    }
  }, [restaurant]);

  const categories = menuData?.categories || [];
  const items = menuData?.items || [];
  const modifiers = menuData?.modifiers || [];

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return items.filter((item: any) => {
      const matchesCat = selectedCategory === 'all' || item.category_id === selectedCategory;
      const matchesSearch = !searchQuery || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCat && matchesSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  // Cart math
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  }, [cart]);

  const taxRate = Number(restaurant?.tax_rate) || 0;
  const taxAmount = (cartSubtotal * taxRate) / 100;
  const serviceChargeRate = restaurant?.service_charge_enabled ? Number(restaurant.service_charge_percent) || 0 : 0;
  const serviceChargeAmount = (cartSubtotal * serviceChargeRate) / 100;
  const cartTotal = cartSubtotal + taxAmount + serviceChargeAmount;

  const totalCartCount = useMemo(() => cart.reduce((sum, i) => sum + i.quantity, 0), [cart]);

  // Add item to cart
  const addToCart = (item: any, quantity: number = 1, modChoices: any[] = [], note: string = '') => {
    const unitPrice = Number(item.price) + modChoices.reduce((s, m) => s + (Number(m.price_delta) || 0), 0);
    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (ci) => ci.menu_item_id === item.id && 
                JSON.stringify(ci.modifier_choices || []) === JSON.stringify(modChoices) &&
                ci.notes === note
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx].quantity += quantity;
        return next;
      }
      return [
        ...prev,
        {
          menu_item_id: item.id,
          menu_item_name: item.name,
          quantity,
          unit_price: unitPrice,
          modifier_choices: modChoices,
          notes: note || undefined,
        },
      ];
    });
  };

  const updateCartQty = (index: number, delta: number) => {
    setCart((prev) => {
      const next = [...prev];
      const newQty = next[index].quantity + delta;
      if (newQty <= 0) {
        next.splice(index, 1);
      } else {
        next[index].quantity = newQty;
      }
      return next;
    });
  };

  const handleOpenItemModal = (item: any) => {
    const itemMods = modifiers.filter((m: any) => m.menu_item_id === item.id);
    if (itemMods.length > 0) {
      setActiveItem(item);
      setSelectedModifiers({});
      setItemNote('');
      setItemQty(1);
    } else {
      addToCart(item, 1);
    }
  };

  // Submit Customer Order
  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    if (!restaurant?.is_open && orderType === 'dine_in') {
      setErrorMsg('Restaurant is currently closed for dine-in ordering.');
      return;
    }
    if (orderType === 'dine_in' && !tableLabel) {
      setErrorMsg('Please specify your table number.');
      return;
    }
    if (orderType === 'delivery' && (!customerAddress || !customerPhone)) {
      setErrorMsg('Delivery address and phone number are required.');
      return;
    }
    if (orderType === 'takeaway' && !customerPhone) {
      setErrorMsg('Phone number is required for pickup.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const orderPayload = {
        restaurant_id: restaurant.id,
        order_type: orderType,
        order_source: orderType === 'dine_in' ? 'qr_code' : orderType === 'delivery' ? 'online_delivery' : 'online_pickup',
        table_id: tableId || null,
        customer_name: customerName || (orderType === 'dine_in' ? `Table ${tableLabel}` : 'Online Customer'),
        customer_phone: customerPhone || null,
        customer_address: customerAddress || null,
        pickup_time: pickupTime || null,
        notes: orderNotes || null,
        payment_mode: paymentMode,
        items: cart,
      };

      const res = await publicApi.placeOrder(orderPayload);
      if (res && res.order_id) {
        navigate(`/order-status/${res.order_id}`);
      } else {
        throw new Error('Invalid server response');
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || err.message || 'Failed to place order.');
    } finally {
      setSubmitting(false);
    }
  };

  if (restLoading || menuLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-50 p-4">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-3" />
        <p className="text-surface-600 font-medium text-sm">Loading Menu…</p>
      </div>
    );
  }

  if (restError || !restaurant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-50 p-6 text-center">
        <AlertCircle className="w-14 h-14 text-red-500 mb-3" />
        <h1 className="text-xl font-bold text-primary">Restaurant Not Found</h1>
        <p className="text-sm text-muted max-w-sm mt-1">The requested restaurant link is invalid or no longer active.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 pb-28">
      {/* Top Banner Header */}
      <header className="bg-surface border-b border-default sticky top-0 z-30 shadow-xs">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {restaurant.logo_url ? (
              <img src={assetUrl(restaurant.logo_url)} alt={restaurant.name} className="w-12 h-12 rounded-2xl object-cover border border-default flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 font-bold text-xl flex-shrink-0">
                {restaurant.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-display font-bold text-lg text-primary truncate">{restaurant.name}</h1>
              <div className="flex items-center gap-2 text-xs text-muted">
                {restaurant.cuisine_type && <span>{restaurant.cuisine_type}</span>}
                {restaurant.city && <span>· {restaurant.city}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <LanguageSwitcher variant="button" />
            <span className={cn('px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5', restaurant.is_open ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200')}>
              <span className={cn('w-1.5 h-1.5 rounded-full', restaurant.is_open ? 'bg-emerald-500' : 'bg-red-500')} />
              {restaurant.is_open ? 'Open' : 'Closed'}
            </span>
          </div>
        </div>

        {/* Operating Hours Alert if Closed */}
        {!restaurant.is_open && (
          <div className="bg-amber-50 border-t border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>Currently closed for orders. You can browse the menu below.</span>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        
        {/* Order Mode Switcher */}
        <div className="bg-surface rounded-3xl p-3 border border-default shadow-xs">
          <p className="text-xs font-semibold text-muted mb-2 px-1">Order Mode</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setOrderType('dine_in')}
              className={cn('py-2.5 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition-all', orderType === 'dine_in' ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-xs' : 'border-default text-surface-600 hover:bg-surface-50')}
            >
              <UtensilsCrossed className="w-4 h-4" />
              {t('pos.dine_in', 'Dine-In')} {queryTable && `(Table ${queryTable})`}
            </button>
            <button
              onClick={() => setOrderType('delivery')}
              className={cn('py-2.5 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition-all', orderType === 'delivery' ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-xs' : 'border-default text-surface-600 hover:bg-surface-50')}
            >
              <Truck className="w-4 h-4" />
              {t('pos.delivery', 'Delivery')}
            </button>
            <button
              onClick={() => setOrderType('takeaway')}
              className={cn('py-2.5 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition-all', orderType === 'takeaway' ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-xs' : 'border-default text-surface-600 hover:bg-surface-50')}
            >
              <Store className="w-4 h-4" />
              {t('pos.takeaway', 'Takeaway')}
            </button>
          </div>

          {/* Mode specific fields */}
          {orderType === 'dine_in' && (
            <div className="mt-3 pt-3 border-t border-surface-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <label className="text-xs font-bold text-surface-700 flex-shrink-0">{t('menu.table_number', 'Table #')}:</label>
                <input
                  type="text"
                  className="input py-1.5 px-3 text-xs rounded-xl font-bold"
                  placeholder="e.g. 4"
                  value={tableLabel}
                  onChange={(e) => setTableLabel(e.target.value)}
                />
              </div>

              <button
                type="button"
                onClick={() => setWaiterModalOpen(true)}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs',
                  waiterCooldown > 0
                    ? 'bg-surface-100 text-surface-400 border border-default'
                    : 'bg-surface-900 hover:bg-black text-white active:scale-95'
                )}
                disabled={waiterCooldown > 0}
              >
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                {waiterCooldown > 0 ? `Called (${waiterCooldown}s)` : t('menu.call_waiter', 'Call Waiter')}
              </button>
            </div>
          )}
        </div>

        {/* Search & Category Filter */}
        <div className="space-y-3 sticky top-16 z-20 bg-surface-50 pt-2 pb-1">
          <div className="relative">
            <Search className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              className="input pl-10 py-2.5 text-sm rounded-2xl bg-surface shadow-xs"
              placeholder="Search food, drinks, desserts…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Categories bar */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn('px-4 py-2 rounded-2xl text-xs font-bold flex-shrink-0 transition-all', selectedCategory === 'all' ? 'bg-brand-500 text-white shadow-xs' : 'bg-surface text-surface-600 border border-default hover:bg-surface-100')}
            >
              All Items ({items.length})
            </button>
            {categories.map((cat: any) => {
              const catCount = items.filter((i: any) => i.category_id === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn('px-4 py-2 rounded-2xl text-xs font-bold flex-shrink-0 transition-all', selectedCategory === cat.id ? 'bg-brand-500 text-white shadow-xs' : 'bg-surface text-surface-600 border border-default hover:bg-surface-100')}
                >
                  {cat.name} ({catCount})
                </button>
              );
            })}
          </div>
        </div>

        {/* Menu Items Grid */}
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 bg-surface rounded-3xl border border-default p-6">
              <UtensilsCrossed className="w-10 h-10 text-surface-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-surface-700">No items available</p>
              <p className="text-xs text-surface-400 mt-1">Try adjusting your search or category filter.</p>
            </div>
          ) : (
            filteredItems.map((item: any) => {
              const inCartCount = cart
                .filter((c) => c.menu_item_id === item.id)
                .reduce((s, c) => s + c.quantity, 0);

              return (
                <div key={item.id} className="bg-surface rounded-3xl border border-default/80 p-4 flex gap-4 items-center shadow-xs hover:border-brand-300 transition-all">
                  {item.image_url ? (
                    <img src={assetUrl(item.image_url)} alt={item.name} className="w-20 h-20 rounded-2xl object-cover flex-shrink-0 border border-surface-100" />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-surface-100 flex items-center justify-center text-surface-400 flex-shrink-0">
                      <UtensilsCrossed className="w-8 h-8" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-sm text-primary truncate">{item.name}</h3>
                    {item.description && <p className="text-xs text-muted line-clamp-2 mt-0.5">{item.description}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="font-bold text-sm text-brand-600">{formatCurrency(item.price)}</span>
                      {item.preparation_time_minutes && (
                        <span className="text-[10px] text-surface-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {item.preparation_time_minutes}m
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <button
                      onClick={() => handleOpenItemModal(item)}
                      className={cn('btn btn-sm rounded-2xl gap-1.5', inCartCount > 0 ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-700 hover:bg-brand-50 hover:text-brand-700')}
                    >
                      <Plus className="w-4 h-4" />
                      {inCartCount > 0 ? `(${inCartCount})` : 'Add'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-3xl mx-auto z-40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-gradient-to-r from-brand-600 via-brand-500 to-brand-300 text-white rounded-3xl p-4 shadow-glow flex items-center justify-between hover:brightness-105 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-surface/20 backdrop-blur-xs flex items-center justify-center font-bold text-sm shadow-xs">
                {totalCartCount}
              </div>
              <div className="text-left">
                <p className="text-xs font-medium text-white/90">{t('menu.view_cart', 'View Order Cart')}</p>
                <p className="font-display font-black text-base">{formatCurrency(cartTotal)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 font-extrabold text-sm bg-surface/20 px-3.5 py-1.5 rounded-2xl shadow-xs">
              {t('menu.place_order', 'Checkout')} <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Item Modifiers Modal */}
      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg text-primary">{activeItem.name}</h3>
              <button onClick={() => setActiveItem(null)} className="p-2 rounded-full hover:bg-surface-100"><X className="w-5 h-5" /></button>
            </div>

            <p className="text-sm font-bold text-brand-600 mb-4">{formatCurrency(activeItem.price)}</p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="label">Special Instructions</label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="e.g. Extra spicy, no onions, sauce on the side"
                  value={itemNote}
                  onChange={(e) => setItemNote(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-surface-50 rounded-2xl">
                <span className="text-xs font-bold text-surface-700">Quantity</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setItemQty(Math.max(1, itemQty - 1))} className="w-8 h-8 rounded-xl bg-surface border border-default flex items-center justify-center font-bold">-</button>
                  <span className="font-bold text-sm">{itemQty}</span>
                  <button onClick={() => setItemQty(itemQty + 1)} className="w-8 h-8 rounded-xl bg-surface border border-default flex items-center justify-center font-bold">+</button>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                addToCart(activeItem, itemQty, [], itemNote);
                setActiveItem(null);
              }}
              className="btn-primary w-full justify-center py-3"
            >
              Add {itemQty} to Order · {formatCurrency(activeItem.price * itemQty)}
            </button>
          </div>
        </div>
      )}

      {/* Full Checkout Drawer / Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto flex flex-col animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-surface-100">
              <div>
                <h2 className="font-display font-bold text-lg text-primary">Your Order</h2>
                <p className="text-xs text-muted capitalize">{orderType.replace('_', ' ')} · {restaurant.name}</p>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="p-2 rounded-full hover:bg-surface-100"><X className="w-5 h-5" /></button>
            </div>

            {/* Cart Items List */}
            <div className="py-4 space-y-3 flex-1 overflow-y-auto max-h-60">
              {cart.map((ci, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-surface-50 rounded-2xl text-xs">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-bold text-primary truncate">{ci.menu_item_name}</p>
                    {ci.notes && <p className="text-[10px] text-surface-400 italic">"{ci.notes}"</p>}
                    <p className="font-semibold text-brand-600 mt-0.5">{formatCurrency(ci.unit_price * ci.quantity)}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => updateCartQty(idx, -1)} className="w-7 h-7 rounded-lg bg-surface border border-default flex items-center justify-center font-bold">-</button>
                    <span className="font-bold text-xs min-w-[16px] text-center">{ci.quantity}</span>
                    <button onClick={() => updateCartQty(idx, 1)} className="w-7 h-7 rounded-lg bg-surface border border-default flex items-center justify-center font-bold">+</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Customer Contact & Delivery Info */}
            <div className="space-y-3 pt-3 border-t border-surface-100 text-xs">
              <div>
                <label className="label text-xs">Your Name</label>
                <input
                  type="text"
                  className="input text-xs py-2"
                  placeholder="e.g. Abebe Kebede"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              {(orderType === 'delivery' || orderType === 'takeaway') && (
                <div>
                  <label className="label text-xs">Phone Number *</label>
                  <input
                    type="tel"
                    className="input text-xs py-2"
                    placeholder="0911 22 33 44"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
              )}

              {orderType === 'delivery' && (
                <div>
                  <label className="label text-xs">Delivery Address *</label>
                  <input
                    type="text"
                    className="input text-xs py-2"
                    placeholder="House/Apartment #, Street, Neighborhood"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                  />
                </div>
              )}

              {/* Payment Option */}
              <div>
                <label className="label text-xs">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMode('pay_at_checkout')}
                    className={cn('py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5', paymentMode === 'pay_at_checkout' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-default')}
                  >
                    💵 {orderType === 'dine_in' ? 'Pay at Table' : 'Pay on Delivery/Pickup'}
                  </button>
                  <button
                    onClick={() => setPaymentMode('online_paid')}
                    className={cn('py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5', paymentMode === 'online_paid' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-default')}
                  >
                    💳 Pay Online (Telebirr / Card)
                  </button>
                </div>
              </div>
            </div>

            {/* Bill Summary */}
            <div className="bg-surface-50 p-3 rounded-2xl my-4 space-y-1 text-xs">
              <div className="flex justify-between text-surface-600">
                <span>Subtotal</span>
                <span>{formatCurrency(cartSubtotal)}</span>
              </div>
              {taxAmount > 0 && (
                <div className="flex justify-between text-surface-600">
                  <span>Tax ({taxRate}%)</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
              )}
              {serviceChargeAmount > 0 && (
                <div className="flex justify-between text-surface-600">
                  <span>Service Charge ({serviceChargeRate}%)</span>
                  <span>{formatCurrency(serviceChargeAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-primary text-sm pt-1 border-t border-default">
                <span>Total</span>
                <span>{formatCurrency(cartTotal)}</span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {errorMsg}
              </div>
            )}

            <button
              onClick={handlePlaceOrder}
              disabled={submitting}
              className="btn-primary w-full justify-center py-3.5 gap-2 text-sm"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingBag className="w-5 h-5" />}
              {submitting ? 'Placing Order…' : `Place Order · ${formatCurrency(cartTotal)}`}
            </button>
          </div>
        </div>
      )}

      {/* ── Waiter Service Buzzer Modal ───────────────────────── */}
      {waiterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-sm p-6 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <Bell className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-primary">
                    Call Staff
                  </h3>
                  <p className="text-xs text-muted font-mono">
                    Table: <strong>{tableLabel || 'Not specified'}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWaiterModalOpen(false)}
                className="p-2 rounded-full hover:bg-surface-100 text-surface-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {waiterSuccessMsg ? (
              <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-2 animate-fade-in">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="font-bold text-sm text-emerald-900">{waiterSuccessMsg}</p>
                <p className="text-xs text-emerald-700">A waiter has been alerted and will arrive at your table shortly.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-surface-700 block mb-2">Select Request:</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setWaiterReqType('general')}
                      className={cn(
                        'p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer',
                        waiterReqType === 'general'
                          ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-xs'
                          : 'bg-surface-50 border-default text-surface-600 hover:bg-surface-100'
                      )}
                    >
                      <UserCheck className="w-5 h-5 text-amber-500" />
                      Waiter
                    </button>
                    <button
                      type="button"
                      onClick={() => setWaiterReqType('bill')}
                      className={cn(
                        'p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer',
                        waiterReqType === 'bill'
                          ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-xs'
                          : 'bg-surface-50 border-default text-surface-600 hover:bg-surface-100'
                      )}
                    >
                      <Receipt className="w-5 h-5 text-emerald-600" />
                      Bill / Check
                    </button>
                    <button
                      type="button"
                      onClick={() => setWaiterReqType('water')}
                      className={cn(
                        'p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer',
                        waiterReqType === 'water'
                          ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-xs'
                          : 'bg-surface-50 border-default text-surface-600 hover:bg-surface-100'
                      )}
                    >
                      <Droplets className="w-5 h-5 text-blue-500" />
                      Water
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-surface-700 block mb-1">Quick Note (optional):</label>
                  <input
                    type="text"
                    className="input text-xs py-2"
                    placeholder="e.g. Extra napkins, cutlery, change"
                    value={waiterNotes}
                    onChange={(e) => setWaiterNotes(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCallWaiter}
                  disabled={waiterCalling || !tableLabel}
                  className="btn-primary w-full justify-center py-3.5 gap-2 text-xs font-bold shadow-md"
                >
                  {waiterCalling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                  {waiterCalling ? 'Notifying Waiter…' : `Ring Table ${tableLabel || ''} Buzzer`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
