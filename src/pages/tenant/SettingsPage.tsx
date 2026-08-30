import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { restaurantApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { notificationApi } from '../../lib/api';
import {
  Store, Clock, Receipt, Printer, Monitor, Palette,
  Upload, Save, Plus, Trash2, Check, Loader2,
  ChevronRight, Percent, DollarSign, Bell, Mail, MessageSquare,
  GripVertical, AlertCircle,
} from 'lucide-react';
import { cn, generateId } from '../../lib/utils';
import type {
  OperatingHours, DayHours, ExtraTaxRate,
  Printer as PrinterType, KDSStationConfig,
} from '../../types';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

const DEFAULT_HOURS: DayHours = { open: '08:00', close: '22:00', closed: false };

const CURRENCIES = ['ETB', 'USD', 'EUR', 'GBP', 'KES', 'NGN', 'ZAR', 'GHS'];
const STATIONS = ['General', 'Kitchen', 'Bar', 'Grill', 'Dessert', 'Cold Kitchen', 'Hot Kitchen', 'Bakery'];

// ─────────────────────────────────────────────────────────────
// Tabs config
// ─────────────────────────────────────────────────────────────

type TabId = 'profile' | 'hours' | 'tax' | 'service' | 'receipt' | 'devices' | 'appearance' | 'notifications';

const TABS: { id: TabId; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'profile',       label: 'Profile',         icon: Store,     desc: 'Restaurant info' },
  { id: 'hours',         label: 'Operating Hours',  icon: Clock,     desc: 'Open/close times' },
  { id: 'tax',           label: 'Tax & Pricing',    icon: Percent,   desc: 'Tax rates & mode' },
  { id: 'service',       label: 'Service Charge',   icon: DollarSign,desc: 'Tip/gratuity config' },
  { id: 'receipt',       label: 'Receipt',          icon: Receipt,   desc: 'Print & digital' },
  { id: 'devices',       label: 'Devices',          icon: Printer,   desc: 'Printers & KDS' },
  { id: 'notifications', label: 'Notifications',    icon: Bell,      desc: 'Channel routing' },
  { id: 'appearance',    label: 'Appearance',       icon: Palette,   desc: 'Colors & branding' },
];

// ─────────────────────────────────────────────────────────────
// Section save button
// ─────────────────────────────────────────────────────────────

function SaveBar({
  loading, saved, error, onSave,
}: { loading: boolean; saved: boolean; error: string; onSave: () => void }) {
  return (
    <div className="flex items-center justify-between pt-6 border-t border-surface-200/60 mt-6">
      {error ? (
        <p className="text-sm text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      ) : saved ? (
        <p className="text-sm text-emerald-600 flex items-center gap-1.5">
          <Check className="w-4 h-4" /> Changes saved
        </p>
      ) : <span />}
      <button
        onClick={onSave}
        disabled={loading}
        className="btn-primary gap-2 min-w-[120px] justify-center"
        id="settings-save"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {loading ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Toggle component
// ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, desc }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer group py-1">
      <div>
        <p className="text-sm font-semibold text-surface-800 group-hover:text-surface-900">{label}</p>
        {desc && <p className="text-xs text-surface-500 mt-0.5">{desc}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2',
          checked ? 'bg-brand-500' : 'bg-surface-200'
        )}
        role="switch"
        aria-checked={checked}
      >
        <span className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0'
        )} />
      </button>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();
  const r = user?.restaurant as Record<string, unknown> | undefined;

  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // ── Profile state ──────────────────────────────────────────
  const [profile, setProfile] = useState({
    name:                    (r?.name as string)                  ?? '',
    phone:                   (r?.phone as string)                 ?? '',
    address:                 (r?.address as string)               ?? '',
    city:                    (r?.city as string)                  ?? '',
    cuisine_type:            (r?.cuisine_type as string)          ?? '',
    currency:                (r?.currency as string)              ?? 'ETB',
    slug:                    (r?.slug as string)                  ?? '',
    online_ordering_enabled: Boolean(r?.online_ordering_enabled  ?? true),
  });

  // ── Operating hours state ──────────────────────────────────
  const [hours, setHours] = useState<OperatingHours>(() => {
    const saved = r?.operating_hours as OperatingHours | undefined;
    const base: OperatingHours = {};
    DAYS.forEach(d => { base[d] = saved?.[d] ?? { ...DEFAULT_HOURS }; });
    return base;
  });

  // ── Tax state ──────────────────────────────────────────────
  const [tax, setTax] = useState({
    tax_rate:      Number(r?.tax_rate ?? 0),
    tax_inclusive: Boolean(r?.tax_inclusive ?? false),
  });
  const [extraTaxRates, setExtraTaxRates] = useState<ExtraTaxRate[]>(
    (r?.extra_tax_rates as ExtraTaxRate[]) ?? []
  );

  // ── Service charge state ───────────────────────────────────
  const [service, setService] = useState({
    service_charge_enabled:      Boolean(r?.service_charge_enabled     ?? false),
    service_charge_percent:      Number(r?.service_charge_percent      ?? 10),
    service_charge_mandatory:    Boolean(r?.service_charge_mandatory   ?? false),
    service_charge_split_staff:  Boolean(r?.service_charge_split_staff ?? false),
  });

  // ── Receipt state ──────────────────────────────────────────
  const [receipt, setReceipt] = useState({
    receipt_footer:             (r?.receipt_footer as string)  ?? '',
    receipt_header:             (r?.receipt_header as string)  ?? '',
    receipt_show_logo:          Boolean(r?.receipt_show_logo          ?? true),
    receipt_show_tax_breakdown: Boolean(r?.receipt_show_tax_breakdown ?? true),
    receipt_default_mode:       ((r?.receipt_default_mode as string) ?? 'print') as 'print' | 'email' | 'sms',
  });

  // ── Devices state ──────────────────────────────────────────
  const [printers, setPrinters] = useState<PrinterType[]>(
    (r?.printers as PrinterType[]) ?? []
  );
  const [kdsStations, setKdsStations] = useState<KDSStationConfig[]>(
    (r?.kds_stations_config as KDSStationConfig[]) ?? []
  );

  // ── Appearance state ───────────────────────────────────────
  const [appearance, setAppearance] = useState({
    theme_color:      (r?.theme_color as string)      ?? '#f97316',
    background_color: (r?.background_color as string) ?? '#f1f5f9',
  });

  // Live CSS preview for appearance
  useEffect(() => {
    document.documentElement.style.setProperty('--brand-500', appearance.theme_color);
    document.documentElement.style.setProperty('--background-color', appearance.background_color);
  }, [appearance.theme_color, appearance.background_color]);

  // ── Generic save helper ────────────────────────────────────
  const doSave = useCallback(async (payload: Record<string, unknown>) => {
    setLoading(true);
    setError('');
    setSaved(false);
    try {
      if (logoFile && activeTab === 'profile') {
        const { logo_url } = await restaurantApi.uploadLogo(logoFile);
        payload.logo_url = logo_url;
        setLogoFile(null);
      }
      await restaurantApi.update(payload);
      await refreshUser();
      qc.invalidateQueries();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  }, [logoFile, activeTab, refreshUser, qc]);

  const saveProfile    = () => doSave({ ...profile });
  const saveHours      = () => doSave({ operating_hours: hours });
  const saveTax        = () => doSave({ ...tax, extra_tax_rates: extraTaxRates });
  const saveService    = () => doSave({ ...service });
  const saveReceipt    = () => doSave({ ...receipt });
  const saveDevices    = () => doSave({ printers, kds_stations_config: kdsStations });
  const saveAppearance = () => doSave({ ...appearance });

  // ── Hours helpers ──────────────────────────────────────────
  const setDay = (day: string, patch: Partial<DayHours>) =>
    setHours(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }));

  const copyWeekdaysToAll = () => {
    const mon = hours['monday'];
    const next: OperatingHours = {};
    DAYS.forEach(d => { next[d] = { ...mon }; });
    setHours(next);
  };

  // ── Extra tax rate helpers ─────────────────────────────────
  const addExtraTax = () => setExtraTaxRates(p => [...p, { id: generateId(), name: '', rate: 0 }]);
  const removeExtraTax = (id: string) => setExtraTaxRates(p => p.filter(t => t.id !== id));
  const updateExtraTax = (id: string, patch: Partial<ExtraTaxRate>) =>
    setExtraTaxRates(p => p.map(t => t.id === id ? { ...t, ...patch } : t));

  // ── Printer helpers ────────────────────────────────────────
  const addPrinter = () => setPrinters(p => [
    ...p, { id: generateId(), name: 'New Printer', station: 'General', type: 'receipt', ip_or_usb: '', is_active: true },
  ]);
  const removePrinter = (id: string) => setPrinters(p => p.filter(x => x.id !== id));
  const updatePrinter = (id: string, patch: Partial<PrinterType>) =>
    setPrinters(p => p.map(x => x.id === id ? { ...x, ...patch } : x));

  // ── KDS helpers ────────────────────────────────────────────
  const addKds = () => setKdsStations(p => [
    ...p, { id: generateId(), name: 'New Station', label: 'Station', menu_stations: [] },
  ]);
  const removeKds = (id: string) => setKdsStations(p => p.filter(x => x.id !== id));
  const updateKds = (id: string, patch: Partial<KDSStationConfig>) =>
    setKdsStations(p => p.map(x => x.id === id ? { ...x, ...patch } : x));

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Restaurant configuration &amp; preferences</p>
        </div>
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* ── Left tab sidebar ── */}
        <nav className="lg:w-56 flex-shrink-0">
          <div className="card p-2 space-y-0.5">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSaved(false); setError(''); }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all',
                  activeTab === tab.id
                    ? 'bg-brand-50 text-brand-700 font-semibold border border-brand-100'
                    : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
                )}
                id={`settings-tab-${tab.id}`}
              >
                <tab.icon className={cn('w-4 h-4 flex-shrink-0', activeTab === tab.id ? 'text-brand-500' : 'text-surface-400')} />
                <div className="min-w-0">
                  <p className="text-sm leading-tight truncate">{tab.label}</p>
                  <p className={cn('text-[10px] leading-tight truncate', activeTab === tab.id ? 'text-brand-400' : 'text-surface-400')}>
                    {tab.desc}
                  </p>
                </div>
                {activeTab === tab.id && <ChevronRight className="w-3.5 h-3.5 ml-auto text-brand-400 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </nav>

        {/* ── Right content panel ── */}
        <div className="flex-1 min-w-0">
          <div className="card">

            {/* ══════════════ PROFILE ══════════════ */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <SectionHeader icon={Store} title="Restaurant Profile" desc="Shown on receipts and the public menu." />

                {/* Logo */}
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 rounded-2xl bg-surface-100 border border-surface-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {logoFile ? (
                      <img src={URL.createObjectURL(logoFile)} alt="Preview" className="w-full h-full object-cover" />
                    ) : r?.logo_url ? (
                      <img src={r.logo_url as string} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">🍽️</span>
                    )}
                  </div>
                  <div>
                    <label htmlFor="logo-upload" className="btn-secondary gap-2 cursor-pointer">
                      <Upload className="w-4 h-4" />
                      {logoFile ? logoFile.name : 'Upload logo'}
                    </label>
                    <input id="logo-upload" type="file" className="hidden" accept="image/*"
                      onChange={e => setLogoFile(e.target.files?.[0] ?? null)} />
                    <p className="text-xs text-surface-400 mt-1.5">PNG, JPG, SVG · Max 2 MB</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="label">Restaurant name *</label>
                    <input className="input" value={profile.name}
                      onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input className="input bg-surface-50" value={r?.email as string ?? ''} readOnly
                      title="Contact support to change email" />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input className="input" value={profile.phone}
                      onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+251 9…" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Address</label>
                    <input className="input" value={profile.address}
                      onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
                      placeholder="Bole Road, near…" />
                  </div>
                  <div>
                    <label className="label">City</label>
                    <input className="input" value={profile.city}
                      onChange={e => setProfile(p => ({ ...p, city: e.target.value }))}
                      placeholder="Addis Ababa" />
                  </div>
                  <div>
                    <label className="label">Cuisine type</label>
                    <input className="input" value={profile.cuisine_type}
                      onChange={e => setProfile(p => ({ ...p, cuisine_type: e.target.value }))}
                      placeholder="Ethiopian" />
                  </div>
                  <div>
                    <label className="label">Currency</label>
                    <select className="select" value={profile.currency}
                      onChange={e => setProfile(p => ({ ...p, currency: e.target.value }))}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Public Menu URL Slug</label>
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-surface-400 font-mono bg-surface-100 px-3 py-3 rounded-2xl border border-surface-200">
                        {window.location.origin}/r/
                      </span>
                      <input className="input font-mono text-xs" value={profile.slug}
                        onChange={e => setProfile(p => ({ ...p, slug: e.target.value }))}
                        placeholder="my-restaurant-name" />
                    </div>
                  </div>
                </div>

                {/* Online Ordering Toggle */}
                <div className="p-4 bg-brand-50/50 border border-brand-100 rounded-3xl flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-surface-900">Enable Customer Online & QR Ordering</p>
                    <p className="text-xs text-surface-500 mt-0.5">Allows customers to view your menu and place orders via table QR code or delivery link.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfile(p => ({ ...p, online_ordering_enabled: !p.online_ordering_enabled }))}
                    className={cn('w-12 h-6 rounded-full transition-colors relative flex-shrink-0', profile.online_ordering_enabled ? 'bg-brand-500' : 'bg-surface-300')}
                  >
                    <span className={cn('w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-xs', profile.online_ordering_enabled ? 'right-0.5' : 'left-0.5')} />
                  </button>
                </div>

                <SaveBar loading={loading} saved={saved} error={error} onSave={saveProfile} />
              </div>
            )}

            {/* ══════════════ OPERATING HOURS ══════════════ */}
            {activeTab === 'hours' && (
              <div className="space-y-6">
                <SectionHeader icon={Clock} title="Operating Hours" desc="Controls ordering availability and menu scheduling." />

                <div className="flex justify-end">
                  <button className="btn-secondary btn-sm gap-1.5" onClick={copyWeekdaysToAll}>
                    Copy Monday to all days
                  </button>
                </div>

                <div className="space-y-3">
                  {DAYS.map(day => {
                    const dh = hours[day] ?? { ...DEFAULT_HOURS };
                    return (
                      <div key={day} className={cn(
                        'flex flex-wrap sm:flex-nowrap items-center gap-3 p-4 rounded-2xl border transition-all',
                        dh.closed ? 'bg-surface-50 border-surface-200 opacity-60' : 'bg-white border-surface-200/80'
                      )}>
                        {/* Day name */}
                        <span className="w-24 text-sm font-semibold text-surface-700 flex-shrink-0">
                          {DAY_LABELS[day]}
                        </span>
                        {/* Open/Close toggle */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setDay(day, { closed: !dh.closed })}
                            className={cn('text-xs px-2.5 py-1 rounded-full font-semibold border transition-all',
                              dh.closed
                                ? 'bg-surface-100 text-surface-500 border-surface-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            )}
                          >
                            {dh.closed ? 'Closed' : 'Open'}
                          </button>
                        </div>
                        {/* Time inputs */}
                        {!dh.closed && (
                          <>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-surface-500 w-8">From</label>
                              <input type="time" value={dh.open}
                                onChange={e => setDay(day, { open: e.target.value })}
                                className="input !py-1.5 !text-sm w-28" />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-surface-500 w-4">To</label>
                              <input type="time" value={dh.close}
                                onChange={e => setDay(day, { close: e.target.value })}
                                className="input !py-1.5 !text-sm w-28" />
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                <SaveBar loading={loading} saved={saved} error={error} onSave={saveHours} />
              </div>
            )}

            {/* ══════════════ TAX & PRICING ══════════════ */}
            {activeTab === 'tax' && (
              <div className="space-y-6">
                <SectionHeader icon={Percent} title="Tax & Pricing" desc="Feeds directly into Checkout bill calculation." />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Base tax rate (%)</label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                      <input type="number" min={0} max={100} step={0.5}
                        className="input pl-10"
                        value={tax.tax_rate}
                        onChange={e => setTax(p => ({ ...p, tax_rate: Number(e.target.value) }))} />
                    </div>
                  </div>
                  <div className="flex flex-col justify-end pb-1">
                    <Toggle
                      checked={tax.tax_inclusive}
                      onChange={v => setTax(p => ({ ...p, tax_inclusive: v }))}
                      label="Tax-inclusive pricing"
                      desc="Tax is built into displayed prices (extract on checkout)"
                    />
                  </div>
                </div>

                {/* Tax-inclusive info */}
                <div className={cn(
                  'p-4 rounded-2xl border text-sm transition-all',
                  tax.tax_inclusive
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-surface-50 border-surface-200 text-surface-600'
                )}>
                  {tax.tax_inclusive
                    ? <>📌 <strong>Inclusive:</strong> Item price of ETB 100 at 15% → subtotal ETB 86.96 + tax ETB 13.04 = ETB 100 total.</>
                    : <>📌 <strong>Exclusive:</strong> Item price of ETB 100 at 15% → subtotal ETB 100 + tax ETB 15 = ETB 115 total.</>
                  }
                </div>

                {/* Additional tax rates */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-surface-800">Additional tax rates</p>
                      <p className="text-xs text-surface-500">e.g. Alcohol 5%, Service levy 2%</p>
                    </div>
                    <button className="btn-secondary btn-sm gap-1.5" onClick={addExtraTax}>
                      <Plus className="w-3.5 h-3.5" /> Add rate
                    </button>
                  </div>
                  {extraTaxRates.length === 0 && (
                    <p className="text-sm text-surface-400 text-center py-6 border border-dashed border-surface-200 rounded-2xl">
                      No additional tax rates configured
                    </p>
                  )}
                  <div className="space-y-2">
                    {extraTaxRates.map(tr => (
                      <div key={tr.id} className="flex items-center gap-3 p-3 bg-surface-50 rounded-2xl border border-surface-200">
                        <input className="input flex-1 !py-2 !text-sm" placeholder="Tax name"
                          value={tr.name} onChange={e => updateExtraTax(tr.id, { name: e.target.value })} />
                        <div className="relative w-28 flex-shrink-0">
                          <input type="number" min={0} max={100} step={0.1}
                            className="input !py-2 !text-sm pr-8"
                            value={tr.rate} onChange={e => updateExtraTax(tr.id, { rate: Number(e.target.value) })} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs">%</span>
                        </div>
                        <button onClick={() => removeExtraTax(tr.id)}
                          className="p-2 hover:bg-red-50 rounded-xl text-surface-400 hover:text-red-600 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <SaveBar loading={loading} saved={saved} error={error} onSave={saveTax} />
              </div>
            )}

            {/* ══════════════ SERVICE CHARGE ══════════════ */}
            {activeTab === 'service' && (
              <div className="space-y-6">
                <SectionHeader icon={DollarSign} title="Service Charge / Tip" desc="Applied at checkout. Auto-suggested to customers." />

                <Toggle
                  checked={service.service_charge_enabled}
                  onChange={v => setService(p => ({ ...p, service_charge_enabled: v }))}
                  label="Enable service charge"
                  desc="Adds a service charge line to every bill"
                />

                {service.service_charge_enabled && (
                  <div className="space-y-5 pl-4 border-l-2 border-brand-200 animate-fade-in">
                    <div>
                      <label className="label">Default service charge (%)</label>
                      <div className="flex items-center gap-3 max-w-xs">
                        <button
                          onClick={() => setService(p => ({ ...p, service_charge_percent: Math.max(0, p.service_charge_percent - 1) }))}
                          className="btn-secondary btn-sm !p-2"
                        ><span className="text-lg leading-none">−</span></button>
                        <div className="relative flex-1">
                          <input type="number" min={0} max={100} step={0.5}
                            className="input text-center font-bold text-lg"
                            value={service.service_charge_percent}
                            onChange={e => setService(p => ({ ...p, service_charge_percent: Number(e.target.value) }))} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">%</span>
                        </div>
                        <button
                          onClick={() => setService(p => ({ ...p, service_charge_percent: Math.min(100, p.service_charge_percent + 1) }))}
                          className="btn-secondary btn-sm !p-2"
                        ><span className="text-lg leading-none">+</span></button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Toggle
                        checked={service.service_charge_mandatory}
                        onChange={v => setService(p => ({ ...p, service_charge_mandatory: v }))}
                        label="Mandatory"
                        desc="Cannot be removed by cashier at checkout"
                      />
                      <Toggle
                        checked={service.service_charge_split_staff}
                        onChange={v => setService(p => ({ ...p, service_charge_split_staff: v }))}
                        label="Split among serving staff"
                        desc="Allocates collected charge to staff attendance records"
                      />
                    </div>

                    {/* Preview */}
                    <div className="p-4 bg-surface-50 rounded-2xl border border-surface-200 text-sm space-y-1.5">
                      <p className="font-semibold text-surface-700 text-xs uppercase tracking-wider mb-2">Bill preview</p>
                      <div className="flex justify-between text-surface-600"><span>Subtotal</span><span>ETB 1,000.00</span></div>
                      <div className="flex justify-between text-surface-600"><span>Service charge ({service.service_charge_percent}%)</span>
                        <span>ETB {(1000 * service.service_charge_percent / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-surface-900 border-t border-surface-200 pt-1.5 mt-1.5">
                        <span>Total</span>
                        <span>ETB {(1000 * (1 + service.service_charge_percent / 100)).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <SaveBar loading={loading} saved={saved} error={error} onSave={saveService} />
              </div>
            )}

            {/* ══════════════ RECEIPT ══════════════ */}
            {activeTab === 'receipt' && (
              <div className="space-y-6">
                <SectionHeader icon={Receipt} title="Receipt Customization" desc="Controls what prints and how it looks." />

                <div className="space-y-3">
                  <Toggle
                    checked={receipt.receipt_show_logo}
                    onChange={v => setReceipt(p => ({ ...p, receipt_show_logo: v }))}
                    label="Show restaurant logo on receipt"
                    desc="Prints your logo at the top of every receipt"
                  />
                  <Toggle
                    checked={receipt.receipt_show_tax_breakdown}
                    onChange={v => setReceipt(p => ({ ...p, receipt_show_tax_breakdown: v }))}
                    label="Show tax breakdown"
                    desc="Separates subtotal, tax amount, and total on receipt"
                  />
                </div>

                <div>
                  <label className="label">Default receipt mode</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['print', 'email', 'sms'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setReceipt(p => ({ ...p, receipt_default_mode: mode }))}
                        className={cn(
                          'py-3 px-4 rounded-2xl border text-sm font-semibold capitalize transition-all',
                          receipt.receipt_default_mode === mode
                            ? 'bg-brand-50 text-brand-700 border-brand-300 shadow-sm'
                            : 'bg-white text-surface-600 border-surface-200 hover:border-surface-300'
                        )}
                      >
                        {mode === 'print' ? '🖨️' : mode === 'email' ? '📧' : '💬'} {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">Receipt header</label>
                  <textarea className="textarea" rows={2}
                    value={receipt.receipt_header}
                    onChange={e => setReceipt(p => ({ ...p, receipt_header: e.target.value }))}
                    placeholder="Welcome to our restaurant!" />
                </div>

                <div>
                  <label className="label">Receipt footer</label>
                  <textarea className="textarea" rows={2}
                    value={receipt.receipt_footer}
                    onChange={e => setReceipt(p => ({ ...p, receipt_footer: e.target.value }))}
                    placeholder="Thank you for dining with us!" />
                </div>

                {/* Receipt preview */}
                <div className="border border-dashed border-surface-300 rounded-2xl p-4 bg-surface-50 font-mono text-xs text-surface-700 space-y-1">
                  <p className="text-center font-bold text-sm">Receipt Preview</p>
                  {receipt.receipt_show_logo && <p className="text-center text-lg">🍽️</p>}
                  <p className="text-center font-bold">{profile.name || 'Restaurant Name'}</p>
                  {receipt.receipt_header && <p className="text-center text-surface-500 italic">{receipt.receipt_header}</p>}
                  <p className="border-t border-dashed pt-1 mt-2">Item 1 ×2 ......... ETB 80.00</p>
                  <p>Item 2 ×1 ......... ETB 45.00</p>
                  {receipt.receipt_show_tax_breakdown && (
                    <>
                      <p className="border-t border-dashed pt-1 mt-1">Subtotal ........ ETB 125.00</p>
                      <p>Tax ({tax.tax_rate}%) ........ ETB {(125 * tax.tax_rate / 100).toFixed(2)}</p>
                    </>
                  )}
                  <p className="border-t border-dashed pt-1 mt-1 font-bold">TOTAL ........... ETB {(125 * (1 + tax.tax_rate / 100)).toFixed(2)}</p>
                  {receipt.receipt_footer && <p className="text-center text-surface-500 italic mt-2 border-t border-dashed pt-1">{receipt.receipt_footer}</p>}
                </div>

                <SaveBar loading={loading} saved={saved} error={error} onSave={saveReceipt} />
              </div>
            )}

            {/* ══════════════ DEVICES ══════════════ */}
            {activeTab === 'devices' && (
              <div className="space-y-8">
                <SectionHeader icon={Printer} title="Devices & Stations" desc="Configure ESC/POS printers and KDS tablet assignments." />

                {/* Printers */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-semibold text-surface-800">Printers</p>
                      <p className="text-xs text-surface-500">Receipt printer, kitchen ticket printer, etc.</p>
                    </div>
                    <button className="btn-secondary btn-sm gap-1.5" onClick={addPrinter}>
                      <Plus className="w-3.5 h-3.5" /> Add printer
                    </button>
                  </div>

                  {printers.length === 0 && (
                    <div className="text-center py-10 border border-dashed border-surface-200 rounded-2xl text-surface-400">
                      <Printer className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No printers configured</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {printers.map(p => (
                      <div key={p.id} className="p-4 bg-surface-50 rounded-2xl border border-surface-200 space-y-3">
                        <div className="flex items-center gap-3">
                          <GripVertical className="w-4 h-4 text-surface-300 flex-shrink-0" />
                          <input className="input flex-1 !py-2 !text-sm font-semibold" placeholder="Printer name"
                            value={p.name} onChange={e => updatePrinter(p.id, { name: e.target.value })} />
                          <label className="flex items-center gap-1.5 text-xs text-surface-600 cursor-pointer">
                            <input type="checkbox" checked={p.is_active}
                              onChange={e => updatePrinter(p.id, { is_active: e.target.checked })}
                              className="rounded" />
                            Active
                          </label>
                          <button onClick={() => removePrinter(p.id)}
                            className="p-1.5 hover:bg-red-50 rounded-xl text-surface-400 hover:text-red-600 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="label !text-xs">Type</label>
                            <select className="select !py-2 !text-sm" value={p.type}
                              onChange={e => updatePrinter(p.id, { type: e.target.value as 'receipt' | 'kitchen' })}>
                              <option value="receipt">Receipt</option>
                              <option value="kitchen">Kitchen ticket</option>
                            </select>
                          </div>
                          <div>
                            <label className="label !text-xs">Station</label>
                            <select className="select !py-2 !text-sm" value={p.station}
                              onChange={e => updatePrinter(p.id, { station: e.target.value })}>
                              {STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="label !text-xs">IP address / USB port</label>
                            <input className="input !py-2 !text-sm" placeholder="192.168.1.100 or USB001"
                              value={p.ip_or_usb} onChange={e => updatePrinter(p.id, { ip_or_usb: e.target.value })} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* KDS Stations */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-semibold text-surface-800">KDS Stations</p>
                      <p className="text-xs text-surface-500">Assign kitchen display tablets to prep areas.</p>
                    </div>
                    <button className="btn-secondary btn-sm gap-1.5" onClick={addKds}>
                      <Plus className="w-3.5 h-3.5" /> Add station
                    </button>
                  </div>

                  {kdsStations.length === 0 && (
                    <div className="text-center py-10 border border-dashed border-surface-200 rounded-2xl text-surface-400">
                      <Monitor className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No KDS stations configured</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {kdsStations.map(k => (
                      <div key={k.id} className="p-4 bg-surface-50 rounded-2xl border border-surface-200 space-y-3">
                        <div className="flex items-center gap-3">
                          <input className="input flex-1 !py-2 !text-sm font-semibold" placeholder="Station name (e.g. Grill)"
                            value={k.name} onChange={e => updateKds(k.id, { name: e.target.value })} />
                          <button onClick={() => removeKds(k.id)}
                            className="p-1.5 hover:bg-red-50 rounded-xl text-surface-400 hover:text-red-600 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div>
                          <label className="label !text-xs">Handles menu stations (comma-separated)</label>
                          <input className="input !py-2 !text-sm" placeholder="Grill, Hot Kitchen"
                            value={k.menu_stations.join(', ')}
                            onChange={e => updateKds(k.id, {
                              menu_stations: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                            })} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <SaveBar loading={loading} saved={saved} error={error} onSave={saveDevices} />
              </div>
            )}

            {/* ══════════════ APPEARANCE ══════════════ */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <SectionHeader icon={Palette} title="Appearance" desc="Theme colors apply immediately across the whole app." />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <ColorPicker
                    label="Brand / Primary color"
                    desc="Used on buttons, active nav items, badges."
                    value={appearance.theme_color}
                    onChange={v => setAppearance(p => ({ ...p, theme_color: v }))}
                    presets={['#f97316','#8b5cf6','#06b6d4','#10b981','#f43f5e','#3b82f6','#f59e0b','#84cc16']}
                  />
                  <ColorPicker
                    label="Background color"
                    desc="App shell background base color."
                    value={appearance.background_color}
                    onChange={v => setAppearance(p => ({ ...p, background_color: v }))}
                    presets={['#f1f5f9','#fdf4e7','#f0fdf4','#faf5ff','#fff7ed','#f8fafc','#1e293b','#0f172a']}
                  />
                </div>

                {/* Live preview strip */}
                <div className="p-5 rounded-2xl border border-surface-200 space-y-3"
                  style={{ backgroundColor: appearance.background_color }}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-surface-500">Live preview</p>
                  <div className="flex gap-2 flex-wrap">
                    <button className="btn-primary btn-sm" style={{ backgroundColor: appearance.theme_color }}>
                      Primary Button
                    </button>
                    <button className="btn-secondary btn-sm">Secondary</button>
                    <span className="badge" style={{ backgroundColor: `${appearance.theme_color}22`, color: appearance.theme_color, border: `1px solid ${appearance.theme_color}44` }}>
                      Badge
                    </span>
                  </div>
                  <div className="h-2 rounded-full" style={{ backgroundColor: appearance.theme_color }} />
                </div>

                <SaveBar loading={loading} saved={saved} error={error} onSave={saveAppearance} />
              </div>
            )}

            {/* ══════════════ NOTIFICATIONS ══════════════ */}
            {activeTab === 'notifications' && (
              <NotificationPreferencesTab />
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationPreferencesTab() {
  const [prefs, setPrefs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    notificationApi.getPreferences().then(setPrefs).catch(() => {});
  }, []);

  const toggle = (alertType: string, channel: 'in_app' | 'email' | 'sms') => {
    setPrefs((prev) => prev.map((p) => (p.alert_type === alertType ? { ...p, [channel]: !p[channel] } : p)));
  };

  const handleSave = async () => {
    setLoading(true);
    setSaved(false);
    setError('');
    try {
      await notificationApi.updatePreferences(prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError('Failed to update notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const labels: Record<string, { title: string; desc: string }> = {
    low_stock:        { title: 'Low Stock Threshold Warning', desc: 'Alert when ingredient or item inventory drops below minimum threshold' },
    payment_failed:   { title: 'Payment Failure & Grace Period', desc: 'Alert on rejected payment proofs or subscription billing failures' },
    new_reservation:  { title: 'New Table Reservation Booked', desc: 'Alert when a customer or staff books a table reservation' },
    order_stuck:      { title: 'Order Delay / Kitchen Stuck Alert', desc: 'Alert when an order remains in "preparing" past time threshold' },
    staff_anomaly:    { title: 'Staff Shift & Clock-In Anomaly', desc: 'Alert on late clock-ins or unauthorized shift changes' },
    new_online_order: { title: 'New Online / Delivery Order', desc: 'Real-time alert on takeaway or customer QR online orders' },
    billing:          { title: 'Billing & Plan Renewals', desc: 'Upcoming subscription renewals and plan status changes' },
  };

  return (
    <div className="space-y-6">
      <SectionHeader icon={Bell} title="Notification Channels & Alert Preferences" desc="Opt-in/opt-out of In-App Bell, Email, and SMS notifications per alert type." />

      <div className="rounded-3xl border border-surface-200/80 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-surface-600 uppercase tracking-wider text-[10px]">
              <th className="py-3.5 px-4">Alert Event Type</th>
              <th className="py-3.5 px-4 text-center">In-App Bell 🔔</th>
              <th className="py-3.5 px-4 text-center">Email 📧</th>
              <th className="py-3.5 px-4 text-center">Urgent SMS 📱</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {prefs.map((p) => {
              const info = labels[p.alert_type] || { title: p.alert_type, desc: 'Operational alert event' };
              return (
                <tr key={p.alert_type} className="hover:bg-surface-50/60 transition-colors">
                  <td className="py-4 px-4">
                    <p className="font-bold text-surface-900 text-sm">{info.title}</p>
                    <p className="text-xs text-surface-500 mt-0.5">{info.desc}</p>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <input 
                      type="checkbox" 
                      checked={!!p.in_app} 
                      onChange={() => toggle(p.alert_type, 'in_app')} 
                      className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                  </td>
                  <td className="py-4 px-4 text-center">
                    <input 
                      type="checkbox" 
                      checked={!!p.email} 
                      onChange={() => toggle(p.alert_type, 'email')} 
                      className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                  </td>
                  <td className="py-4 px-4 text-center">
                    <input 
                      type="checkbox" 
                      checked={!!p.sms} 
                      onChange={() => toggle(p.alert_type, 'sms')} 
                      className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SaveBar loading={loading} saved={saved} error={error} onSave={handleSave} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, desc }: {
  icon: React.ElementType; title: string; desc: string;
}) {
  return (
    <div className="flex items-center gap-4 pb-4 border-b border-surface-200/60">
      <div className="w-10 h-10 bg-brand-50 rounded-2xl flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-brand-500" />
      </div>
      <div>
        <h2 className="font-display font-bold text-lg text-surface-900">{title}</h2>
        <p className="text-sm text-surface-500">{desc}</p>
      </div>
    </div>
  );
}

function ColorPicker({ label, desc, value, onChange, presets }: {
  label: string; desc: string; value: string;
  onChange: (v: string) => void; presets: string[];
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <p className="text-xs text-surface-400 mb-2 -mt-1">{desc}</p>
      <div className="flex items-center gap-3 mb-3">
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="w-12 h-12 p-1 rounded-xl border border-surface-200 cursor-pointer" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="input flex-1 uppercase font-mono" placeholder="#f97316" />
      </div>
      <div className="flex gap-2 flex-wrap">
        {presets.map(c => (
          <button
            key={c}
            onClick={() => onChange(c)}
            title={c}
            className={cn(
              'w-7 h-7 rounded-xl border-2 transition-transform hover:scale-110',
              value === c ? 'border-surface-900 scale-110' : 'border-transparent'
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}
