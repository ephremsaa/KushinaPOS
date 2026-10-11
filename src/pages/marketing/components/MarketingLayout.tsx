import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useLeadModal } from '../context/LeadModalContext';
import { MARKETING_TRANSLATIONS } from '../data/marketingTranslations';
import { LanguageSwitcher } from '../../../components/ui/LanguageSwitcher';
import {
  ChefHat, ChevronDown, X, Menu, Phone,
  UtensilsCrossed, Coffee, Wine, Cake, Zap, Building2,
  Monitor, Cpu, CreditCard, Layers, Globe,
  ShieldCheck, ArrowRight, Sparkles, Send, HelpCircle
} from 'lucide-react';

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export function MarketingLayout({ children }: MarketingLayoutProps) {
  const { lang } = useLanguage();
  const { openLeadModal } = useLeadModal();
  const isAm = lang === 'am';
  const t = MARKETING_TRANSLATIONS[lang] || MARKETING_TRANSLATIONS.en;
  const location = useLocation();

  // ── Promo bar state ──────────────────────────────────────────
  const [promoDismissed, setPromoDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kushina_promo_dismissed') === 'true';
    }
    return false;
  });

  const dismissPromo = () => {
    setPromoDismissed(true);
    localStorage.setItem('kushina_promo_dismissed', 'true');
  };

  // ── Cookie notice state ──────────────────────────────────────
  const [cookieConsent, setCookieConsent] = useState<'pending' | 'accepted' | 'essential'>('accepted');

  useEffect(() => {
    const saved = localStorage.getItem('kushina_cookie_consent');
    if (!saved) {
      setCookieConsent('pending');
    }
  }, []);

  const handleCookie = (choice: 'accepted' | 'essential') => {
    localStorage.setItem('kushina_cookie_consent', choice);
    setCookieConsent(choice);
  };

  // ── Mega menu dropdown states ────────────────────────────────
  const [activeMenu, setActiveMenu] = useState<'solutions' | 'product' | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const solutionsRef = useRef<HTMLDivElement>(null);
  const productRef = useRef<HTMLDivElement>(null);

  // Close menus on route change
  useEffect(() => {
    setActiveMenu(null);
    setMobileMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        solutionsRef.current && !solutionsRef.current.contains(event.target as Node) &&
        productRef.current && !productRef.current.contains(event.target as Node)
      ) {
        setActiveMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, menuKey: 'solutions' | 'product') => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setActiveMenu(activeMenu === menuKey ? null : menuKey);
    } else if (e.key === 'Escape') {
      setActiveMenu(null);
    }
  };

  const solutionsList = [
    { to: '/solutions/restaurants', name: t.solRestaurants, desc: t.solRestaurantsDesc, icon: UtensilsCrossed, color: 'text-amber-600 bg-amber-50' },
    { to: '/solutions/cafes',       name: t.solCafes,       desc: t.solCafesDesc,       icon: Coffee,          color: 'text-orange-600 bg-orange-50' },
    { to: '/solutions/bars',        name: t.solBars,        desc: t.solBarsDesc,        icon: Wine,            color: 'text-purple-600 bg-purple-50' },
    { to: '/solutions/bakeries',    name: t.solBakeries,    desc: t.solBakeriesDesc,    icon: Cake,            color: 'text-pink-600 bg-pink-50' },
    { to: '/solutions/fast-food',   name: t.solFastFood,    desc: t.solFastFoodDesc,    icon: Zap,             color: 'text-yellow-600 bg-yellow-50' },
    { to: '/solutions/hotels',      name: t.solHotels,      desc: t.solHotelsDesc,      icon: Building2,       color: 'text-emerald-600 bg-emerald-50' },
  ];

  const productList = [
    { to: '/features',     name: t.prodFeatures,     desc: t.prodFeaturesDesc,     icon: Monitor,    color: 'text-brand-600 bg-brand-50' },
    { to: '/hardware',     name: t.prodHardware,     desc: t.prodHardwareDesc,     icon: Cpu,        color: 'text-blue-600 bg-blue-50' },
    { to: '/payments',     name: t.prodPayments,     desc: t.prodPaymentsDesc,     icon: CreditCard, color: 'text-emerald-600 bg-emerald-50' },
    { to: '/integrations', name: t.prodIntegrations, desc: t.prodIntegrationsDesc, icon: Layers,     color: 'text-indigo-600 bg-indigo-50' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-surface-900 font-sans selection:bg-brand-500 selection:text-white">

      {/* ── 1. Top Promo Bar ── */}
      {!promoDismissed && (
        <aside
          aria-label="Announcement"
          className="bg-surface-950 text-white text-xs px-3 py-2 sm:py-2.5 relative z-50 border-b border-surface-800 transition-all"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-2">
              <span className="font-medium text-slate-200 text-[11px] sm:text-xs">
                {t.promoText}
              </span>
              <Link
                to="/features"
                className="inline-flex items-center gap-1 font-bold text-brand-300 hover:text-brand-200 underline underline-offset-4 text-[11px] sm:text-xs transition-colors"
              >
                {t.promoButton} <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <button
              type="button"
              onClick={dismissPromo}
              aria-label="Dismiss announcement"
              className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>
      )}

      {/* ── 2. Sticky Glassmorphic Header ── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-surface-200/80 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">

            {/* Brand Logo */}
            <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-2xl">
              <img
                src="/kushinaPOStrace.png"
                alt="kushinaPOS"
                className="w-10 h-10 sm:w-11 sm:h-11 object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-200"
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-extrabold text-xl sm:text-2xl text-surface-950 tracking-tight">
                    kushina<span className="text-brand-600">POS</span>
                  </span>
                  <span className="bg-brand-50 text-brand-700 text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider border border-brand-200">
                    ETH
                  </span>
                </div>
                <span className="text-[10px] text-surface-500 font-medium hidden sm:block -mt-0.5">
                  {isAm ? 'የኢትዮጵያ ሬስቶራንት ኦፕሬቲንግ ሲስተም' : 'Ethiopian Hospitality System'}
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links & Mega Menus */}
            <nav className="hidden lg:flex items-center gap-1 xl:gap-2 text-sm font-semibold text-surface-700">
              
              {/* Solutions Mega Menu */}
              <div ref={solutionsRef} className="relative">
                <button
                  type="button"
                  aria-expanded={activeMenu === 'solutions'}
                  aria-haspopup="true"
                  onClick={() => setActiveMenu(activeMenu === 'solutions' ? null : 'solutions')}
                  onKeyDown={(e) => handleKeyDown(e, 'solutions')}
                  className={`px-3 py-2 rounded-2xl flex items-center gap-1.5 hover:text-surface-950 hover:bg-surface-100 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    activeMenu === 'solutions' ? 'bg-surface-100 text-surface-950 font-bold' : ''
                  }`}
                >
                  <span>{t.navSolutions}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeMenu === 'solutions' ? 'rotate-180' : ''}`} />
                </button>

                {activeMenu === 'solutions' && (
                  <div
                    role="menu"
                    className="absolute left-0 mt-3 w-[580px] p-4 rounded-3xl bg-white border border-surface-200 shadow-2xl animate-fade-in grid grid-cols-2 gap-2 z-50"
                  >
                    <div className="col-span-2 px-3 py-1.5 border-b border-surface-100 mb-1 flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-wider text-surface-400">
                        {t.solutionsTitle}
                      </span>
                      <Link to="/features" className="text-[11px] font-bold text-brand-600 hover:underline">
                        {t.viewAllSolutions} &rarr;
                      </Link>
                    </div>

                    {solutionsList.map((sol) => (
                      <Link
                        key={sol.to}
                        to={sol.to}
                        role="menuitem"
                        onClick={() => setActiveMenu(null)}
                        className="p-3 rounded-2xl hover:bg-surface-50 border border-transparent hover:border-surface-200/80 transition-all flex items-start gap-3 group"
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${sol.color} group-hover:scale-110 transition-transform`}>
                          <sol.icon className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-surface-900 group-hover:text-brand-600 transition-colors">
                            {sol.name}
                          </p>
                          <p className="text-[11px] text-surface-500 line-clamp-1 mt-0.5">
                            {sol.desc}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Mega Menu */}
              <div ref={productRef} className="relative">
                <button
                  type="button"
                  aria-expanded={activeMenu === 'product'}
                  aria-haspopup="true"
                  onClick={() => setActiveMenu(activeMenu === 'product' ? null : 'product')}
                  onKeyDown={(e) => handleKeyDown(e, 'product')}
                  className={`px-3 py-2 rounded-2xl flex items-center gap-1.5 hover:text-surface-950 hover:bg-surface-100 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    activeMenu === 'product' ? 'bg-surface-100 text-surface-950 font-bold' : ''
                  }`}
                >
                  <span>{t.footerProduct}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeMenu === 'product' ? 'rotate-180' : ''}`} />
                </button>

                {activeMenu === 'product' && (
                  <div
                    role="menu"
                    className="absolute left-0 mt-3 w-[460px] p-4 rounded-3xl bg-white border border-surface-200 shadow-2xl animate-fade-in grid grid-cols-2 gap-2 z-50"
                  >
                    {productList.map((prod) => (
                      <Link
                        key={prod.to}
                        to={prod.to}
                        role="menuitem"
                        onClick={() => setActiveMenu(null)}
                        className="p-3 rounded-2xl hover:bg-surface-50 border border-transparent hover:border-surface-200/80 transition-all flex items-start gap-3 group"
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${prod.color} group-hover:scale-110 transition-transform`}>
                          <prod.icon className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-surface-900 group-hover:text-brand-600 transition-colors">
                            {prod.name}
                          </p>
                          <p className="text-[11px] text-surface-500 line-clamp-1 mt-0.5">
                            {prod.desc}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <NavLink
                to="/pricing"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-2xl hover:text-surface-950 hover:bg-surface-100 transition-all ${
                    isActive ? 'bg-surface-100 text-surface-950 font-bold' : ''
                  }`
                }
              >
                {t.navPricing}
              </NavLink>

              <NavLink
                to="/hardware"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-2xl hover:text-surface-950 hover:bg-surface-100 transition-all ${
                    isActive ? 'bg-surface-100 text-surface-950 font-bold' : ''
                  }`
                }
              >
                {t.navHardware}
              </NavLink>

              <NavLink
                to="/success-stories"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-2xl hover:text-surface-950 hover:bg-surface-100 transition-all ${
                    isActive ? 'bg-surface-100 text-surface-950 font-bold' : ''
                  }`
                }
              >
                {t.navSuccess}
              </NavLink>

              <NavLink
                to="/support"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-2xl hover:text-surface-950 hover:bg-surface-100 transition-all ${
                    isActive ? 'bg-surface-100 text-surface-950 font-bold' : ''
                  }`
                }
              >
                {t.navSupport}
              </NavLink>
            </nav>

            {/* Right Action Cluster: Language Switcher + Login + Book Demo */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Language Switcher */}
              <LanguageSwitcher variant="button" className="hidden sm:flex" />

              {/* Login Button */}
              <Link
                to="/login"
                className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl border border-surface-200 hover:border-surface-300 bg-white hover:bg-surface-50 text-surface-800 font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer active:scale-95"
              >
                {t.navLogin}
              </Link>

              {/* Book Demo CTA */}
              <button
                type="button"
                onClick={() => openLeadModal({ sourcePage: location.pathname })}
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 via-brand-500 to-emerald-600 hover:from-brand-700 hover:to-emerald-700 text-white font-extrabold text-xs sm:text-sm transition-all shadow-md shadow-brand-500/25 cursor-pointer active:scale-95 inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand-200" />
                <span>{t.navBookDemo}</span>
              </button>

              {/* Mobile Menu Hamburger */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
                className="lg:hidden p-2 rounded-2xl border border-surface-200 bg-white text-surface-700 hover:text-surface-900 focus:outline-none"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* ── Mobile Navigation Drawer ── */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-surface-200 p-5 space-y-4 max-h-[85vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-surface-100">
              <span className="text-xs font-bold text-surface-500 uppercase tracking-wider">Language / ቋንቋ</span>
              <LanguageSwitcher variant="pill" />
            </div>

            {/* Solutions Section */}
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-surface-400 mb-2">
                {t.navSolutions}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {solutionsList.map((sol) => (
                  <Link
                    key={sol.to}
                    to={sol.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2.5 rounded-xl bg-surface-50 hover:bg-surface-100 text-xs font-bold text-surface-800 flex items-center gap-2"
                  >
                    <sol.icon className="w-4 h-4 text-brand-600" />
                    <span className="line-clamp-1">{sol.name}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Product Section */}
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-surface-400 mb-2">
                {t.footerProduct}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {productList.map((prod) => (
                  <Link
                    key={prod.to}
                    to={prod.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2.5 rounded-xl bg-surface-50 hover:bg-surface-100 text-xs font-bold text-surface-800 flex items-center gap-2"
                  >
                    <prod.icon className="w-4 h-4 text-brand-600" />
                    <span className="line-clamp-1">{prod.name}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Direct Links */}
            <div className="pt-2 border-t border-surface-100 space-y-1 text-sm font-bold text-surface-800">
              <Link to="/pricing" onClick={() => setMobileMenuOpen(false)} className="block py-2 hover:text-brand-600">
                {t.navPricing}
              </Link>
              <Link to="/hardware" onClick={() => setMobileMenuOpen(false)} className="block py-2 hover:text-brand-600">
                {t.navHardware}
              </Link>
              <Link to="/payments" onClick={() => setMobileMenuOpen(false)} className="block py-2 hover:text-brand-600">
                {t.navPayments}
              </Link>
              <Link to="/success-stories" onClick={() => setMobileMenuOpen(false)} className="block py-2 hover:text-brand-600">
                {t.navSuccess}
              </Link>
              <Link to="/support" onClick={() => setMobileMenuOpen(false)} className="block py-2 hover:text-brand-600">
                {t.navSupport}
              </Link>
              <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="block py-2 hover:text-brand-600">
                {t.navAbout}
              </Link>
              <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="block py-2 hover:text-brand-600">
                {t.navContact}
              </Link>
            </div>

            <div className="pt-3 border-t border-surface-100">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openLeadModal({ sourcePage: location.pathname });
                }}
                className="w-full py-3 rounded-2xl bg-brand-600 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md text-center cursor-pointer"
              >
                <span>{t.navBookDemo}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── 3. Page Content Injection ── */}
      <main className="flex-1">
        {children}
      </main>

      {/* ── 4. Comprehensive Footer with 6 Link Groups ── */}
      <footer className="bg-surface-950 text-slate-300 border-t border-surface-800 pt-16 pb-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Top Brand Strip */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-12 border-b border-surface-800/80">
            <div className="flex items-center gap-3">
              <img
                src="/kushinaPOStrace.png"
                alt="kushinaPOS"
                className="w-12 h-12 object-contain drop-shadow-lg"
              />
              <div>
                <span className="font-display font-black text-2xl text-white tracking-tight">
                  kushina<span className="text-brand-400">POS</span>
                </span>
                <p className="text-xs text-slate-400 mt-0.5">{t.footerTagline}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
                📍 Bole Sub-City, Addis Ababa, Ethiopia
              </span>
              <a
                href="tel:+251911234567"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-brand-300 hover:text-brand-200 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-brand-400" /> +251 911 234 567
              </a>
              <LanguageSwitcher variant="button" />
            </div>
          </div>

          {/* 6 Link Groups Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 py-12 border-b border-surface-800/80 text-xs">
            
            {/* 1. Solutions */}
            <div className="space-y-3">
              <h4 className="font-display font-bold text-white uppercase tracking-wider text-[11px] text-slate-100">
                {t.footerSolutions}
              </h4>
              <ul className="space-y-2 text-slate-400">
                <li><Link to="/solutions/restaurants" className="hover:text-white transition-colors">{t.solRestaurants}</Link></li>
                <li><Link to="/solutions/cafes" className="hover:text-white transition-colors">{t.solCafes}</Link></li>
                <li><Link to="/solutions/bars" className="hover:text-white transition-colors">{t.solBars}</Link></li>
                <li><Link to="/solutions/bakeries" className="hover:text-white transition-colors">{t.solBakeries}</Link></li>
                <li><Link to="/solutions/fast-food" className="hover:text-white transition-colors">{t.solFastFood}</Link></li>
                <li><Link to="/solutions/hotels" className="hover:text-white transition-colors">{t.solHotels}</Link></li>
              </ul>
            </div>

            {/* 2. Product */}
            <div className="space-y-3">
              <h4 className="font-display font-bold text-white uppercase tracking-wider text-[11px] text-slate-100">
                {t.footerProduct}
              </h4>
              <ul className="space-y-2 text-slate-400">
                <li><Link to="/features" className="hover:text-white transition-colors">{t.prodFeatures}</Link></li>
                <li><Link to="/pricing" className="hover:text-white transition-colors">{t.navPricing}</Link></li>
                <li><Link to="/payments" className="hover:text-white transition-colors">{t.navPayments}</Link></li>
                <li><Link to="/integrations" className="hover:text-white transition-colors">{t.navIntegrations}</Link></li>
                <li><button type="button" onClick={() => openLeadModal({ interest: 'Footer Inquiry - Book a demo', sourcePage: 'footer' })} className="hover:text-white transition-colors cursor-pointer text-left">{t.navBookDemo}</button></li>
              </ul>
            </div>

            {/* 3. Hardware */}
            <div className="space-y-3">
              <h4 className="font-display font-bold text-white uppercase tracking-wider text-[11px] text-slate-100">
                {t.footerHardware}
              </h4>
              <ul className="space-y-2 text-slate-400">
                <li><Link to="/hardware" className="hover:text-white transition-colors">Counter Starter Bundle</Link></li>
                <li><Link to="/hardware" className="hover:text-white transition-colors">Kitchen Display Screen</Link></li>
                <li><Link to="/hardware" className="hover:text-white transition-colors">Dual-Screen Flagship</Link></li>
                <li><Link to="/hardware" className="hover:text-white transition-colors">80mm Thermal Printers</Link></li>
                <li><Link to="/hardware" className="hover:text-white transition-colors">Steel Cash Drawers</Link></li>
              </ul>
            </div>

            {/* 4. Company */}
            <div className="space-y-3">
              <h4 className="font-display font-bold text-white uppercase tracking-wider text-[11px] text-slate-100">
                {t.footerCompany}
              </h4>
              <ul className="space-y-2 text-slate-400">
                <li><Link to="/about" className="hover:text-white transition-colors">{t.navAbout}</Link></li>
                <li><Link to="/success-stories" className="hover:text-white transition-colors">{t.navSuccess}</Link></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">{t.navContact}</Link></li>
                <li><button type="button" onClick={() => openLeadModal({ interest: 'Footer Inquiry - On-Site Demo', sourcePage: 'footer' })} className="hover:text-white transition-colors cursor-pointer text-left">Request On-Site Demo</button></li>
              </ul>
            </div>

            {/* 5. Support */}
            <div className="space-y-3">
              <h4 className="font-display font-bold text-white uppercase tracking-wider text-[11px] text-slate-100">
                {t.footerSupport}
              </h4>
              <ul className="space-y-2 text-slate-400">
                <li><Link to="/support" className="hover:text-white transition-colors">{t.navSupport}</Link></li>
                <li><a href="https://t.me/kushinapos" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Telegram Support Bot</a></li>
                <li><a href="tel:+251911234567" className="hover:text-white transition-colors">Phone: +251 911 234 567</a></li>
                <li><Link to="/faq" className="hover:text-white transition-colors">{t.faq}</Link></li>
              </ul>
            </div>

            {/* 6. Legal */}
            <div className="space-y-3">
              <h4 className="font-display font-bold text-white uppercase tracking-wider text-[11px] text-slate-100">
                {t.footerLegal}
              </h4>
              <ul className="space-y-2 text-slate-400">
                <li><Link to="/terms" className="hover:text-white transition-colors">{t.terms}</Link></li>
                <li><Link to="/privacy" className="hover:text-white transition-colors">{t.privacy}</Link></li>
                <li><Link to="/faq" className="hover:text-white transition-colors">{t.faq}</Link></li>
                <li><a href="/sitemap.xml" target="_blank" className="hover:text-white transition-colors">Sitemap XML</a></li>
              </ul>
            </div>

          </div>

          {/* Bottom Copyright & Disclaimer */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} KushinaPOS Ethiopia. {t.footerRights}</p>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-400" />
                <span>Zero Foreign Currency Needed · 100% ETB Billing</span>
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* ── 5. Analytics Cookie Notice (Accept/Essential) ── */}
      {cookieConsent === 'pending' && (
        <aside
          aria-label="Cookie consent"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 p-5 rounded-3xl bg-surface-950/95 text-white border border-surface-800 shadow-2xl backdrop-blur-xl animate-slide-up"
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-500/30 text-brand-400 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-white">{t.cookieTitle}</h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{t.cookieDesc}</p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-800 text-xs">
            <button
              type="button"
              onClick={() => handleCookie('essential')}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-semibold transition-colors cursor-pointer"
            >
              {t.cookieEssential}
            </button>
            <button
              type="button"
              onClick={() => handleCookie('accepted')}
              className="px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all shadow-sm cursor-pointer"
            >
              {t.cookieAccept}
            </button>
          </div>
        </aside>
      )}

    </div>
  );
}

export default MarketingLayout;
