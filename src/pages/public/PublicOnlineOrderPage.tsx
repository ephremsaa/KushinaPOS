import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingBag, Truck, Store, Clock, Phone, MapPin, Search,
  Plus, Minus, X, ArrowRight, AlertCircle, CheckCircle2,
  ChevronRight, Loader2, Sparkles, Upload, ShieldCheck, DollarSign
} from 'lucide-react';
import { publicApi, api } from '../../lib/api';
import { formatCurrency, cn } from '../../lib/utils';
import { useLanguage } from '../../contexts/LanguageContext';
import { LanguageSwitcher, Badge } from '../../components/ui';
import { globalToast } from '../../components/ui/Toast';
import { assetUrl } from '../../lib/assetUrl';

interface CartItem {
  menu_item_id: string;
  menu_item_name: string;
  quantity: number;
  unit_price: number;
  modifier_choices?: any[];
  notes?: string;
}

interface DeliveryZone {
  id: string;
  name: string;
  fee: number | string;
  min_order_amount: number | string;
  estimated_minutes: number;
  is_active: boolean;
}

export default function PublicOnlineOrderPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const querySlug = slug || 'default';

  // Order options
  const [orderType, setOrderType] = useState<'pickup' | 'delivery'>('delivery');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryLandmark, setDeliveryLandmark] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'telebirr' | 'cbe_birr'>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);

  // Honeypot field (bots fill this)
  const [honeypot, setHoneypot] = useState('');

  // Cart & UI State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Search & Category
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modifier modal
  const [activeItem, setActiveItem] = useState<any | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, any>>({});
  const [itemNote, setItemNote] = useState('');
  const [itemQty, setItemQty] = useState(1);

  // 1. Fetch Restaurant Details (includes delivery zones and settings)
  const { data: restaurant, isLoading: restLoading, error: restError } = useQuery({
    queryKey: ['public-restaurant-order', querySlug],
    queryFn: () => publicApi.getRestaurant(querySlug),
    enabled: Boolean(querySlug),
  });

  // 2. Fetch Menu
  const { data: menuData, isLoading: menuLoading } = useQuery({
    queryKey: ['public-menu-order', querySlug],
    queryFn: () => publicApi.getMenu(querySlug),
    enabled: Boolean(querySlug),
  });

  const deliveryZones: DeliveryZone[] = useMemo(() => {
    return Array.isArray(restaurant?.delivery_zones) ? restaurant.delivery_zones : [];
  }, [restaurant]);

  // Set default zone if none selected
  useEffect(() => {
    if (deliveryZones.length > 0 && !selectedZoneId) {
      setSelectedZoneId(deliveryZones[0].id);
    }
  }, [deliveryZones, selectedZoneId]);

  // Set default fulfillment type based on restaurant settings
  useEffect(() => {
    if (restaurant) {
      if (!restaurant.online_delivery_enabled && restaurant.online_pickup_enabled) {
        setOrderType('pickup');
      } else if (restaurant.online_delivery_enabled && !restaurant.online_pickup_enabled) {
        setOrderType('delivery');
      }
    }
  }, [restaurant]);

  const activeZone = useMemo(() => {
    return deliveryZones.find(z => z.id === selectedZoneId);
  }, [deliveryZones, selectedZoneId]);

  const categories = useMemo(() => {
    if (!menuData) return [];
    if (Array.isArray(menuData.categories)) return menuData.categories;
    return [];
  }, [menuData]);

  const allItems = useMemo(() => {
    if (!menuData) return [];
    if (Array.isArray(menuData.items)) return menuData.items;
    return [];
  }, [menuData]);

  const filteredItems = useMemo(() => {
    return allItems.filter((item: any) => {
      if (selectedCategory !== 'all' && item.category_id !== selectedCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name?.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q);
        if (!matchName && !matchDesc) return false;
      }
      return true;
    });
  }, [allItems, selectedCategory, searchQuery]);

  // Cart Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  }, [cart]);

  const deliveryFee = useMemo(() => {
    if (orderType !== 'delivery') return 0;
    return activeZone ? Number(activeZone.fee) : 0;
  }, [orderType, activeZone]);

  const total = subtotal + deliveryFee;

  const minOrderAmount = orderType === 'delivery' && activeZone ? Number(activeZone.min_order_amount) : 0;
  const isBelowMinOrder = minOrderAmount > 0 && subtotal < minOrderAmount;

  // Add Item to Cart
  const handleItemClick = (item: any) => {
    if (item.modifiers && item.modifiers.length > 0) {
      setActiveItem(item);
      setSelectedModifiers({});
      setItemNote('');
      setItemQty(1);
    } else {
      addToCart(item, 1, [], '');
    }
  };

  const addToCart = (item: any, qty: number, mods: any[] = [], note: string = '') => {
    let price = Number(item.price);
    mods.forEach(m => {
      if (m.price_delta) price += Number(m.price_delta);
    });

    setCart(prev => {
      const existing = prev.find(i =>
        i.menu_item_id === item.id &&
        JSON.stringify(i.modifier_choices || []) === JSON.stringify(mods) &&
        i.notes === note
      );
      if (existing) {
        return prev.map(i =>
          i === existing ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [...prev, {
        menu_item_id: item.id,
        menu_item_name: item.name,
        quantity: qty,
        unit_price: price,
        modifier_choices: mods,
        notes: note,
      }];
    });

    globalToast.success(`Added ${item.name} to order`);
  };

  const updateCartQty = (index: number, delta: number) => {
    setCart(prev => {
      const next = [...prev];
      const newQty = next[index].quantity + delta;
      if (newQty <= 0) {
        return next.filter((_, i) => i !== index);
      }
      next[index] = { ...next[index], quantity: newQty };
      return next;
    });
  };

  // Submit Online Order
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (cart.length === 0) {
      setErrorMsg('Your order cart is empty');
      return;
    }
    if (!customerName.trim()) {
      setErrorMsg('Please enter your name');
      return;
    }
    if (!customerPhone.trim()) {
      setErrorMsg('Please enter your phone number');
      return;
    }

    // Phone validation
    const cleanPhone = customerPhone.replace(/[\s-]/g, '');
    if (!/^(?:\+251|251|0)?([79]\d{8})$/.test(cleanPhone)) {
      setErrorMsg('Please enter a valid Ethiopian phone number (e.g. 0912345678 or 0712345678)');
      return;
    }

    if (orderType === 'delivery') {
      if (!selectedZoneId) {
        setErrorMsg('Please select a delivery zone');
        return;
      }
      if (!deliveryLandmark.trim()) {
        setErrorMsg('Please enter a landmark or building name for delivery');
        return;
      }
      if (isBelowMinOrder) {
        setErrorMsg(`Minimum order for ${activeZone?.name} is ${formatCurrency(minOrderAmount)}. Please add ${formatCurrency(minOrderAmount - subtotal)} more.`);
        return;
      }
    }

    if (['telebirr', 'cbe_birr'].includes(paymentMethod) && !paymentReference.trim()) {
      setErrorMsg('Please enter your transaction reference number for mobile/bank transfer');
      return;
    }

    setSubmitting(true);
    try {
      let paymentProofUrl = null;
      if (proofFile) {
        try {
          const fd = new FormData();
          fd.append('file', proofFile);
          const uploadRes = await api.upload<{ url: string }>('/public/upload-proof', fd);
          paymentProofUrl = uploadRes.url;
        } catch (uploadErr) {
          console.warn('Payment proof upload skipped/failed:', uploadErr);
        }
      }

      const payload = {
        restaurant_id: restaurant.id,
        order_type: orderType,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        delivery_zone_id: orderType === 'delivery' ? selectedZoneId : null,
        delivery_landmark: orderType === 'delivery' ? deliveryLandmark.trim() : null,
        delivery_address: orderType === 'delivery' ? deliveryAddress.trim() : null,
        order_notes: orderNotes.trim(),
        payment_method: paymentMethod,
        payment_reference: paymentReference.trim() || null,
        payment_proof_url: paymentProofUrl,
        honeypot: honeypot || null,
        items: cart.map(i => ({
          menu_item_id: i.menu_item_id,
          quantity: i.quantity,
          modifier_choices: i.modifier_choices || [],
          notes: i.notes || '',
        })),
      };

      const res = await publicApi.placeOnlineOrder(payload);

      if (res && res.tracking_token) {
        globalToast.success('Order placed successfully!');
        // Redirect to tracking page
        navigate(`/track/${res.tracking_token}`);
      } else {
        throw new Error('Order placed but tracking token missing');
      }
    } catch (err: any) {
      console.error('Order submission error:', err);
      setErrorMsg(err.message || 'Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (restLoading || menuLoading) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-3" />
        <p className="text-surface-600 font-medium text-sm">Loading restaurant menu…</p>
      </div>
    );
  }

  if (restError || !restaurant) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-14 h-14 text-red-500 mb-3" />
        <h1 className="text-xl font-bold text-primary">Restaurant Not Found</h1>
        <p className="text-sm text-muted max-w-sm mt-1 mb-4">
          Could not find restaurant with slug "{querySlug}".
        </p>
        <Link to="/" className="btn-primary">Return Home</Link>
      </div>
    );
  }

  const isOnlineOpen = restaurant.online_ordering_enabled;

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col pb-24 lg:pb-12">
      {/* ── Top Header ── */}
      <header className="bg-surface/90 backdrop-blur-md border-b border-default sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {restaurant.logo_url ? (
              <img
                src={assetUrl(restaurant.logo_url)}
                alt={restaurant.name}
                className="w-11 h-11 rounded-2xl object-cover border border-default flex-shrink-0 shadow-sm"
              />
            ) : (
              <div className="w-11 h-11 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 font-extrabold text-lg flex-shrink-0">
                {restaurant.name?.charAt(0)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-extrabold text-base text-primary tracking-tight">
                  {restaurant.name}
                </h1>
                <Badge variant={isOnlineOpen ? 'success' : 'neutral'}>
                  {isOnlineOpen ? 'Accepting Orders' : 'Currently Closed'}
                </Badge>
              </div>
              <p className="text-xs text-muted flex items-center gap-2 mt-0.5">
                {restaurant.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-brand-500" /> {restaurant.phone}
                  </span>
                )}
                {restaurant.address && (
                  <span className="hidden sm:inline text-surface-400">· {restaurant.address}</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />

            {/* Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 rounded-2xl bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="font-bold text-xs hidden sm:inline">
                {formatCurrency(total)}
              </span>
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-500 text-white font-bold text-[10px] rounded-full flex items-center justify-center shadow">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Closed Warning Banner ── */}
      {!isOnlineOpen && (
        <div className="bg-amber-500 text-white px-4 py-2.5 text-center text-xs font-semibold shadow-xs flex items-center justify-center gap-2">
          <Clock className="w-4 h-4" />
          <span>This restaurant is not currently accepting online orders or is outside operating hours. You can still browse the menu!</span>
        </div>
      )}

      {/* ── Main Layout ── */}
      <main className="max-w-6xl mx-auto px-4 py-6 flex-1 w-full flex flex-col lg:flex-row gap-8">
        {/* Left Column: Menu items */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Fulfillment Switcher Banner */}
          <div className="card p-4 sm:p-5 bg-gradient-to-r from-brand-50/80 to-emerald-50/60 border border-brand-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider font-extrabold text-brand-700">Choose Order Type</p>
              <p className="text-sm font-bold text-primary mt-0.5">How would you like to receive your food?</p>
            </div>

            <div className="inline-flex p-1 bg-surface rounded-2xl border border-default shadow-xs">
              <button
                type="button"
                onClick={() => setOrderType('delivery')}
                disabled={!restaurant.online_delivery_enabled}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  orderType === 'delivery'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-surface-600 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed'
                )}
              >
                <Truck className="w-4 h-4" />
                Landmark Delivery
              </button>

              <button
                type="button"
                onClick={() => setOrderType('pickup')}
                disabled={!restaurant.online_pickup_enabled}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  orderType === 'pickup'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-surface-600 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed'
                )}
              >
                <Store className="w-4 h-4" />
                Pickup Takeaway
              </button>
            </div>
          </div>

          {/* Search & Category Tabs */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                type="text"
                placeholder="Search food, drinks, desserts…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input !pl-10 !py-2.5 w-full bg-surface"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-primary">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Categories pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setSelectedCategory('all')}
                className={cn(
                  'px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer',
                  selectedCategory === 'all'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-surface border border-default text-surface-600 hover:border-surface-400'
                )}
              >
                All Items ({allItems.length})
              </button>
              {categories.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={cn(
                    'px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer',
                    selectedCategory === c.id
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'bg-surface border border-default text-surface-600 hover:border-surface-400'
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Items Grid */}
          {filteredItems.length === 0 ? (
            <div className="card p-12 text-center text-muted border border-dashed border-default space-y-2">
              <ShoppingBag className="w-10 h-10 mx-auto text-surface-300" />
              <p className="font-bold text-sm text-primary">No menu items found</p>
              <p className="text-xs">Try searching for something else or clearing filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredItems.map((item: any) => {
                const cartQty = cart
                  .filter(ci => ci.menu_item_id === item.id)
                  .reduce((sum, ci) => sum + ci.quantity, 0);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="card p-4 border border-default/80 hover:border-brand-300 hover:shadow-card transition-all cursor-pointer flex gap-4 group"
                  >
                    {item.image_url ? (
                      <img
                        src={assetUrl(item.image_url)}
                        alt={item.name}
                        className="w-24 h-24 rounded-2xl object-cover border border-default flex-shrink-0 group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-2xl bg-surface-100 flex items-center justify-center text-3xl flex-shrink-0 border border-default">
                        🍲
                      </div>
                    )}

                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold text-sm text-primary group-hover:text-brand-600 transition-colors line-clamp-1">
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="text-xs text-muted line-clamp-2 mt-1">
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 mt-auto">
                        <span className="font-extrabold text-sm text-brand-700 font-mono">
                          {formatCurrency(Number(item.price))}
                        </span>

                        {cartQty > 0 ? (
                          <span className="w-7 h-7 rounded-xl bg-brand-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                            {cartQty}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="w-8 h-8 rounded-xl bg-surface-100 group-hover:bg-brand-50 group-hover:text-brand-600 text-surface-600 flex items-center justify-center transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Checkout Order Box (desktop sticky panel) */}
        <div className="hidden lg:block w-96 flex-shrink-0">
          <div className="card p-6 border border-default/80 sticky top-20 shadow-card space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-default/60">
              <h2 className="font-display font-extrabold text-lg text-primary flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-brand-600" /> Your Order
              </h2>
              <span className="text-xs font-bold text-muted">
                {cart.reduce((s, i) => s + i.quantity, 0)} items
              </span>
            </div>

            {/* Cart Items List */}
            {cart.length === 0 ? (
              <div className="py-8 text-center text-muted space-y-2">
                <ShoppingBag className="w-10 h-10 mx-auto text-surface-300" />
                <p className="text-xs">Your cart is empty.</p>
                <p className="text-[11px] text-surface-400">Click menu items to add them here.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-2 border-b border-surface-100">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="font-bold text-primary truncate">{item.menu_item_name}</p>
                      <p className="text-[10px] text-muted font-mono">{formatCurrency(item.unit_price)} each</p>
                      {item.modifier_choices && item.modifier_choices.length > 0 && (
                        <p className="text-[10px] text-brand-600 truncate">
                          + {item.modifier_choices.map(m => m.name).join(', ')}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => updateCartQty(idx, -1)}
                        className="w-6 h-6 rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-700 flex items-center justify-center cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-bold w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQty(idx, 1)}
                        className="w-6 h-6 rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-700 flex items-center justify-center cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Customer Details Form */}
            <form onSubmit={handleSubmitOrder} className="space-y-4 pt-2">
              {/* Honeypot field (hidden from humans) */}
              <input
                type="text"
                name="company_website_url"
                value={honeypot}
                onChange={e => setHoneypot(e.target.value)}
                style={{ display: 'none', position: 'absolute', left: '-9999px' }}
                tabIndex={-1}
                autoComplete="off"
              />

              <div className="space-y-3">
                <div>
                  <label className="label text-[11px] font-bold text-primary">Your Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Abebe Kebede"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="input !py-2 w-full text-xs"
                  />
                </div>

                <div>
                  <label className="label text-[11px] font-bold text-primary">Phone Number (Ethiopia) *</label>
                  <input
                    type="tel"
                    required
                    placeholder="0911223344 or 0711223344"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    className="input !py-2 w-full text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted mt-0.5">Normalized to +251 format for order updates</p>
                </div>

                {orderType === 'delivery' && (
                  <>
                    <div>
                      <label className="label text-[11px] font-bold text-primary">Delivery Zone *</label>
                      <select
                        value={selectedZoneId}
                        onChange={e => setSelectedZoneId(e.target.value)}
                        className="input !py-2 w-full text-xs cursor-pointer font-medium"
                      >
                        {deliveryZones.filter(z => z.is_active).map(zone => (
                          <option key={zone.id} value={zone.id}>
                            📍 {zone.name} (+{formatCurrency(Number(zone.fee))}, ~{zone.estimated_minutes}m)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label text-[11px] font-bold text-primary">Landmark / Building Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Behind Edna Mall, 3rd Floor"
                        value={deliveryLandmark}
                        onChange={e => setDeliveryLandmark(e.target.value)}
                        className="input !py-2 w-full text-xs"
                      />
                    </div>
                  </>
                )}

                {/* Payment Option */}
                <div>
                  <label className="label text-[11px] font-bold text-primary">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as any)}
                    className="input !py-2 w-full text-xs cursor-pointer font-medium"
                  >
                    <option value="cash">💵 Cash on {orderType === 'delivery' ? 'Delivery' : 'Pickup'}</option>
                    <option value="telebirr">📱 Telebirr Transfer</option>
                    <option value="cbe_birr">🏦 CBE Birr Transfer</option>
                  </select>
                </div>

                {['telebirr', 'cbe_birr'].includes(paymentMethod) && (
                  <div className="p-3 rounded-2xl bg-brand-50/60 border border-brand-200/60 space-y-2">
                    <p className="text-[11px] font-bold text-brand-900">
                      Payment Reference *
                    </p>
                    <input
                      type="text"
                      required
                      placeholder="Transaction reference ID"
                      value={paymentReference}
                      onChange={e => setPaymentReference(e.target.value)}
                      className="input !py-1.5 w-full text-xs font-mono"
                    />
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted flex items-center gap-1 cursor-pointer">
                        <Upload className="w-3 h-3 text-brand-600" /> Upload transfer screenshot (optional)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => setProofFile(e.target.files?.[0] || null)}
                        className="text-[10px] text-surface-500 w-full"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="pt-3 border-t border-default/60 space-y-1.5 text-xs">
                <div className="flex justify-between text-muted">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatCurrency(subtotal)}</span>
                </div>
                {orderType === 'delivery' && (
                  <div className="flex justify-between text-muted">
                    <span>Delivery Fee ({activeZone?.name || 'Zone'})</span>
                    <span className="font-mono font-bold text-emerald-600">{formatCurrency(deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-primary pt-1 border-t border-default/60">
                  <span>Total Amount</span>
                  <span className="font-mono text-brand-700">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Minimum Order Warning */}
              {isBelowMinOrder && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>
                    Minimum order for <strong>{activeZone?.name}</strong> is {formatCurrency(minOrderAmount)}. Please add {formatCurrency(minOrderAmount - subtotal)} more to checkout.
                  </span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || cart.length === 0 || !isOnlineOpen || isBelowMinOrder}
                className="btn-primary w-full py-3 rounded-2xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Placing Order…
                  </span>
                ) : (
                  <span>Place Order ({formatCurrency(total)})</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* ── Mobile Sticky Bottom Checkout Bar ── */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-surface/95 backdrop-blur-md border-t border-default p-4 z-20 shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] text-muted uppercase font-bold tracking-wider">
              {cart.reduce((s, i) => s + i.quantity, 0)} Items · {orderType}
            </p>
            <p className="font-extrabold text-base text-brand-700 font-mono">
              {formatCurrency(total)}
            </p>
          </div>

          <button
            onClick={() => setIsCartOpen(true)}
            className="btn-primary px-6 py-3 rounded-2xl text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer"
          >
            <span>Review & Place Order</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Mobile Drawer Modal for Cart / Checkout ── */}
      {isCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-surface rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-default">
              <h2 className="font-display font-extrabold text-lg text-primary flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-brand-600" /> Complete Order
              </h2>
              <button onClick={() => setIsCartOpen(false)} className="p-2 text-muted hover:text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Cart Items */}
            <div className="space-y-3">
              {cart.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-2 border-b border-surface-100">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="font-bold text-primary">{item.menu_item_name}</p>
                    <p className="text-[10px] text-muted font-mono">{formatCurrency(item.unit_price)} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateCartQty(idx, -1)} className="w-6 h-6 rounded bg-surface-100 flex items-center justify-center">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-bold">{item.quantity}</span>
                    <button onClick={() => updateCartQty(idx, 1)} className="w-6 h-6 rounded bg-surface-100 flex items-center justify-center">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Customer form in mobile modal */}
            <form onSubmit={handleSubmitOrder} className="space-y-4">
              <div>
                <label className="label text-xs font-bold text-primary">Your Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Abebe Kebede"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="input !py-2.5 w-full text-xs"
                />
              </div>

              <div>
                <label className="label text-xs font-bold text-primary">Phone (Ethiopia) *</label>
                <input
                  type="tel"
                  required
                  placeholder="0911223344"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  className="input !py-2.5 w-full text-xs font-mono"
                />
              </div>

              {orderType === 'delivery' && (
                <>
                  <div>
                    <label className="label text-xs font-bold text-primary">Delivery Zone *</label>
                    <select
                      value={selectedZoneId}
                      onChange={e => setSelectedZoneId(e.target.value)}
                      className="input !py-2.5 w-full text-xs cursor-pointer font-medium"
                    >
                      {deliveryZones.filter(z => z.is_active).map(zone => (
                        <option key={zone.id} value={zone.id}>
                          📍 {zone.name} (+{formatCurrency(Number(zone.fee))})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label text-xs font-bold text-primary">Landmark / Building *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Behind Edna Mall, 3rd Floor"
                      value={deliveryLandmark}
                      onChange={e => setDeliveryLandmark(e.target.value)}
                      className="input !py-2.5 w-full text-xs"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="label text-xs font-bold text-primary">Payment Option</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as any)}
                  className="input !py-2.5 w-full text-xs cursor-pointer"
                >
                  <option value="cash">💵 Cash on {orderType === 'delivery' ? 'Delivery' : 'Pickup'}</option>
                  <option value="telebirr">📱 Telebirr Transfer</option>
                  <option value="cbe_birr">🏦 CBE Birr Transfer</option>
                </select>
              </div>

              {['telebirr', 'cbe_birr'].includes(paymentMethod) && (
                <div className="p-3 rounded-2xl bg-brand-50/60 border border-brand-200/60 space-y-2">
                  <p className="text-xs font-bold text-brand-900">Payment Reference *</p>
                  <input
                    type="text"
                    required
                    placeholder="Transaction Reference Number"
                    value={paymentReference}
                    onChange={e => setPaymentReference(e.target.value)}
                    className="input !py-2 w-full text-xs font-mono"
                  />
                </div>
              )}

              {/* Price Breakdown */}
              <div className="pt-2 border-t border-default space-y-1 text-xs">
                <div className="flex justify-between text-muted">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatCurrency(subtotal)}</span>
                </div>
                {orderType === 'delivery' && (
                  <div className="flex justify-between text-muted">
                    <span>Delivery Fee</span>
                    <span className="font-mono font-bold text-emerald-600">{formatCurrency(deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-primary pt-1 border-t border-default">
                  <span>Total Amount</span>
                  <span className="font-mono text-brand-700">{formatCurrency(total)}</span>
                </div>
              </div>

              {isBelowMinOrder && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  Minimum order for {activeZone?.name} is {formatCurrency(minOrderAmount)}.
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || cart.length === 0 || !isOnlineOpen || isBelowMinOrder}
                className="btn-primary w-full py-3.5 rounded-2xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Placing Order…' : `Confirm & Place Order (${formatCurrency(total)})`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
