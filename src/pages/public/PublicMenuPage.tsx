import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingBag, Clock, MapPin, Phone, Search, AlertCircle,
  CheckCircle2, Plus, Minus, X, ArrowRight, UtensilsCrossed,
  Truck, Store, CreditCard, ChevronRight, Loader2, Sparkles, Check
} from 'lucide-react';
import { publicApi } from '../../lib/api';
import { formatCurrency, cn } from '../../lib/utils';

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

  const querySlug = slug || 'default';
  const queryTable = urlTableId || searchParams.get('table') || '';

  // Order mode state
  const [orderType, setOrderType] = useState<'dine_in' | 'delivery' | 'takeaway'>(
    queryTable ? 'dine_in' : 'dine_in'
  );
  const [tableLabel, setTableLabel] = useState(queryTable);
  const [tableId, setTableId] = useState('');
  const [tableVerified, setTableVerified] = useState(false);

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
        <h1 className="text-xl font-bold text-surface-900">Restaurant Not Found</h1>
        <p className="text-sm text-surface-500 max-w-sm mt-1">The requested restaurant link is invalid or no longer active.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 pb-28">
      {/* Top Banner Header */}
      <header className="bg-white border-b border-surface-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {restaurant.logo_url ? (
              <img src={restaurant.logo_url} alt={restaurant.name} className="w-12 h-12 rounded-2xl object-cover border border-surface-200 flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 font-bold text-xl flex-shrink-0">
                {restaurant.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-display font-bold text-lg text-surface-900 truncate">{restaurant.name}</h1>
              <div className="flex items-center gap-2 text-xs text-surface-500">
                {restaurant.cuisine_type && <span>{restaurant.cuisine_type}</span>}
                {restaurant.city && <span>· {restaurant.city}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
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
        <div className="bg-white rounded-3xl p-3 border border-surface-200 shadow-xs">
          <p className="text-xs font-semibold text-surface-500 mb-2 px-1">Order Mode</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setOrderType('dine_in')}
              className={cn('py-2.5 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition-all', orderType === 'dine_in' ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-xs' : 'border-surface-200 text-surface-600 hover:bg-surface-50')}
            >
              <UtensilsCrossed className="w-4 h-4" />
              Dine-In {queryTable && `(Table ${queryTable})`}
            </button>
            <button
              onClick={() => setOrderType('delivery')}
              className={cn('py-2.5 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition-all', orderType === 'delivery' ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-xs' : 'border-surface-200 text-surface-600 hover:bg-surface-50')}
            >
              <Truck className="w-4 h-4" />
              Delivery
            </button>
            <button
              onClick={() => setOrderType('takeaway')}
              className={cn('py-2.5 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition-all', orderType === 'takeaway' ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-xs' : 'border-surface-200 text-surface-600 hover:bg-surface-50')}
            >
              <Store className="w-4 h-4" />
              Pickup
            </button>
          </div>

          {/* Mode specific fields */}
          {orderType === 'dine_in' && (
            <div className="mt-3 pt-3 border-t border-surface-100 flex items-center gap-3">
              <label className="text-xs font-bold text-surface-700 flex-shrink-0">Table Number:</label>
              <input
                type="text"
                className="input py-1.5 px-3 text-xs rounded-xl"
                placeholder="e.g. T-1, 4"
                value={tableLabel}
                onChange={(e) => setTableLabel(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Search & Category Filter */}
        <div className="space-y-3 sticky top-16 z-20 bg-surface-50 pt-2 pb-1">
          <div className="relative">
            <Search className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              className="input pl-10 py-2.5 text-sm rounded-2xl bg-white shadow-xs"
              placeholder="Search food, drinks, desserts…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Categories bar */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn('px-4 py-2 rounded-2xl text-xs font-bold flex-shrink-0 transition-all', selectedCategory === 'all' ? 'bg-brand-500 text-white shadow-xs' : 'bg-white text-surface-600 border border-surface-200 hover:bg-surface-100')}
            >
              All Items ({items.length})
            </button>
            {categories.map((cat: any) => {
              const catCount = items.filter((i: any) => i.category_id === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn('px-4 py-2 rounded-2xl text-xs font-bold flex-shrink-0 transition-all', selectedCategory === cat.id ? 'bg-brand-500 text-white shadow-xs' : 'bg-white text-surface-600 border border-surface-200 hover:bg-surface-100')}
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
            <div className="text-center py-12 bg-white rounded-3xl border border-surface-200 p-6">
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
                <div key={item.id} className="bg-white rounded-3xl border border-surface-200/80 p-4 flex gap-4 items-center shadow-xs hover:border-brand-300 transition-all">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-20 h-20 rounded-2xl object-cover flex-shrink-0 border border-surface-100" />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-surface-100 flex items-center justify-center text-surface-400 flex-shrink-0">
                      <UtensilsCrossed className="w-8 h-8" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-sm text-surface-900 truncate">{item.name}</h3>
                    {item.description && <p className="text-xs text-surface-500 line-clamp-2 mt-0.5">{item.description}</p>}
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
            className="w-full bg-brand-500 text-white rounded-3xl p-4 shadow-xl flex items-center justify-between hover:bg-brand-600 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center font-bold text-sm">
                {totalCartCount}
              </div>
              <div className="text-left">
                <p className="text-xs font-medium text-white/80">View Order Cart</p>
                <p className="font-display font-bold text-base">{formatCurrency(cartTotal)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 font-bold text-sm bg-white/20 px-3 py-1.5 rounded-2xl">
              Checkout <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Item Modifiers Modal */}
      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg text-surface-900">{activeItem.name}</h3>
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
                  <button onClick={() => setItemQty(Math.max(1, itemQty - 1))} className="w-8 h-8 rounded-xl bg-white border border-surface-200 flex items-center justify-center font-bold">-</button>
                  <span className="font-bold text-sm">{itemQty}</span>
                  <button onClick={() => setItemQty(itemQty + 1)} className="w-8 h-8 rounded-xl bg-white border border-surface-200 flex items-center justify-center font-bold">+</button>
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
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto flex flex-col animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-surface-100">
              <div>
                <h2 className="font-display font-bold text-lg text-surface-900">Your Order</h2>
                <p className="text-xs text-surface-500 capitalize">{orderType.replace('_', ' ')} · {restaurant.name}</p>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="p-2 rounded-full hover:bg-surface-100"><X className="w-5 h-5" /></button>
            </div>

            {/* Cart Items List */}
            <div className="py-4 space-y-3 flex-1 overflow-y-auto max-h-60">
              {cart.map((ci, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-surface-50 rounded-2xl text-xs">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-bold text-surface-900 truncate">{ci.menu_item_name}</p>
                    {ci.notes && <p className="text-[10px] text-surface-400 italic">"{ci.notes}"</p>}
                    <p className="font-semibold text-brand-600 mt-0.5">{formatCurrency(ci.unit_price * ci.quantity)}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => updateCartQty(idx, -1)} className="w-7 h-7 rounded-lg bg-white border border-surface-200 flex items-center justify-center font-bold">-</button>
                    <span className="font-bold text-xs min-w-[16px] text-center">{ci.quantity}</span>
                    <button onClick={() => updateCartQty(idx, 1)} className="w-7 h-7 rounded-lg bg-white border border-surface-200 flex items-center justify-center font-bold">+</button>
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
                    className={cn('py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5', paymentMode === 'pay_at_checkout' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-200')}
                  >
                    💵 {orderType === 'dine_in' ? 'Pay at Table' : 'Pay on Delivery/Pickup'}
                  </button>
                  <button
                    onClick={() => setPaymentMode('online_paid')}
                    className={cn('py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5', paymentMode === 'online_paid' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-200')}
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
              <div className="flex justify-between font-bold text-surface-900 text-sm pt-1 border-t border-surface-200">
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
    </div>
  );
}
