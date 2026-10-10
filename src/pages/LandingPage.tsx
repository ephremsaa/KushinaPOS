import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChefHat, CheckCircle2, ArrowRight, Star,
  ShoppingCart, BarChart3, Users, Zap, Shield, Wifi,
  Clock, Coffee, Utensils, Smartphone, CreditCard,
  ChevronDown, ChevronUp, Check, Layers, Monitor,
  QrCode, Sparkles, TrendingUp, Award, PhoneCall,
  Laptop, RefreshCw, AlertCircle, Plus, Trash2
} from 'lucide-react';

// Ethiopian Food Demo Items for the interactive simulator
const DEMO_ITEMS = [
  { id: '1', name: 'Special Shekla Tibs', category: 'tibs', price: 550, desc: 'Sizzling prime beef with rosemary & peppers', popular: true },
  { id: '2', name: 'Doro Wat Gourmet Feast', category: 'traditional', price: 650, desc: 'Slow cooked tender chicken with spiced egg', popular: true },
  { id: '3', name: 'Traditional Bayenetu', category: 'traditional', price: 420, desc: 'Assorted fasting stews on fresh injera', popular: false },
  { id: '4', name: 'Special Kitfo (Gomen Besiga)', category: 'traditional', price: 580, desc: 'Prime minced lean beef with spiced butter', popular: true },
  { id: '5', name: 'Habesha Dereq Tibs', category: 'tibs', price: 520, desc: 'Crispy fried beef cubes with awaze & mustard', popular: false },
  { id: '6', name: 'Special Roasted Macchiato', category: 'drinks', price: 80, desc: 'Double shot rich Ethiopian highland espresso', popular: true },
  { id: '7', name: 'Traditional Coffee Ceremony', category: 'drinks', price: 120, desc: 'Clay pot Jebena brew with fresh popcorn', popular: false },
  { id: '8', name: 'Fresh Tej Honey Wine (Carafe)', category: 'drinks', price: 350, desc: 'Traditional fermented raw honey wine', popular: false },
];

const DEMO_CATEGORIES = [
  { id: 'all', name: '🔥 All Items' },
  { id: 'traditional', name: '🍲 Traditional' },
  { id: 'tibs', name: '🥩 Sizzling Tibs' },
  { id: 'drinks', name: '☕ Coffee & Drinks' },
];

export default function LandingPage() {
  // Navigation & Interactive states
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'pos' | 'kds' | 'tables' | 'reports' | 'qr'>('pos');
  const [isAnnualBilling, setIsAnnualBilling] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Interactive POS Simulator State
  const [simCategory, setSimCategory] = useState('all');
  const [simCart, setSimCart] = useState<{ id: string; name: string; price: number; qty: number }[]>([
    { id: '1', name: 'Special Shekla Tibs', price: 550, qty: 1 },
    { id: '6', name: 'Special Roasted Macchiato', price: 80, qty: 2 },
  ]);
  const [simSelectedTable, setSimSelectedTable] = useState('T-04 (Bole Lounge)');
  const [simPaymentStatus, setSimPaymentStatus] = useState<'idle' | 'processing' | 'paid'>('idle');

  // Interactive KDS Simulated State
  const [kdsOrders, setKdsOrders] = useState([
    { id: 'ORD-104', table: 'Table 3', time: '03:45', items: ['2x Shekla Tibs (Medium)', '1x Bayenetu'], status: 'cooking' },
    { id: 'ORD-105', table: 'Table 7', time: '01:12', items: ['1x Doro Wat Gourmet', '2x St. George Beer'], status: 'new' },
    { id: 'ORD-103', table: 'Table 1', time: '08:20', items: ['1x Kitfo Special (Leb-Leb)', '1x Macchiato'], status: 'ready' },
  ]);

  // Add item to simulator cart
  const addToCart = (item: typeof DEMO_ITEMS[0]) => {
    setSimPaymentStatus('idle');
    setSimCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setSimCart(prev => prev.filter(i => i.id !== id));
  };

  const subtotal = simCart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const vat = Math.round(subtotal * 0.15);
  const total = subtotal + vat;

  const handleSimPay = (method: string) => {
    setSimPaymentStatus('processing');
    setTimeout(() => {
      setSimPaymentStatus('paid');
    }, 1200);
  };

  const toggleKdsStatus = (id: string) => {
    setKdsOrders(prev => prev.map(order => {
      if (order.id === id) {
        const nextStatus = order.status === 'new' ? 'cooking' : order.status === 'cooking' ? 'ready' : 'served';
        return { ...order, status: nextStatus };
      }
      return order;
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-primary selection:bg-brand-500 selection:text-white font-sans antialiased overflow-x-hidden">
      
      {/* ── Modern Floating Glassmorphic Header ── */}
      <header className="sticky top-0 sm:top-4 z-50 px-2 sm:px-6">
        <nav className="max-w-7xl mx-auto bg-surface/85 backdrop-blur-2xl border border-default/80 sm:rounded-3xl shadow-sm hover:shadow-md transition-all duration-300">
          <div className="px-4 sm:px-6 flex items-center justify-between h-16 sm:h-20">
            
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-brand-600 rounded-2xl flex items-center justify-center shadow-glow-sm group-hover:scale-105 transition-transform duration-300">
                <ChefHat className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-extrabold text-xl sm:text-2xl text-surface-950 tracking-tight">
                    kushina<span className="text-brand-500">POS</span>
                  </span>
                  <span className="bg-brand-100 text-brand-800 text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider border border-brand-200">
                    ETH
                  </span>
                </div>
                <p className="text-[10px] text-surface-400 font-medium hidden sm:block">Ethiopian Restaurant Management</p>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:flex items-center gap-1 bg-surface-100/70 p-1.5 rounded-full border border-default/50 text-sm font-semibold text-surface-600">
              <a href="#features" className="px-4 py-1.5 rounded-full hover:text-surface-950 hover:bg-surface transition-all">Features</a>
              <a href="#demo" className="px-4 py-1.5 rounded-full hover:text-surface-950 hover:bg-surface transition-all text-brand-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                Live Demo
              </a>
              <a href="#payments" className="px-4 py-1.5 rounded-full hover:text-surface-950 hover:bg-surface transition-all">Telebirr & CBE</a>
              <a href="#pricing" className="px-4 py-1.5 rounded-full hover:text-surface-950 hover:bg-surface transition-all">Pricing</a>
              <a href="#testimonials" className="px-4 py-1.5 rounded-full hover:text-surface-950 hover:bg-surface transition-all">Restaurants</a>
              <a href="#faq" className="px-4 py-1.5 rounded-full hover:text-surface-950 hover:bg-surface transition-all">FAQ</a>
            </div>

            {/* Action Buttons */}
            <div className="hidden sm:flex items-center gap-3">
              <Link
                to="/login"
                className="text-surface-700 hover:text-surface-950 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-surface-100 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm px-5 py-2.5 rounded-2xl shadow-glow-sm hover:shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                <span>Start Free Trial</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="sm:hidden flex items-center gap-2">
              <Link to="/login" className="text-xs font-bold text-surface-700 px-3 py-1.5 rounded-lg bg-surface-100">
                Sign In
              </Link>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-surface-600 hover:text-primary bg-surface-100 rounded-xl"
                aria-label="Toggle Menu"
              >
                <div className="w-5 h-4 flex flex-col justify-between">
                  <span className={`h-0.5 w-full bg-current rounded-full transition-transform ${mobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
                  <span className={`h-0.5 w-full bg-current rounded-full transition-opacity ${mobileMenuOpen ? 'opacity-0' : ''}`} />
                  <span className={`h-0.5 w-full bg-current rounded-full transition-transform ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
                </div>
              </button>
            </div>

          </div>

          {/* Mobile Drawer */}
          {mobileMenuOpen && (
            <div className="sm:hidden border-t border-default/60 p-4 space-y-3 bg-surface/95 backdrop-blur-xl rounded-b-3xl">
              <div className="grid grid-cols-2 gap-2 text-center text-sm font-semibold">
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="p-2.5 bg-surface-50 rounded-xl">Features</a>
                <a href="#demo" onClick={() => setMobileMenuOpen(false)} className="p-2.5 bg-brand-50 text-brand-700 rounded-xl">Live Demo</a>
                <a href="#payments" onClick={() => setMobileMenuOpen(false)} className="p-2.5 bg-surface-50 rounded-xl">Telebirr & CBE</a>
                <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="p-2.5 bg-surface-50 rounded-xl">Pricing</a>
              </div>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="btn-primary w-full justify-center py-3 text-sm font-bold shadow-md"
              >
                Register Your Restaurant (14-Day Free Trial)
              </Link>
            </div>
          )}
        </nav>
      </header>

      {/* ── Hero Section with Ambient Lights ── */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-32 overflow-hidden mesh-gradient">
        {/* Glowing backdrop spheres */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-brand-500/15 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow" />
        <div className="absolute top-10 right-10 w-72 h-72 bg-brand-400/10 rounded-full blur-2xl pointer-events-none -z-10 animate-float" />
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-brand-500/10 rounded-full blur-2xl pointer-events-none -z-10 animate-float-delayed" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center relative z-10">
          
          {/* Status announcement badge */}
          <div className="inline-flex items-center gap-2.5 bg-surface/90 backdrop-blur-md border border-brand-200/80 shadow-sm rounded-full px-4 py-2 text-xs sm:text-sm font-semibold text-surface-800 mb-8 hover:border-brand-300 transition-all cursor-pointer">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-brand-600">NEW:</span>
            <span>Telebirr QR & CBE Automatic Payment Reconciliation</span>
            <span className="hidden md:inline text-surface-400">|</span>
            <span className="hidden md:inline text-muted font-medium">100% Offline-First Mode</span>
          </div>

          {/* Main Hero Headline */}
          <h1 className="font-display font-extrabold text-4xl sm:text-6xl lg:text-7xl text-surface-950 tracking-tight max-w-5xl mx-auto leading-[1.1] mb-6">
            The Intelligent POS for{' '}
            <span className="text-gradient drop-shadow-sm">
              Modern Ethiopian
            </span>{' '}
            Restaurants
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-xl text-surface-600 max-w-3xl mx-auto font-normal leading-relaxed mb-10">
            Streamline order taking, kitchen display tickets, table maps, automated ingredient stock deductions, 
            and instant <strong>Telebirr & CBE</strong> settlement — engineered for restaurants in Addis Ababa and across Ethiopia.
          </p>

          {/* Call to Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto mb-14">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-brand-600 hover:bg-brand-700 text-white text-base font-bold px-8 py-4 rounded-2xl shadow-glow hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              <span>Register Your Restaurant</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="#demo"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-surface hover:bg-surface-50 text-surface-800 border border-default/90 text-base font-bold px-7 py-4 rounded-2xl shadow-sm hover:shadow transition-all"
            >
              <Sparkles className="w-4 h-4 text-brand-500" />
              <span>Try Live Simulator</span>
            </a>
          </div>

          {/* Quick Credibility Trust Pillars */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-4 border-t border-default/60">
            <div className="flex items-center justify-center gap-2.5 p-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
                <Wifi className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-primary">100% Offline Mode</p>
                <p className="text-[11px] text-muted">Zero order loss if WiFi drops</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2.5 p-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 font-bold">
                <CreditCard className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-primary">Telebirr & CBE</p>
                <p className="text-[11px] text-muted">Instant QR & Reference check</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2.5 p-2">
              <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                <Zap className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-primary">&lt; 0.2s Touch Speed</p>
                <p className="text-[11px] text-muted">Blazing fast cashier flow</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2.5 p-2">
              <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
                <Shield className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-primary">Multi-Tenant Cloud</p>
                <p className="text-[11px] text-muted">Private & isolated data</p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── Interactive POS Product Simulator (The Showstopper) ── */}
      <section id="demo" className="py-16 sm:py-24 bg-surface-950 text-white relative overflow-hidden">
        {/* Dark glow accents */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-400 text-xs font-bold uppercase tracking-wider mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Interactive Product Demo
            </div>
            <h2 className="font-display font-extrabold text-3xl sm:text-5xl text-white tracking-tight mb-4">
              Experience the POS live in your browser
            </h2>
            <p className="text-surface-400 text-sm sm:text-base">
              Click dishes, explore kitchen displays, switch table floorplans, and simulate Telebirr payments in real-time.
            </p>
          </div>

          {/* Interactive Mode Tabs */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap mb-8">
            {[
              { id: 'pos', label: '1. Touch POS Terminal', icon: ShoppingCart },
              { id: 'kds', label: '2. Kitchen Screen (KDS)', icon: Zap },
              { id: 'tables', label: '3. Visual Table Map', icon: Layers },
              { id: 'reports', label: '4. Sales Intelligence', icon: BarChart3 },
              { id: 'qr', label: '5. Customer QR Ordering', icon: QrCode },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-glow-sm'
                      : 'bg-surface-900/80 hover:bg-surface-800 text-surface-400 hover:text-white border border-surface-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Device Mockup Shell */}
          <div className="bg-surface-900/90 border border-surface-700/60 rounded-3xl p-3 sm:p-6 shadow-2xl backdrop-blur-2xl">
            
            {/* Top Device Bar */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-surface-800 text-xs text-surface-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-[11px] text-muted">kushinaPOS Terminal v2.4 · Habesha Bistro Bole</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Synced (Offline-Ready)
                </span>
                <span className="hidden sm:inline font-mono">11:42 AM</span>
              </div>
            </div>

            {/* TAB 1: INTERACTIVE POS CASHIER TERMINAL */}
            {activeTab === 'pos' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Menu items grid (7 Cols) */}
                <div className="lg:col-span-7 space-y-4">
                  
                  {/* Category filters */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {DEMO_CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setSimCategory(cat.id)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                          simCategory === cat.id
                            ? 'bg-brand-500 text-white shadow-sm'
                            : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>

                  {/* Food Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                    {DEMO_ITEMS
                      .filter(item => simCategory === 'all' || item.category === simCategory)
                      .map(item => (
                        <div
                          key={item.id}
                          onClick={() => addToCart(item)}
                          className="bg-surface-800/80 hover:bg-surface-800 hover:border-brand-500/60 border border-surface-700/70 rounded-2xl p-3.5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 group flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="font-bold text-sm text-white group-hover:text-brand-400 transition-colors">
                                {item.name}
                              </h4>
                              {item.popular && (
                                <span className="bg-orange-500/20 text-orange-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-orange-500/30">
                                  Top
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-surface-400 line-clamp-1 mb-3">{item.desc}</p>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-surface-700/50">
                            <span className="font-display font-extrabold text-sm text-amber-400">
                              {item.price.toLocaleString()} ETB
                            </span>
                            <span className="w-7 h-7 rounded-xl bg-brand-500/20 group-hover:bg-brand-500 text-brand-400 group-hover:text-white flex items-center justify-center text-xs font-bold transition-all">
                              <Plus className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Live Order Cart (5 Cols) */}
                <div className="lg:col-span-5 bg-surface-950/80 border border-surface-800 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-surface-800 mb-3">
                      <div>
                        <h3 className="font-bold text-sm text-white">Active Order Ticket</h3>
                        <p className="text-xs text-brand-400">{simSelectedTable}</p>
                      </div>
                      <span className="bg-brand-500/10 text-brand-400 text-xs font-bold px-2 py-0.5 rounded-full border border-brand-500/20">
                        {simCart.reduce((sum, i) => sum + i.qty, 0)} Items
                      </span>
                    </div>

                    {/* Cart Items List */}
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 mb-4">
                      {simCart.length === 0 ? (
                        <div className="text-center py-6 text-muted text-xs">
                          Click items on the left to add to order
                        </div>
                      ) : (
                        simCart.map(item => (
                          <div key={item.id} className="flex items-center justify-between bg-surface-900/90 p-2.5 rounded-xl text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-brand-400">{item.qty}x</span>
                              <span className="text-surface-200 font-medium truncate max-w-[120px]">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-surface-300 font-bold">{(item.price * item.qty).toLocaleString()} ETB</span>
                              <button onClick={() => removeFromCart(item.id)} className="text-muted hover:text-red-400">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Bill Breakdown */}
                    <div className="space-y-1.5 text-xs text-surface-400 pt-2 border-t border-surface-800">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span className="text-surface-200 font-mono">{subtotal.toLocaleString()} ETB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>VAT (15% Ethiopian Tax)</span>
                        <span className="text-surface-200 font-mono">{vat.toLocaleString()} ETB</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-surface-800">
                        <span>Total Due</span>
                        <span className="text-amber-400 font-mono text-base font-extrabold">{total.toLocaleString()} ETB</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Simulator Actions */}
                  <div className="pt-4 mt-3 border-t border-surface-800">
                    {simPaymentStatus === 'paid' ? (
                      <div className="bg-emerald-500/20 border border-emerald-500/40 p-3 rounded-xl text-center animate-scale-in">
                        <p className="text-emerald-400 font-bold text-xs flex items-center justify-center gap-1.5 mb-1">
                          <CheckCircle2 className="w-4 h-4" />
                          Payment Approved (Telebirr QR)
                        </p>
                        <p className="text-[11px] text-surface-400">Receipt #2841 printed to kitchen & bar</p>
                        <button
                          onClick={() => setSimPaymentStatus('idle')}
                          className="mt-2 text-[11px] text-surface-300 underline font-semibold"
                        >
                          New Order
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleSimPay('telebirr')}
                            disabled={simPaymentStatus === 'processing' || simCart.length === 0}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Telebirr QR</span>
                          </button>
                          <button
                            onClick={() => handleSimPay('cbe')}
                            disabled={simPaymentStatus === 'processing' || simCart.length === 0}
                            className="bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>CBE Birr</span>
                          </button>
                        </div>
                        <button
                          onClick={() => handleSimPay('cash')}
                          disabled={simPaymentStatus === 'processing' || simCart.length === 0}
                          className="w-full bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold py-2 rounded-xl transition-all disabled:opacity-50"
                        >
                          {simPaymentStatus === 'processing' ? 'Printing 80mm Receipt...' : 'Cash / Till Drawer'}
                        </button>
                      </div>
                    )}
                  </div>

                </div>

              </div>
            )}

            {/* TAB 2: LIVE KITCHEN DISPLAY SYSTEM (KDS) */}
            {activeTab === 'kds' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-surface-400">
                  <span>Kitchen Station: <strong>Hot Grill & Traditional Stoves</strong></span>
                  <span>Active tickets: <strong>{kdsOrders.length}</strong></span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {kdsOrders.map(order => (
                    <div
                      key={order.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        order.status === 'cooking'
                          ? 'bg-amber-950/40 border-amber-500/60'
                          : order.status === 'ready'
                          ? 'bg-emerald-950/40 border-emerald-500/60'
                          : 'bg-surface-800/80 border-surface-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-white">{order.table}</span>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-surface-900 text-amber-400">
                          ⏱ {order.time}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-surface-400 mb-3">{order.id}</p>
                      <ul className="space-y-1 text-xs text-surface-200 mb-4">
                        {order.items.map((item, idx) => (
                          <li key={idx} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                            {item}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => toggleKdsStatus(order.id)}
                        className={`w-full py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                          order.status === 'new'
                            ? 'bg-amber-500 hover:bg-amber-600 text-white'
                            : order.status === 'cooking'
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                            : 'bg-surface-700 text-surface-300'
                        }`}
                      >
                        {order.status === 'new' ? 'Start Cooking' : order.status === 'cooking' ? 'Mark Ready for Waiter' : 'Served ✓'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: TABLE FLOOR PLAN */}
            {activeTab === 'tables' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-surface-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Available (3)</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Dining (4)</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Billing (1)</span>
                  </div>
                  <span className="text-surface-400 text-xs">Capacity: 36 Guests</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: 'T-01', cap: 4, guests: 0, status: 'available', bill: 0 },
                    { id: 'T-02', cap: 6, guests: 5, status: 'dining', bill: 1850 },
                    { id: 'T-03', cap: 2, guests: 2, status: 'dining', bill: 640 },
                    { id: 'T-04', cap: 8, guests: 7, status: 'billing', bill: 3420 },
                    { id: 'T-05', cap: 4, guests: 0, status: 'available', bill: 0 },
                    { id: 'T-06', cap: 4, guests: 4, status: 'dining', bill: 1120 },
                    { id: 'T-07', cap: 2, guests: 2, status: 'dining', bill: 750 },
                    { id: 'T-08', cap: 6, guests: 0, status: 'available', bill: 0 },
                  ].map(table => (
                    <div
                      key={table.id}
                      onClick={() => setSimSelectedTable(`${table.id} (Main Hall)`)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] ${
                        table.status === 'available'
                          ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-500'
                          : table.status === 'dining'
                          ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-500'
                          : 'bg-blue-950/20 border-blue-500/40 hover:border-blue-500'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-white text-sm">{table.id}</span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          table.status === 'available' ? 'bg-emerald-500/20 text-emerald-400' :
                          table.status === 'dining' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {table.status}
                        </span>
                      </div>
                      <p className="text-xs text-surface-400">Seats: {table.cap} Max</p>
                      {table.status !== 'available' && (
                        <p className="text-xs font-mono font-bold text-amber-400 mt-2">
                          Active: {table.bill.toLocaleString()} ETB
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: REAL-TIME SALES REPORTS */}
            {activeTab === 'reports' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="bg-surface-800/80 p-4 rounded-2xl border border-surface-700">
                    <p className="text-xs text-surface-400">Today's Revenue</p>
                    <p className="text-2xl font-extrabold font-display text-emerald-400 mt-1">42,850 ETB</p>
                    <p className="text-[10px] text-emerald-500 mt-0.5">↑ 18% vs last Saturday</p>
                  </div>
                  <div className="bg-surface-800/80 p-4 rounded-2xl border border-surface-700">
                    <p className="text-xs text-surface-400">Total Orders</p>
                    <p className="text-2xl font-extrabold font-display text-white mt-1">114</p>
                    <p className="text-[10px] text-surface-400 mt-0.5">Avg: 375 ETB / ticket</p>
                  </div>
                  <div className="bg-surface-800/80 p-4 rounded-2xl border border-surface-700">
                    <p className="text-xs text-surface-400">Telebirr & CBE</p>
                    <p className="text-2xl font-extrabold font-display text-amber-400 mt-1">72%</p>
                    <p className="text-[10px] text-surface-400 mt-0.5">Cashless settlement rate</p>
                  </div>
                  <div className="bg-surface-800/80 p-4 rounded-2xl border border-surface-700">
                    <p className="text-xs text-surface-400">Avg Table Turn</p>
                    <p className="text-2xl font-extrabold font-display text-blue-400 mt-1">26m</p>
                    <p className="text-[10px] text-surface-400 mt-0.5">40% faster kitchen flow</p>
                  </div>
                </div>

                <div className="bg-surface-800/50 p-4 rounded-2xl border border-surface-700 text-xs">
                  <h4 className="font-bold text-white mb-3">Top Selling Items Today</h4>
                  <div className="space-y-2">
                    {[
                      { name: 'Special Shekla Tibs', qty: 38, revenue: '20,900 ETB', pct: 85 },
                      { name: 'Doro Wat Gourmet Feast', qty: 24, revenue: '15,600 ETB', pct: 60 },
                      { name: 'Special Roasted Macchiato', qty: 62, revenue: '4,960 ETB', pct: 95 },
                    ].map(item => (
                      <div key={item.name} className="space-y-1">
                        <div className="flex justify-between text-surface-300 font-medium">
                          <span>{item.name} ({item.qty} sold)</span>
                          <span className="font-mono text-white font-bold">{item.revenue}</span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-900 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-brand-500 to-amber-400 rounded-full" style={{ width: `${item.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: QR MENU ORDERING */}
            {activeTab === 'qr' && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-8 py-4">
                <div className="w-56 bg-surface text-primary rounded-3xl p-4 shadow-2xl border-4 border-surface-800">
                  <div className="w-12 h-1 bg-surface-300 rounded-full mx-auto mb-3" />
                  <div className="text-center mb-3">
                    <p className="text-[10px] uppercase font-bold text-brand-600 tracking-wider">Habesha Lounge</p>
                    <h5 className="font-bold text-xs">Table 4 Digital Menu</h5>
                  </div>
                  <div className="bg-brand-50 border border-brand-200 rounded-xl p-2 text-center mb-3">
                    <QrCode className="w-28 h-28 mx-auto text-brand-700" />
                    <p className="text-[9px] text-brand-800 font-semibold mt-1">Scan with phone camera</p>
                  </div>
                  <p className="text-[10px] text-muted text-center">Customers browse, order, & pay without waiting for a printed menu.</p>
                </div>
                <div className="max-w-md space-y-3 text-left">
                  <span className="badge-orange text-xs">Self-Service QR Technology</span>
                  <h3 className="font-display font-bold text-xl text-white">Let customers order directly from their tables</h3>
                  <p className="text-xs text-surface-400 leading-relaxed">
                    Place unique QR stands on each table. Guests scan with iPhone or Android, see beautiful food photos, select modifiers, and send orders straight to your kitchen screen.
                  </p>
                  <ul className="text-xs text-surface-300 space-y-1.5">
                    <li className="flex items-center gap-2">✓ No app download required for guests</li>
                    <li className="flex items-center gap-2">✓ Increases average check size by 22%</li>
                    <li className="flex items-center gap-2">✓ Cuts waiter running time in half</li>
                  </ul>
                </div>
              </div>
            )}

          </div>

        </div>
      </section>

      {/* ── Ethiopian Payment Ecosystem Deep-Dive ── */}
      <section id="payments" className="py-20 bg-surface border-b border-default/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold uppercase tracking-wider">
                <CreditCard className="w-3.5 h-3.5" />
                Local Payment Engine
              </div>

              <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-surface-950 tracking-tight leading-tight">
                Built specifically for <br />
                <span className="text-gradient">Telebirr & CBE Birr</span>
              </h2>

              <p className="text-base text-surface-600 leading-relaxed">
                No more confusing manual screenshots or delayed receipts. kushinaPOS seamlessly displays 
                dynamic QR codes for Telebirr and provides one-click reference code validation for CBE transfers.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-surface-50 border border-default/80">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold flex-shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-primary">Dynamic Telebirr QR Codes</h4>
                    <p className="text-xs text-muted mt-0.5">The exact Birr amount and order ID are pre-encoded into the QR code so guests pay in 3 seconds.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-surface-50 border border-default/80">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 font-bold flex-shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-primary">CBE Mobile Banking Approval</h4>
                    <p className="text-xs text-muted mt-0.5">Upload payment slip screenshots or type the transaction reference code for immediate till reconciliation.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-surface-50 border border-default/80">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 font-bold flex-shrink-0">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-primary">80mm Thermal Receipt Printing</h4>
                    <p className="text-xs text-muted mt-0.5">Auto-print formatted customer bills & kitchen prep tickets in Amharic & English with Ethiopian VAT breakdown.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Phone / Tablet Graphic */}
            <div className="lg:col-span-6 relative">
              <div className="bg-gradient-to-tr from-brand-500 to-amber-400 p-1 rounded-3xl shadow-2xl">
                <div className="bg-surface-900 rounded-[22px] p-6 text-white space-y-5">
                  <div className="flex items-center justify-between border-b border-surface-800 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold text-surface-200">Telebirr Checkout Terminal</span>
                    </div>
                    <span className="text-xs font-mono bg-surface-800 px-2.5 py-1 rounded-lg">ETB Currency</span>
                  </div>

                  <div className="text-center py-4 bg-surface-950/60 rounded-2xl border border-surface-800">
                    <p className="text-xs text-surface-400 mb-1">Total Bill for Table 4</p>
                    <p className="font-display font-extrabold text-3xl text-emerald-400">1,240.00 ETB</p>
                    <div className="mt-4 p-3 bg-surface inline-block rounded-2xl shadow-inner">
                      <QrCode className="w-32 h-32 text-surface-950" />
                    </div>
                    <p className="text-[11px] text-surface-400 mt-2 font-mono">telebirr://pay?ref=KSH-8491&amt=1240</p>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2">
                    <span className="text-surface-400">Transaction Status:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Customer Scan
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── Comprehensive Features Bento Grid ── */}
      <section id="features" className="py-20 sm:py-28 bg-surface-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-100 border border-brand-200 text-brand-800 text-xs font-bold uppercase tracking-wider mb-4">
              <Layers className="w-3.5 h-3.5" />
              Full Restaurant Operating System
            </div>
            <h2 className="font-display font-extrabold text-3xl sm:text-5xl text-surface-950 tracking-tight mb-4">
              Everything required to run a high-volume restaurant
            </h2>
            <p className="text-surface-600 text-base sm:text-lg">
              Designed from real restaurant floor testing across Addis Ababa.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Feature 1 */}
            <div className="card-hover bg-surface p-8 rounded-3xl border border-default/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 mb-6">
                  <Wifi className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-xl text-primary mb-2">Offline-First Engine</h3>
                <p className="text-sm text-muted leading-relaxed">
                  Never stop taking orders when Ethio Telecom or local WiFi disconnects. Orders store locally on tablets and automatically sync to the cloud when online.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-surface-100 flex items-center gap-2 text-xs font-bold text-brand-600">
                <span>100% Zero Data Loss</span>
                <Check className="w-4 h-4" />
              </div>
            </div>

            {/* Feature 2 */}
            <div className="card-hover bg-surface p-8 rounded-3xl border border-default/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 mb-6">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-xl text-primary mb-2">Kitchen Display (KDS)</h3>
                <p className="text-sm text-muted leading-relaxed">
                  Replace messy paper kitchen slips with high-visibility color-coded kitchen displays. Chefs see timers, special notes, and order priorities in real time.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-surface-100 flex items-center gap-2 text-xs font-bold text-amber-600">
                <span>40% Faster Prep Times</span>
                <Check className="w-4 h-4" />
              </div>
            </div>

            {/* Feature 3 */}
            <div className="card-hover bg-surface p-8 rounded-3xl border border-default/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-6">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-xl text-primary mb-2">Table & Floor Map</h3>
                <p className="text-sm text-muted leading-relaxed">
                  Visual layout of your dining rooms, lounge, and outdoor patio. Move guests, split checks across multiple payers, or merge tables seamlessly.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-surface-100 flex items-center gap-2 text-xs font-bold text-blue-600">
                <span>Drag & Drop Table Editor</span>
                <Check className="w-4 h-4" />
              </div>
            </div>

            {/* Feature 4 */}
            <div className="card-hover bg-surface p-8 rounded-3xl border border-default/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 mb-6">
                  <Utensils className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-xl text-primary mb-2">Recipe Stock Deduction</h3>
                <p className="text-sm text-muted leading-relaxed">
                  Link menu dishes to raw ingredients (kg of meat, liters of oil, onions, teff flour). Every order automatically deducts inventory and triggers low-stock alerts.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-surface-100 flex items-center gap-2 text-xs font-bold text-purple-600">
                <span>Automated Waste Control</span>
                <Check className="w-4 h-4" />
              </div>
            </div>

            {/* Feature 5 */}
            <div className="card-hover bg-surface p-8 rounded-3xl border border-default/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-6">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-xl text-primary mb-2">Staff Shifts & 4-Digit PINs</h3>
                <p className="text-sm text-muted leading-relaxed">
                  Fast waiter & cashier switching on shared tablets via 4-digit PINs. Track clock-in attendance, tips, sales per staff, and prevent unauthorized voids.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-surface-100 flex items-center gap-2 text-xs font-bold text-emerald-600">
                <span>Role-Based Access Control</span>
                <Check className="w-4 h-4" />
              </div>
            </div>

            {/* Feature 6 */}
            <div className="card-hover bg-surface p-8 rounded-3xl border border-default/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 mb-6">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-xl text-primary mb-2">Cloud Sales Analytics</h3>
                <p className="text-sm text-muted leading-relaxed">
                  Monitor your daily profit, top performing dishes, cash drawer balances, and peak customer hours from your smartphone anywhere in the world.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-surface-100 flex items-center gap-2 text-xs font-bold text-rose-600">
                <span>Export to Excel & PDF</span>
                <Check className="w-4 h-4" />
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── Transparent Pricing with Toggle ── */}
      <section id="pricing" className="py-20 sm:py-28 bg-surface relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-100 border border-brand-200 text-brand-800 text-xs font-bold uppercase tracking-wider mb-4">
              <Award className="w-3.5 h-3.5" />
              Fair & Transparent
            </div>
            <h2 className="font-display font-extrabold text-3xl sm:text-5xl text-surface-950 tracking-tight mb-4">
              Simple pricing in Ethiopian Birr (ETB)
            </h2>
            <p className="text-surface-600 text-base sm:text-lg mb-8">
              No foreign currency requirements. Pay locally via Telebirr or CBE. 14-day risk-free trial.
            </p>

            {/* Billing Toggle */}
            <div className="inline-flex items-center gap-3 bg-surface-100 p-1.5 rounded-2xl border border-default/80">
              <button
                onClick={() => setIsAnnualBilling(false)}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                  !isAnnualBilling ? 'bg-surface text-surface-950 shadow-sm' : 'text-surface-600 hover:text-primary'
                }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setIsAnnualBilling(true)}
                className={`px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all ${
                  isAnnualBilling ? 'bg-brand-500 text-white shadow-sm' : 'text-surface-600 hover:text-primary'
                }`}
              >
                <span>Annual Billing</span>
                <span className="bg-amber-400 text-surface-950 text-[10px] font-black px-1.5 py-0.5 rounded-md">
                  SAVE 17%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
            
            {/* Starter Plan */}
            <div className="bg-surface-50/80 border border-default rounded-3xl p-8 flex flex-col justify-between hover:shadow-lg transition-all duration-300">
              <div>
                <div className="mb-4">
                  <h3 className="font-display font-bold text-2xl text-primary">Starter</h3>
                  <p className="text-xs text-muted mt-1">Ideal for small coffee shops, juice bars, & bistros.</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display font-extrabold text-4xl text-surface-950">
                      {isAnnualBilling ? '416' : '500'}
                    </span>
                    <span className="text-sm font-bold text-muted">ETB / month</span>
                  </div>
                  <p className="text-xs text-surface-400 mt-1">
                    {isAnnualBilling ? 'Billed 5,000 ETB annually' : 'Billed monthly'}
                  </p>
                </div>

                <ul className="space-y-3 text-sm text-surface-600 mb-8">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span>Up to <strong>5 staff accounts</strong></span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span><strong>1 POS Terminal</strong></span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span>Full Menu & Order taking</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span>Telebirr & CBE Payment tracking</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span>Standard sales reports</span>
                  </li>
                </ul>
              </div>

              <Link to="/register" className="btn-secondary w-full justify-center py-3 text-sm font-bold">
                Start 14-Day Free Trial
              </Link>
            </div>

            {/* Growth Plan (MOST POPULAR) */}
            <div className="bg-surface border-2 border-brand-500 rounded-3xl p-8 flex flex-col justify-between shadow-glow relative transform lg:-translate-y-2">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-brand-500 to-amber-500 text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-md">
                  ★ MOST POPULAR
                </span>
              </div>

              <div>
                <div className="mb-4 pt-2">
                  <h3 className="font-display font-bold text-2xl text-primary">Growth</h3>
                  <p className="text-xs text-muted mt-1">For full-service restaurants, lounges, & bars.</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display font-extrabold text-4xl text-brand-600">
                      {isAnnualBilling ? '1,000' : '1,200'}
                    </span>
                    <span className="text-sm font-bold text-muted">ETB / month</span>
                  </div>
                  <p className="text-xs text-surface-400 mt-1">
                    {isAnnualBilling ? 'Billed 12,000 ETB annually' : 'Billed monthly'}
                  </p>
                </div>

                <ul className="space-y-3 text-sm text-surface-700 mb-8 font-medium">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span>Up to <strong>20 staff accounts</strong></span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span><strong>3 POS Terminals</strong> + Table tablets</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span><strong>Kitchen Display System (KDS)</strong></span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span><strong>Recipe & Inventory Deduction</strong></span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span>Customer Table QR Digital Menus</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span>Priority WhatsApp & Phone Support</span>
                  </li>
                </ul>
              </div>

              <Link to="/register" className="btn-primary w-full justify-center py-3.5 text-sm font-bold shadow-glow-sm">
                Start 14-Day Free Trial
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-surface-50/80 border border-default rounded-3xl p-8 flex flex-col justify-between hover:shadow-lg transition-all duration-300">
              <div>
                <div className="mb-4">
                  <h3 className="font-display font-bold text-2xl text-primary">Enterprise</h3>
                  <p className="text-xs text-muted mt-1">For multi-branch restaurant chains & hotel dining.</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display font-extrabold text-4xl text-surface-950">
                      {isAnnualBilling ? '2,083' : '2,500'}
                    </span>
                    <span className="text-sm font-bold text-muted">ETB / month</span>
                  </div>
                  <p className="text-xs text-surface-400 mt-1">
                    {isAnnualBilling ? 'Billed 25,000 ETB annually' : 'Billed monthly'}
                  </p>
                </div>

                <ul className="space-y-3 text-sm text-surface-600 mb-8">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span><strong>Unlimited staff accounts</strong></span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span><strong>10+ POS Terminals</strong></span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span>Everything in Growth</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span>Multi-Branch Central Reporting</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span>Custom API & Fiscal Machine Sync</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span>Dedicated On-Site Account Manager</span>
                  </li>
                </ul>
              </div>

              <Link to="/register" className="btn-secondary w-full justify-center py-3 text-sm font-bold">
                Start 14-Day Free Trial
              </Link>
            </div>

          </div>

          {/* Guarantee pill */}
          <div className="text-center mt-12 text-xs text-muted">
            🔒 No credit card required. Cancel anytime. We assist with hardware setup in Addis Ababa.
          </div>

        </div>
      </section>

      {/* ── Testimonials from Ethiopian Restaurant Owners ── */}
      <section id="testimonials" className="py-20 bg-surface-100/70 border-t border-b border-default/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-surface-950 tracking-tight mb-3">
              Trusted by 500+ restaurants across Ethiopia
            </h2>
            <p className="text-muted text-sm sm:text-base">
              See what managers and head chefs in Addis Ababa are saying about kushinaPOS.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="bg-surface p-7 rounded-3xl border border-default/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1 text-amber-400 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-sm text-surface-700 leading-relaxed italic mb-6">
                  "The offline capability literally saved our restaurant during weekend network outages in Bole. 
                  Our waiters kept taking orders on tablets and kitchen tickets printed smoothly without interruption."
                </p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-surface-100">
                <div className="w-10 h-10 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center text-sm">
                  YD
                </div>
                <div>
                  <h4 className="font-bold text-sm text-primary">Yared Dawit</h4>
                  <p className="text-xs text-surface-400">General Manager · Habesha Bistro (Bole)</p>
                </div>
              </div>
            </div>

            <div className="bg-surface p-7 rounded-3xl border border-default/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1 text-amber-400 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-sm text-surface-700 leading-relaxed italic mb-6">
                  "Telebirr and CBE payment verification used to create huge cashier queues. With kushinaPOS, 
                  generating dynamic QR bills is instant and cashier errors dropped to zero."
                </p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-surface-100">
                <div className="w-10 h-10 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-sm">
                  SH
                </div>
                <div>
                  <h4 className="font-bold text-sm text-primary">Selamawit Haile</h4>
                  <p className="text-xs text-surface-400">Founder & Head Chef · Lucy Grill (Kazanchis)</p>
                </div>
              </div>
            </div>

            <div className="bg-surface p-7 rounded-3xl border border-default/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1 text-amber-400 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-sm text-surface-700 leading-relaxed italic mb-6">
                  "The recipe inventory deduction is brilliant. We know exactly how many kilograms of prime beef 
                  and liters of cooking oil we used by the end of each day."
                </p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-surface-100">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm">
                  TB
                </div>
                <div>
                  <h4 className="font-bold text-sm text-primary">Tewodros Bekele</h4>
                  <p className="text-xs text-surface-400">Operations Director · Abyssinia Roasters (Piassa)</p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── Interactive FAQ Section ── */}
      <section id="faq" className="py-20 bg-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          
          <div className="text-center mb-12">
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-surface-950 tracking-tight mb-3">
              Frequently Asked Questions
            </h2>
            <p className="text-muted text-sm">
              Have questions about hardware, payments, or setting up? We’re here to help.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                q: "What happens if our internet connection in Addis Ababa goes down?",
                a: "kushinaPOS is built offline-first. Your POS terminals continue taking orders, firing kitchen tickets, and processing cash transactions without internet. As soon as connectivity restores, all transactions automatically synchronize to the cloud."
              },
              {
                q: "How does payment settlement work with Telebirr and CBE?",
                a: "Guests can scan dynamic Telebirr QR codes directly from the POS screen or printed bill. For CBE mobile banking transfers, your cashier enters the transaction reference number or verifies the payment slip, and the till updates instantly."
              },
              {
                q: "What hardware and thermal printers are supported?",
                a: "kushinaPOS runs on any Android tablet, iPad, Touchscreen PC, or standard laptop. It connects with standard 80mm ESC/POS USB, Bluetooth, or LAN receipt printers and cash drawers."
              },
              {
                q: "How long does setup take for my restaurant?",
                a: "You can sign up and import your entire menu within 15 minutes using our CSV import tool. Our local Addis Ababa team also offers free on-site training and hardware configuration."
              },
              {
                q: "Can I manage multiple branches under one account?",
                a: "Yes! With the Enterprise plan, owners can view consolidated analytics across all branches (e.g. Bole, Kazanchis, Hawassa) from a single master dashboard."
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="border border-default rounded-2xl overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full p-5 text-left font-bold text-primary flex items-center justify-between gap-4 bg-surface-50/50 hover:bg-surface-50"
                >
                  <span className="text-sm sm:text-base">{item.q}</span>
                  {openFaq === idx ? (
                    <ChevronUp className="w-5 h-5 text-brand-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-surface-400 flex-shrink-0" />
                  )}
                </button>
                {openFaq === idx && (
                  <div className="p-5 pt-0 bg-surface-50/50 text-surface-600 text-sm leading-relaxed border-t border-default/40">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── High-Converting Call to Action Banner ── */}
      <section className="py-20 sm:py-24 bg-brand-700 text-white relative overflow-hidden">
        {/* Glow circles */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-surface/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-400/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-surface/20 backdrop-blur-md rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wider mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            Modernize Your Restaurant Today
          </div>

          <h2 className="font-display font-extrabold text-3xl sm:text-5xl tracking-tight mb-6">
            Ready to upgrade your restaurant’s speed and profitability?
          </h2>

          <p className="text-brand-100 text-base sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            Join hundreds of Ethiopian restaurateurs running smooth operations on kushinaPOS.
            Start your free 14-day trial now — zero risk, no card required.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-surface text-brand-600 hover:bg-brand-50 text-base font-extrabold px-9 py-4 rounded-2xl shadow-2xl hover:scale-105 transition-all duration-200"
            >
              <span>Register Your Restaurant</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand-700/60 hover:bg-brand-700 text-white text-base font-bold px-7 py-4 rounded-2xl border border-white/20 transition-all"
            >
              <span>Sign In to Existing Account</span>
            </Link>
          </div>

          <p className="text-xs text-brand-200 mt-8">
            Need urgent help or hardware guidance? Call our Addis Ababa support team at <strong>+251 91 100 0000</strong>
          </p>
        </div>
      </section>

      {/* ── Modern Polished Footer ── */}
      <footer className="bg-surface-950 text-surface-400 py-14 border-t border-surface-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            
            {/* Column 1: Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gradient-to-tr from-brand-600 to-amber-500 rounded-xl flex items-center justify-center text-white">
                  <ChefHat className="w-5 h-5" />
                </div>
                <span className="font-display font-extrabold text-xl text-white">
                  kushina<span className="text-brand-500">POS</span>
                </span>
              </div>
              <p className="text-xs text-surface-400 leading-relaxed">
                The all-in-one restaurant management platform for Ethiopian dining, cafes, lounges, and multi-branch restaurants.
              </p>
              <div className="text-xs text-emerald-400 flex items-center gap-1.5 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                All Systems Operational
              </div>
            </div>

            {/* Column 2: Product */}
            <div>
              <h4 className="font-bold text-sm text-white mb-4">Product</h4>
              <ul className="space-y-2 text-xs text-surface-400">
                <li><a href="#demo" className="hover:text-white transition-colors">Touch POS Terminal</a></li>
                <li><a href="#demo" className="hover:text-white transition-colors">Kitchen Display (KDS)</a></li>
                <li><a href="#demo" className="hover:text-white transition-colors">Table Floorplan Map</a></li>
                <li><a href="#features" className="hover:text-white transition-colors">Recipe Stock Control</a></li>
                <li><a href="#payments" className="hover:text-white transition-colors">Telebirr & CBE Birr</a></li>
              </ul>
            </div>

            {/* Column 3: Portals */}
            <div>
              <h4 className="font-bold text-sm text-white mb-4">Quick Portals</h4>
              <ul className="space-y-2 text-xs text-surface-400">
                <li><Link to="/login" className="hover:text-white transition-colors">Staff & Manager Login</Link></li>
                <li><Link to="/register" className="hover:text-white transition-colors">Register New Restaurant</Link></li>
                <li><Link to="/admin" className="hover:text-white transition-colors">Platform Admin Portal</Link></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing & Plans</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">Help & FAQ</a></li>
              </ul>
            </div>

            {/* Column 4: Contact */}
            <div>
              <h4 className="font-bold text-sm text-white mb-4">Addis Ababa Office</h4>
              <p className="text-xs text-surface-400 leading-relaxed mb-3">
                Bole Medhanialem, Edna Mall Area<br />
                Addis Ababa, Ethiopia
              </p>
              <p className="text-xs text-surface-300 font-bold mb-1">
                Support: tsaron880@gmail.com
              </p>
              <p className="text-xs text-surface-300 font-bold">
                Phone: +251 91 100 0000
              </p>
            </div>

          </div>

          <div className="pt-8 border-t border-surface-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
            <p>© {new Date().getFullYear()} kushinaPOS Inc. Built with pride for Ethiopian Restaurants.</p>
            <div className="flex items-center gap-4">
              <span>Privacy Policy</span>
              <span>•</span>
              <span>Terms of Service</span>
              <span>•</span>
              <span>Made in Ethiopia 🇪🇹</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
