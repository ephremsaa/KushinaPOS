import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { restaurantApi, notificationApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  Store, Clock, Receipt, Printer, Monitor, Palette,
  Upload, Save, Plus, Trash2, Check, Loader2,
  ChevronRight, Percent, DollarSign, Bell,
  GripVertical, AlertCircle, Link2, AlertTriangle, Play,
  Sparkles, Wand2, Image as ImageIcon, Sun, Moon, Globe
} from 'lucide-react';
import { cn, generateId, applyTheme, isDarkColor, getContrastRatio } from '../../lib/utils';
import { Button, Input, Modal, Badge, Card, Toggle, LargeToggle } from '../../components/ui';
import { extractColorPalette, type ExtractedColorPalette } from '../../lib/colorExtractor';
import { globalToast } from '../../components/ui/Toast';
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
// Save Bar Component
// ─────────────────────────────────────────────────────────────

function SaveBar({
  loading, saved, error, onSave,
}: { loading: boolean; saved: boolean; error: string; onSave: () => void }) {
  return (
    <div className="flex items-center justify-between pt-6 border-t border-default/60 mt-6">
      {error ? (
        <p className="text-sm text-red-600 flex items-center gap-1.5 font-medium">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </p>
      ) : saved ? (
        <p className="text-sm text-emerald-600 flex items-center gap-1.5 font-medium">
          <Check className="w-4 h-4 flex-shrink-0" /> Changes saved successfully
        </p>
      ) : <span />}
      <Button
        variant="primary"
        loading={loading}
        icon={<Save className="w-4 h-4" />}
        onClick={onSave}
        id="settings-save"
      >
        Save Changes
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Slug Change Safety Modal
// ─────────────────────────────────────────────────────────────


function SlugChangeModal({
  currentSlug,
  isOpen,
  onClose,
  onConfirm,
}: {
  currentSlug: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newSlug: string) => Promise<void>;
}) {
  const [newSlug, setNewSlug] = useState(currentSlug);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const clean = newSlug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const handleSave = async () => {
    if (clean.length < 3) {
      return setError('Slug must be at least 3 characters');
    }
    if (clean === currentSlug) {
      return onClose();
    }
    setLoading(true);
    setError('');
    try {
      await onConfirm(clean);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update URL slug');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Change Restaurant URL Slug"
      description="Update your public menu link and staff login endpoint"
      icon={<Link2 className="w-5 h-5 text-brand-500" />}
      size="md"
      footer={
        <div className="flex gap-2 justify-end w-full">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={loading}
            disabled={!clean || clean === currentSlug}
            onClick={handleSave}
          >
            Confirm & Update URL
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex gap-3 text-amber-800 text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-amber-900">URL Change Notice</p>
            <p>Your old URL will continue to redirect for 30 days. However, you should update your QR codes and staff bookmarks as soon as possible.</p>
          </div>
        </div>

        <div>
          <label className="label">New URL Slug</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-surface-400 font-mono bg-surface-100 px-3 py-2.5 rounded-2xl border border-default">
              {window.location.origin}/r/
            </span>
            <input
              className="input font-mono text-sm"
              value={newSlug}
              onChange={e => { setNewSlug(e.target.value); setError(''); }}
              placeholder="my-restaurant"
            />
          </div>
          {clean && (
            <p className="text-[11px] text-muted font-mono mt-1.5">
              Preview: {window.location.origin}/r/<strong className="text-brand-600">{clean}</strong>
            </p>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-600 font-bold">{error}</p>
        )}
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();
  const r = user?.restaurant as Record<string, unknown> | undefined;

  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [pendingTab, setPendingTab] = useState<TabId | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [showSlugModal, setShowSlugModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [testingPrinterId, setTestingPrinterId] = useState<string | null>(null);
  const [printFeedback, setPrintFeedback] = useState<string>('');

  // ── Profile state ──────────────────────────────────────────
  const initialProfile = useMemo(() => ({
    name:                    (r?.name as string)                  ?? '',
    phone:                   (r?.phone as string)                 ?? '',
    address:                 (r?.address as string)               ?? '',
    city:                    (r?.city as string)                  ?? '',
    cuisine_type:            (r?.cuisine_type as string)          ?? '',
    currency:                (r?.currency as string)              ?? 'ETB',
    slug:                    (r?.slug as string)                  ?? '',
    online_ordering_enabled: Boolean(r?.online_ordering_enabled  ?? true),
  }), [r]);
  const [profile, setProfile] = useState(initialProfile);

  // ── Operating hours state ──────────────────────────────────
  const initialHours = useMemo(() => {
    const savedHours = r?.operating_hours as OperatingHours | undefined;
    const base: OperatingHours = {};
    DAYS.forEach(d => { base[d] = savedHours?.[d] ?? { ...DEFAULT_HOURS }; });
    return base;
  }, [r]);
  const [hours, setHours] = useState<OperatingHours>(initialHours);

  // ── Tax state ──────────────────────────────────────────────
  const initialTax = useMemo(() => ({
    tax_rate:      Number(r?.tax_rate ?? 0),
    tax_inclusive: Boolean(r?.tax_inclusive ?? false),
  }), [r]);
  const [tax, setTax] = useState(initialTax);

  const initialExtraTax = useMemo(() => (r?.extra_tax_rates as ExtraTaxRate[]) ?? [], [r]);
  const [extraTaxRates, setExtraTaxRates] = useState<ExtraTaxRate[]>(initialExtraTax);

  // ── Service charge state ───────────────────────────────────
  const initialService = useMemo(() => ({
    service_charge_enabled:      Boolean(r?.service_charge_enabled     ?? false),
    service_charge_percent:      Number(r?.service_charge_percent      ?? 10),
    service_charge_mandatory:    Boolean(r?.service_charge_mandatory   ?? false),
    service_charge_split_staff:  Boolean(r?.service_charge_split_staff ?? false),
  }), [r]);
  const [service, setService] = useState(initialService);

  // ── Receipt state ──────────────────────────────────────────
  const initialReceipt = useMemo(() => ({
    receipt_footer:             (r?.receipt_footer as string)  ?? '',
    receipt_header:             (r?.receipt_header as string)  ?? '',
    receipt_show_logo:          Boolean(r?.receipt_show_logo          ?? true),
    receipt_show_tax_breakdown: Boolean(r?.receipt_show_tax_breakdown ?? true),
    receipt_default_mode:       ((r?.receipt_default_mode as string) ?? 'print') as 'print' | 'email' | 'sms',
  }), [r]);
  const [receipt, setReceipt] = useState(initialReceipt);

  // ── Devices state ──────────────────────────────────────────
  const initialPrinters = useMemo(() => (r?.printers as PrinterType[]) ?? [], [r]);
  const [printers, setPrinters] = useState<PrinterType[]>(initialPrinters);

  const initialKds = useMemo(() => (r?.kds_stations_config as KDSStationConfig[]) ?? [], [r]);
  const [kdsStations, setKdsStations] = useState<KDSStationConfig[]>(initialKds);

  // ── Appearance state ───────────────────────────────────────
  const initialAppearance = useMemo(() => {
    const theme = r?.theme_color as string | undefined;
    const bg = r?.background_color as string | undefined;
    return {
      theme_color: (theme && theme !== '#f97316') ? theme : '#2F7D32',
      background_color: (bg && bg !== '#f1f5f9') ? bg : '#F7F7F2',
    };
  }, [r]);
  const [appearance, setAppearance] = useState(initialAppearance);

  // ── Auto-Brand Color Extractor State ───────────────────────
  const [extractedPalette, setExtractedPalette] = useState<ExtractedColorPalette | null>(null);
  const [isExtractingColor, setIsExtractingColor] = useState(false);

  // Sync state when restaurant data loads / updates
  useEffect(() => {
    if (r) {
      setProfile(initialProfile);
      setHours(initialHours);
      setTax(initialTax);
      setExtraTaxRates(initialExtraTax);
      setService(initialService);
      setReceipt(initialReceipt);
      setPrinters(initialPrinters);
      setKdsStations(initialKds);
      setAppearance(initialAppearance);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.id, r?.updated_at]);

  // Extract color palette from uploaded logo or saved logo URL
  useEffect(() => {
    const source = logoFile || (r?.logo_url as string | undefined);
    if (source) {
      setIsExtractingColor(true);
      extractColorPalette(source)
        .then(pal => setExtractedPalette(pal))
        .catch((err) => {
          console.error('Failed to extract color palette:', err);
          globalToast.error('Failed to extract color palette from logo');
        })
        .finally(() => setIsExtractingColor(false));
    }
  }, [logoFile, r?.logo_url]);

  const applyExtractedTheme = (themeColor: string, bgColor?: string) => {
    const nextBg = bgColor || appearance.background_color;
    setAppearance(p => ({
      ...p,
      theme_color: themeColor,
      background_color: nextBg,
    }));
    applyTheme(themeColor, nextBg);
  };

  // Live CSS preview for appearance
  useEffect(() => {
    applyTheme(appearance.theme_color, appearance.background_color);
  }, [appearance.theme_color, appearance.background_color]);


  // ── Dirty State Check per Tab ──────────────────────────────
  const isCurrentTabDirty = useMemo(() => {
    switch (activeTab) {
      case 'profile':
        return JSON.stringify(profile) !== JSON.stringify(initialProfile) || logoFile !== null;
      case 'hours':
        return JSON.stringify(hours) !== JSON.stringify(initialHours);
      case 'tax':
        return JSON.stringify(tax) !== JSON.stringify(initialTax) ||
               JSON.stringify(extraTaxRates) !== JSON.stringify(initialExtraTax);
      case 'service':
        return JSON.stringify(service) !== JSON.stringify(initialService);
      case 'receipt':
        return JSON.stringify(receipt) !== JSON.stringify(initialReceipt);
      case 'devices':
        return JSON.stringify(printers) !== JSON.stringify(initialPrinters) ||
               JSON.stringify(kdsStations) !== JSON.stringify(initialKds);
      case 'appearance':
        return JSON.stringify(appearance) !== JSON.stringify(initialAppearance);
      default:
        return false;
    }
  }, [
    activeTab, profile, initialProfile, logoFile, hours, initialHours,
    tax, initialTax, extraTaxRates, initialExtraTax,
    service, initialService, receipt, initialReceipt,
    printers, initialPrinters, kdsStations, initialKds,
    appearance, initialAppearance,
  ]);

  // Warn before browser window close if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isCurrentTabDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isCurrentTabDirty]);

  // Tab switcher with unsaved warning
  const handleTabClick = (tabId: TabId) => {
    if (tabId === activeTab) return;
    if (isCurrentTabDirty) {
      setPendingTab(tabId);
      setShowUnsavedModal(true);
    } else {
      setActiveTab(tabId);
      setError('');
      setSaved(false);
    }
  };

  const discardAndSwitch = () => {
    // Reset dirty tab to initial
    setProfile(initialProfile);
    setHours(initialHours);
    setTax(initialTax);
    setExtraTaxRates(initialExtraTax);
    setService(initialService);
    setReceipt(initialReceipt);
    setPrinters(initialPrinters);
    setKdsStations(initialKds);
    setAppearance(initialAppearance);
    setLogoFile(null);
    if (pendingTab) setActiveTab(pendingTab);
    setShowUnsavedModal(false);
    setPendingTab(null);
    setError('');
  };

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

  const handleUpdateSlug = async (newSlug: string) => {
    await restaurantApi.update({ slug: newSlug });
    setProfile(p => ({ ...p, slug: newSlug }));
    await refreshUser();
    qc.invalidateQueries();
  };

  const handleTestPrint = async (printer: PrinterType) => {
    setTestingPrinterId(printer.id);
    setPrintFeedback('');
    try {
      const res = await restaurantApi.testPrint({
        printer_name: printer.name,
        ip_or_usb: printer.ip_or_usb,
        type: printer.type,
      });
      setPrintFeedback(`✅ ${res.message}`);
      setTimeout(() => setPrintFeedback(''), 4000);
    } catch (err: any) {
      setPrintFeedback(`❌ Print failed: ${err.message}`);
    } finally {
      setTestingPrinterId(null);
    }
  };

  // ── Helpers ────────────────────────────────────────────────
  const setDay = (day: string, patch: Partial<DayHours>) =>
    setHours(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }));

  const copyWeekdaysToAll = () => {
    const mon = hours['monday'];
    const next: OperatingHours = {};
    DAYS.forEach(d => { next[d] = { ...mon }; });
    setHours(next);
  };

  const addExtraTax = () => setExtraTaxRates(p => [...p, { id: generateId(), name: '', rate: 0 }]);
  const removeExtraTax = (id: string) => setExtraTaxRates(p => p.filter(t => t.id !== id));
  const updateExtraTax = (id: string, patch: Partial<ExtraTaxRate>) =>
    setExtraTaxRates(p => p.map(t => t.id === id ? { ...t, ...patch } : t));

  const addPrinter = () => setPrinters(p => [
    ...p, { id: generateId(), name: 'New Printer', station: 'General', type: 'receipt', ip_or_usb: '', is_active: true },
  ]);
  const removePrinter = (id: string) => setPrinters(p => p.filter(x => x.id !== id));
  const updatePrinter = (id: string, patch: Partial<PrinterType>) =>
    setPrinters(p => p.map(x => x.id === id ? { ...x, ...patch } : x));

  const addKds = () => setKdsStations(p => [
    ...p, { id: generateId(), name: 'New Station', label: 'Station', menu_stations: [] },
  ]);
  const removeKds = (id: string) => setKdsStations(p => p.filter(x => x.id !== id));
  const updateKds = (id: string, patch: Partial<KDSStationConfig>) =>
    setKdsStations(p => p.map(x => x.id === id ? { ...x, ...patch } : x));

  // Contrast calculations for appearance
  const contrastRatio = useMemo(() => {
    const isDarkBg = isDarkColor(appearance.background_color);
    const textColor = isDarkBg ? '#ffffff' : '#0f172a';
    return getContrastRatio(appearance.background_color, textColor);
  }, [appearance.background_color]);

  const hasLowContrast = contrastRatio < 3.0;

  return (
    <div className="animate-fade-in pb-12 max-w-7xl mx-auto space-y-6">
      {/* Slug Change Safety Modal */}
      <SlugChangeModal
        isOpen={showSlugModal}
        currentSlug={profile.slug}
        onClose={() => setShowSlugModal(false)}
        onConfirm={handleUpdateSlug}
      />

      {/* Unsaved Changes Confirmation Modal */}
      <Modal
        open={showUnsavedModal}
        onClose={() => setShowUnsavedModal(false)}
        title="Unsaved Changes"
        description="You have unsaved changes in this settings section."
        icon={<AlertCircle className="w-5 h-5 text-amber-500" />}
        size="sm"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button variant="ghost" onClick={() => setShowUnsavedModal(false)}>Stay on Page</Button>
            <Button variant="danger" onClick={discardAndSwitch}>Discard & Switch</Button>
          </div>
        }
      >
        <p className="text-sm text-surface-600">
          Switching tabs now will discard all unsaved edits on the current tab. Are you sure you want to proceed?
        </p>
      </Modal>

      {/* Page Header */}
      <div className="page-header bg-surface/60 p-6 rounded-3xl backdrop-blur-sm border border-white/80 shadow-card">
        <div>
          <h1 className="page-title">Restaurant Settings</h1>
          <p className="page-subtitle">Configure your business details, taxes, service charges, hardware, and brand theme</p>
        </div>
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* ── Left tab sidebar ── */}
        <nav className="lg:w-60 flex-shrink-0">
          <div className="card p-2 space-y-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all cursor-pointer',
                  activeTab === tab.id
                    ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200/80 shadow-xs'
                    : 'text-surface-600 hover:bg-surface-50 hover:text-primary'
                )}
                id={`settings-tab-${tab.id}`}
              >
                <tab.icon className={cn('w-4 h-4 flex-shrink-0', activeTab === tab.id ? 'text-brand-500' : 'text-surface-400')} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-tight truncate">{tab.label}</p>
                  <p className={cn('text-[10px] leading-tight truncate mt-0.5', activeTab === tab.id ? 'text-brand-400' : 'text-surface-400')}>
                    {tab.desc}
                  </p>
                </div>
                {activeTab === tab.id && <ChevronRight className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </nav>

        {/* ── Right content panel ── */}
        <div className="flex-1 min-w-0">
          <div className="card p-6 sm:p-8">

            {/* ══════════════ PROFILE ══════════════ */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <SectionHeader icon={Store} title="Restaurant Profile" desc="Shown on customer receipts, staff logins, and the public menu." />

                {/* Logo & Smart Color Extraction */}
                <div className="space-y-4">
                  <div className="flex items-center gap-5">
                    <div className="w-20 h-20 rounded-3xl bg-surface-100 border border-default/80 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm relative group">
                      {logoFile ? (
                        <img src={URL.createObjectURL(logoFile)} alt="Preview" className="w-full h-full object-cover" />
                      ) : r?.logo_url ? (
                        <img src={r.logo_url as string} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl">🍽️</span>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none rounded-3xl">
                        <Upload className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="logo-upload" className="btn-secondary gap-2 cursor-pointer inline-flex items-center text-xs sm:text-sm">
                        <Upload className="w-4 h-4 text-brand-500" />
                        {logoFile ? logoFile.name : 'Upload Restaurant Logo'}
                      </label>
                      <input id="logo-upload" type="file" className="hidden" accept="image/*"
                        onChange={e => setLogoFile(e.target.files?.[0] ?? null)} />
                      <p className="text-xs text-surface-400">PNG, JPG, SVG or WEBP · Colors are automatically extracted</p>
                    </div>
                  </div>

                  {/* Extracted Brand Palette Bar */}
                  {isExtractingColor ? (
                    <div className="p-4 rounded-3xl bg-brand-50/50 border border-brand-200/60 flex items-center gap-3 animate-pulse">
                      <Loader2 className="w-4 h-4 text-brand-500 animate-spin flex-shrink-0" />
                      <p className="text-xs font-semibold text-brand-700">Sampling logo pixels & generating branded palette...</p>
                    </div>
                  ) : extractedPalette && extractedPalette.palette.length > 0 ? (
                    <div className="p-5 rounded-3xl bg-gradient-to-r from-brand-50/70 via-surface-50/90 to-amber-50/50 border border-brand-200/80 space-y-3.5 shadow-sm">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-brand-500 flex-shrink-0" />
                          <p className="text-xs font-extrabold uppercase tracking-wider text-surface-800">
                            Smart Extracted Brand Colors
                          </p>
                        </div>
                        <Badge variant="brand" className="text-[10px]">
                          Dominant: {extractedPalette.dominant}
                        </Badge>
                      </div>

                      {/* Palette Swatches */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {extractedPalette.palette.map((color, idx) => {
                          const isCurrent = appearance.theme_color.toLowerCase() === color.toLowerCase();
                          return (
                            <button
                              key={color + idx}
                              type="button"
                              onClick={() => applyExtractedTheme(color)}
                              className={cn(
                                'flex items-center gap-2 px-3 py-1.5 rounded-2xl border text-xs font-mono font-bold transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95',
                                isCurrent
                                  ? 'ring-2 ring-brand-500 border-white bg-surface shadow-brand-glow-sm'
                                  : 'bg-surface/90 border-default/80 hover:border-surface-300'
                              )}
                            >
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-black/10 flex-shrink-0"
                                style={{ backgroundColor: color }}
                              />
                              <span>{color}</span>
                              {idx === 0 && (
                                <span className="text-[9px] font-sans font-black uppercase text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-md">
                                  Primary
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* 1-Click Action Bar */}
                      <div className="flex items-center gap-3 pt-1 flex-wrap">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          icon={<Wand2 className="w-3.5 h-3.5" />}
                          onClick={() => applyExtractedTheme(extractedPalette.dominant, extractedPalette.recommendedBg)}
                        >
                          Auto-Brand Platform
                        </Button>
                        <span className="text-[11px] text-muted font-medium">
                          Applies dominant accent & sets optimal background contrast
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="label">Restaurant name *</label>
                    <Input
                      value={profile.name}
                      onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Email (Read-only)</label>
                    <Input value={r?.email as string ?? ''} readOnly className="bg-surface-50" />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <Input
                      value={profile.phone}
                      onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+251 9…"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Address</label>
                    <Input
                      value={profile.address}
                      onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
                      placeholder="Bole Road, near…"
                    />
                  </div>
                  <div>
                    <label className="label">City</label>
                    <Input
                      value={profile.city}
                      onChange={e => setProfile(p => ({ ...p, city: e.target.value }))}
                      placeholder="Addis Ababa"
                    />
                  </div>
                  <div>
                    <label className="label">Cuisine type</label>
                    <Input
                      value={profile.cuisine_type}
                      onChange={e => setProfile(p => ({ ...p, cuisine_type: e.target.value }))}
                      placeholder="Ethiopian / International"
                    />
                  </div>
                  <div>
                    <label className="label">Currency</label>
                    <select className="select" value={profile.currency}
                      onChange={e => setProfile(p => ({ ...p, currency: e.target.value }))}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Dedicated Protected URL Slug Management */}
                  <div className="sm:col-span-2 p-4 bg-surface-50 rounded-2xl border border-default/80 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-surface-700 uppercase tracking-wider">Restaurant URL Slug</p>
                      <p className="text-sm font-mono font-bold text-brand-600 mt-0.5">
                        {window.location.origin}/r/{profile.slug}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Link2 className="w-3.5 h-3.5 text-brand-500" />}
                      onClick={() => setShowSlugModal(true)}
                    >
                      Change URL
                    </Button>
                  </div>
                </div>

                {/* Online Ordering Large Toggle */}
                <LargeToggle
                  checked={profile.online_ordering_enabled}
                  onChange={v => setProfile(p => ({ ...p, online_ordering_enabled: v }))}
                  label="Enable Customer Online & QR Ordering"
                  description="Allows customers to view your digital menu and place live orders via table QR code or online link."
                  activeIcon={Globe}
                  badgeText="Live QR"
                  badgeVariant="brand"
                />

                <SaveBar loading={loading} saved={saved} error={error} onSave={saveProfile} />
              </div>
            )}

            {/* ══════════════ OPERATING HOURS ══════════════ */}
            {activeTab === 'hours' && (
              <div className="space-y-6">
                <SectionHeader icon={Clock} title="Operating Hours" desc="Controls ordering availability and schedule display." />

                <div className="flex justify-end">
                  <Button variant="secondary" size="sm" onClick={copyWeekdaysToAll}>
                    Copy Monday to all days
                  </Button>
                </div>

                <div className="space-y-3">
                  {DAYS.map(day => {
                    const dh = hours[day] ?? { ...DEFAULT_HOURS };
                    return (
                      <div key={day} className={cn(
                        'flex flex-wrap sm:flex-nowrap items-center gap-3 p-4 rounded-2xl border transition-all',
                        dh.closed ? 'bg-surface-50 border-default opacity-60' : 'bg-surface border-default/80'
                      )}>
                        <span className="w-24 text-sm font-semibold text-surface-700 flex-shrink-0">
                          {DAY_LABELS[day]}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDay(day, { closed: !dh.closed })}
                            className={cn('text-xs px-2.5 py-1 rounded-full font-semibold border transition-all cursor-pointer',
                              dh.closed
                                ? 'bg-surface-100 text-muted border-default'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            )}
                          >
                            {dh.closed ? 'Closed' : 'Open'}
                          </button>
                        </div>
                        {!dh.closed && (
                          <>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-muted w-8">From</label>
                              <input type="time" value={dh.open}
                                onChange={e => setDay(day, { open: e.target.value })}
                                className="input !py-1.5 !text-sm w-28" />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-muted w-4">To</label>
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
                <SectionHeader icon={Percent} title="Tax & Pricing" desc="Feeds directly into Checkout bill calculation and receipts." />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Base tax rate (%)</label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                      <input type="number" min={0} max={100} step={0.5}
                        className="input pl-10"
                        value={tax.tax_rate}
                        onChange={e => setTax(p => ({ ...p, tax_rate: Math.min(100, Math.max(0, Number(e.target.value))) }))} />
                    </div>
                  </div>
                  <div className="flex flex-col justify-end pb-1">
                    <LargeToggle
                      checked={tax.tax_inclusive}
                      onChange={v => setTax(p => ({ ...p, tax_inclusive: v }))}
                      label="Tax-inclusive pricing"
                      description="Prices displayed on menus already include the tax amount (extracted at checkout)"
                      badgeText={tax.tax_inclusive ? "Inclusive" : "Exclusive"}
                      badgeVariant={tax.tax_inclusive ? "success" : "neutral"}
                    />
                  </div>
                </div>

                {/* Additional tax rates */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-surface-800">Additional tax rates</p>
                      <p className="text-xs text-muted">e.g. Alcohol Levy 5%, Tourism Tax 2%</p>
                    </div>
                    <Button variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={addExtraTax}>
                      Add Rate
                    </Button>
                  </div>
                  {extraTaxRates.length === 0 && (
                    <p className="text-sm text-surface-400 text-center py-6 border border-dashed border-default rounded-2xl">
                      No additional tax rates configured
                    </p>
                  )}
                  <div className="space-y-2">
                    {extraTaxRates.map(tr => (
                      <div key={tr.id} className="flex items-center gap-3 p-3 bg-surface-50 rounded-2xl border border-default">
                        <input className="input flex-1 !py-2 !text-sm" placeholder="Tax name"
                          value={tr.name} onChange={e => updateExtraTax(tr.id, { name: e.target.value })} />
                        <div className="relative w-28 flex-shrink-0">
                          <input type="number" min={0} max={100} step={0.1}
                            className="input !py-2 !text-sm pr-8"
                            value={tr.rate} onChange={e => updateExtraTax(tr.id, { rate: Math.min(100, Math.max(0, Number(e.target.value))) })} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs">%</span>
                        </div>
                        <button onClick={() => removeExtraTax(tr.id)}
                          className="p-2 hover:bg-red-50 rounded-xl text-surface-400 hover:text-red-600 transition-colors cursor-pointer">
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
                <SectionHeader icon={DollarSign} title="Service Charge / Tip" desc="Applied at checkout and automatically suggested to guests." />

                <LargeToggle
                  checked={service.service_charge_enabled}
                  onChange={v => setService(p => ({ ...p, service_charge_enabled: v }))}
                  label="Enable Automatic Service Charge"
                  description="Automatically applies a service tip percentage line to customer bills during checkout."
                  badgeText={service.service_charge_enabled ? "Active" : "Disabled"}
                  badgeVariant={service.service_charge_enabled ? "brand" : "neutral"}
                />

                {service.service_charge_enabled && (
                  <div className="space-y-5 pl-4 border-l-2 border-brand-200 animate-fade-in">
                    <div>
                      <label className="label">Default service charge (%)</label>
                      <div className="flex items-center gap-3 max-w-xs">
                        <button
                          type="button"
                          onClick={() => setService(p => ({ ...p, service_charge_percent: Math.max(0, p.service_charge_percent - 1) }))}
                          className="btn-secondary btn-sm !p-2"
                        ><span className="text-lg leading-none">−</span></button>
                        <div className="relative flex-1">
                          <input type="number" min={0} max={100} step={0.5}
                            className="input text-center font-bold text-lg"
                            value={service.service_charge_percent}
                            onChange={e => setService(p => ({ ...p, service_charge_percent: Math.min(100, Math.max(0, Number(e.target.value))) }))} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">%</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setService(p => ({ ...p, service_charge_percent: Math.min(100, p.service_charge_percent + 1) }))}
                          className="btn-secondary btn-sm !p-2"
                        ><span className="text-lg leading-none">+</span></button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <LargeToggle
                        checked={service.service_charge_mandatory}
                        onChange={v => setService(p => ({ ...p, service_charge_mandatory: v }))}
                        label="Mandatory Service Charge"
                        description="Cannot be removed by cashier at checkout without supervisor override."
                        badgeText={service.service_charge_mandatory ? "Mandatory" : "Optional"}
                        badgeVariant={service.service_charge_mandatory ? "amber" : "neutral"}
                      />
                      <LargeToggle
                        checked={service.service_charge_split_staff}
                        onChange={v => setService(p => ({ ...p, service_charge_split_staff: v }))}
                        label="Split among serving staff"
                        description="Automatically pool and allocate collected service charges to waiter shift records."
                        badgeText={service.service_charge_split_staff ? "Staff Pool" : "House"}
                        badgeVariant={service.service_charge_split_staff ? "success" : "neutral"}
                      />
                    </div>
                  </div>
                )}

                <SaveBar loading={loading} saved={saved} error={error} onSave={saveService} />
              </div>
            )}

            {/* ══════════════ RECEIPT ══════════════ */}
            {activeTab === 'receipt' && (
              <div className="space-y-6">
                <SectionHeader icon={Receipt} title="Receipt Customization" desc="Controls what prints and how digital receipts look." />

                <div className="space-y-4">
                  <LargeToggle
                    checked={receipt.receipt_show_logo}
                    onChange={v => setReceipt(p => ({ ...p, receipt_show_logo: v }))}
                    label="Show Restaurant Logo on Receipt"
                    description="Prints your high-resolution restaurant logo at the top header of paper and digital receipts."
                    activeIcon={ImageIcon}
                    badgeText="Brand Header"
                    badgeVariant="brand"
                  />
                  <LargeToggle
                    checked={receipt.receipt_show_tax_breakdown}
                    onChange={v => setReceipt(p => ({ ...p, receipt_show_tax_breakdown: v }))}
                    label="Show Detailed Tax Breakdown"
                    description="Prints explicit itemized subtotal, 15% VAT / taxes, and total line items."
                    badgeText="Fiscal Tax"
                    badgeVariant="neutral"
                  />
                </div>


                <div>
                  <label className="label">Default receipt mode</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['print', 'email', 'sms'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setReceipt(p => ({ ...p, receipt_default_mode: mode }))}
                        className={cn(
                          'py-3 px-4 rounded-2xl border text-sm font-semibold capitalize transition-all cursor-pointer',
                          receipt.receipt_default_mode === mode
                            ? 'bg-brand-50 text-brand-700 border-brand-300 shadow-sm'
                            : 'bg-surface text-surface-600 border-default hover:border-surface-300'
                        )}
                      >
                        {mode === 'print' ? '🖨️' : mode === 'email' ? '📧' : '💬'} {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">Receipt header text</label>
                  <textarea className="textarea" rows={2}
                    value={receipt.receipt_header}
                    onChange={e => setReceipt(p => ({ ...p, receipt_header: e.target.value }))}
                    placeholder="Welcome to our restaurant!" />
                </div>

                <div>
                  <label className="label">Receipt footer text</label>
                  <textarea className="textarea" rows={2}
                    value={receipt.receipt_footer}
                    onChange={e => setReceipt(p => ({ ...p, receipt_footer: e.target.value }))}
                    placeholder="Thank you for dining with us!" />
                </div>

                <SaveBar loading={loading} saved={saved} error={error} onSave={saveReceipt} />
              </div>
            )}

            {/* ══════════════ DEVICES ══════════════ */}
            {activeTab === 'devices' && (
              <div className="space-y-8">
                <SectionHeader icon={Printer} title="Devices & Stations" desc="Configure ESC/POS thermal printers and KDS station routing." />

                {printFeedback && (
                  <div className={cn(
                    'p-4 rounded-2xl text-xs font-bold animate-fade-in border',
                    printFeedback.startsWith('✅') ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
                  )}>
                    {printFeedback}
                  </div>
                )}

                {/* Printers */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-semibold text-surface-800">Thermal Printers</p>
                      <p className="text-xs text-muted">Receipt printer, kitchen ticket printer, bar printer</p>
                    </div>
                    <Button variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={addPrinter}>
                      Add Printer
                    </Button>
                  </div>

                  {printers.length === 0 && (
                    <div className="text-center py-10 border border-dashed border-default rounded-2xl text-surface-400">
                      <Printer className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No printers configured</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {printers.map(p => (
                      <div key={p.id} className="p-4 bg-surface-50 rounded-2xl border border-default space-y-3">
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
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Play className="w-3 h-3 text-brand-500" />}
                            loading={testingPrinterId === p.id}
                            onClick={() => handleTestPrint(p)}
                          >
                            Test Print
                          </Button>
                          <button onClick={() => removePrinter(p.id)}
                            className="p-1.5 hover:bg-red-50 rounded-xl text-surface-400 hover:text-red-600 transition-colors cursor-pointer">
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
                      <p className="text-xs text-muted">Assign kitchen display tablets to prep areas.</p>
                    </div>
                    <Button variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={addKds}>
                      Add Station
                    </Button>
                  </div>

                  {kdsStations.length === 0 && (
                    <div className="text-center py-10 border border-dashed border-default rounded-2xl text-surface-400">
                      <Monitor className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No KDS stations configured</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {kdsStations.map(k => (
                      <div key={k.id} className="p-4 bg-surface-50 rounded-2xl border border-default space-y-3">
                        <div className="flex items-center gap-3">
                          <input className="input flex-1 !py-2 !text-sm font-semibold" placeholder="Station name (e.g. Grill)"
                            value={k.name} onChange={e => updateKds(k.id, { name: e.target.value })} />
                          <button onClick={() => removeKds(k.id)}
                            className="p-1.5 hover:bg-red-50 rounded-xl text-surface-400 hover:text-red-600 transition-colors cursor-pointer">
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
              <div className="space-y-7">
                <SectionHeader icon={Palette} title="Appearance & Brand Theming" desc="Custom brand colors, logo-matched palettes, and platform backgrounds apply live across all POS devices." />

                {hasLowContrast && (
                  <div className="p-4 rounded-3xl bg-amber-50 border border-amber-200 flex gap-3 text-amber-800 text-xs shadow-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold text-amber-900">Low Text Contrast Notice ({contrastRatio.toFixed(1)}:1)</p>
                      <p>The selected background color might make text harder to read on low-brightness POS tablets. Recommended WCAG contrast is at least 4.5:1.</p>
                    </div>
                  </div>
                )}

                {/* 1. Smart Extracted Logo Palette Swatches */}
                {extractedPalette && extractedPalette.palette.length > 0 && (
                  <div className="p-5 rounded-3xl bg-gradient-to-r from-brand-50/80 via-surface-50/90 to-amber-50/40 border border-brand-200/80 space-y-3.5 shadow-sm">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-brand-500" />
                        <p className="text-xs font-extrabold uppercase tracking-wider text-surface-800">
                          Extracted from Restaurant Logo
                        </p>
                      </div>
                      <span className="text-[11px] text-muted font-medium">Click any swatch to set as brand accent</span>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      {extractedPalette.palette.map((color, idx) => {
                        const isCurrent = appearance.theme_color.toLowerCase() === color.toLowerCase();
                        return (
                          <button
                            key={color + idx}
                            type="button"
                            onClick={() => applyExtractedTheme(color)}
                            className={cn(
                              'flex items-center gap-2 px-3 py-1.5 rounded-2xl border text-xs font-mono font-bold transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95',
                              isCurrent
                                ? 'ring-2 ring-brand-500 border-white bg-surface shadow-brand-glow-sm'
                                : 'bg-surface/90 border-default/80 hover:border-surface-300'
                            )}
                          >
                            <span
                              className="w-4 h-4 rounded-full border border-black/10 flex-shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span>{color}</span>
                            {idx === 0 && (
                              <span className="text-[9px] font-sans font-black uppercase text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-md">
                                Dominant
                              </span>
                            )}
                          </button>
                        );
                      })}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={<Wand2 className="w-3.5 h-3.5 text-brand-500" />}
                        onClick={() => applyExtractedTheme(extractedPalette.dominant, extractedPalette.recommendedBg)}
                        className="!py-1.5 !text-xs ml-auto"
                      >
                        Auto-Brand Full Theme
                      </Button>
                    </div>
                  </div>
                )}

                {/* 2. Curated Designer Presets */}
                <div className="space-y-2.5">
                  <div>
                    <label className="label !mb-0.5">Curated Designer Palettes</label>
                    <p className="text-xs text-surface-400">Pre-calibrated lighting and brand combinations tailored for dining & bars</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {[
                      { name: 'Kushina Emerald', brand: '#2F7D32', bg: '#F7F7F2', icon: '🌿' },
                      { name: 'Obsidian Night', brand: '#D4A72C', bg: '#172033', icon: '🌌' },
                      { name: 'Addis Gold', brand: '#D4A72C', bg: '#F7F7F2', icon: '✨' },
                      { name: 'Bole Sunset', brand: '#f43f5e', bg: '#fff7ed', icon: '🪸' },
                      { name: 'Royal Velvet', brand: '#8b5cf6', bg: '#172033', icon: '👑' },
                    ].map((preset) => {
                      const isSelected =
                        appearance.theme_color.toLowerCase() === preset.brand.toLowerCase() &&
                        appearance.background_color.toLowerCase() === preset.bg.toLowerCase();
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => applyExtractedTheme(preset.brand, preset.bg)}
                          className={cn(
                            'p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 relative overflow-hidden',
                            isSelected
                              ? 'ring-2 ring-brand-500 border-brand-300 shadow-brand-glow-sm bg-surface'
                              : 'bg-surface-50/70 border-default/80 hover:bg-surface hover:border-surface-300'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-base">{preset.icon}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs" style={{ backgroundColor: preset.brand }} />
                              <span className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs" style={{ backgroundColor: preset.bg }} />
                            </div>
                          </div>
                          <div>
                            <p className="font-display font-bold text-xs text-primary leading-tight">{preset.name}</p>
                            <p className="text-[10px] text-surface-400 font-mono mt-0.5">{preset.brand}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Custom Color Pickers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                  <ColorPicker
                    label="Brand / Primary Accent"
                    desc="Used on action buttons, active navigation, badges, and glowing highlights."
                    value={appearance.theme_color}
                    onChange={v => {
                      setAppearance(p => {
                        const next = { ...p, theme_color: v };
                        applyTheme(next.theme_color, next.background_color);
                        return next;
                      });
                    }}
                    presets={['#2F7D32','#D4A72C','#172033','#7BC67E','#10b981','#3b82f6','#8b5cf6','#f43f5e']}
                  />
                  <ColorPicker
                    label="Platform Background Color"
                    desc="Controls the full shell background, cards, and adaptive dark/light contrast."
                    value={appearance.background_color}
                    onChange={v => {
                      setAppearance(p => {
                        const next = { ...p, background_color: v };
                        applyTheme(next.theme_color, next.background_color);
                        return next;
                      });
                    }}
                    presets={['#f8fafc','#f1f5f9','#fdf4e7','#f0fdf4','#faf5ff','#fff7ed','#1e293b','#0f172a','#090d16','#000000']}
                  />
                </div>

                {/* 4. Interactive Neo-Glassmorphic Live Preview */}
                <div
                  className="p-6 rounded-3xl border space-y-4 shadow-card transition-all duration-300 backdrop-blur-2xl"
                  style={{
                    backgroundColor: appearance.background_color,
                    borderColor: 'var(--card-border, rgba(226,232,240,0.8))',
                  }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-xs font-bold uppercase tracking-wider opacity-75" style={{ color: 'var(--text-main, #0f172a)' }}>
                      Interactive Live UI Preview
                    </p>
                    <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border bg-surface/20 shadow-xs" style={{ color: 'var(--text-main, #0f172a)' }}>
                      {appearance.background_color} · Contrast: {contrastRatio.toFixed(1)}:1
                    </span>
                  </div>
                  {contrastRatio < 4.5 && (
                    <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>Warning: Your chosen background color has low contrast with text (ratio &lt; 4.5:1). This may make the app hard to read for staff and customers.</span>
                    </div>
                  )}
                  <div className="flex gap-3 flex-wrap items-center">
                    <button
                      type="button"
                      className="btn-primary btn-sm px-4 py-2"
                      style={{ backgroundColor: appearance.theme_color }}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Primary POS Button
                    </button>
                    <button type="button" className="btn-secondary btn-sm px-4 py-2">
                      Secondary Action
                    </button>
                    <span
                      className="badge px-3 py-1 text-xs font-bold"
                      style={{
                        backgroundColor: `${appearance.theme_color}25`,
                        color: appearance.theme_color,
                        borderColor: `${appearance.theme_color}50`,
                      }}
                    >
                      Active Status Pill
                    </span>
                  </div>
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
    notificationApi.getPreferences().then(setPrefs).catch((err) => {
      console.error('Failed to load notification preferences:', err);
      globalToast.error('Failed to load notification preferences');
    });
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

      <div className="rounded-3xl border border-default/80 bg-surface overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-default bg-surface-50 text-surface-600 uppercase tracking-wider text-[10px]">
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
                    <p className="font-bold text-primary text-sm">{info.title}</p>
                    <p className="text-xs text-muted mt-0.5">{info.desc}</p>
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
    <div className="flex items-center gap-4 pb-4 border-b border-default/60">
      <div className="w-10 h-10 bg-brand-50 rounded-2xl flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-brand-500" />
      </div>
      <div>
        <h2 className="font-display font-bold text-lg text-primary">{title}</h2>
        <p className="text-sm text-muted">{desc}</p>
      </div>
    </div>
  );
}

function ColorPicker({ label, desc, value, onChange, presets }: {
  label: string; desc: string; value: string;
  onChange: (v: string) => void; presets: string[];
}) {
  return (
    <div className="space-y-2.5">
      <div>
        <label className="label !mb-0.5">{label}</label>
        <p className="text-xs text-surface-400">{desc}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 rounded-2xl overflow-hidden border shadow-sm flex-shrink-0 cursor-pointer"
          style={{ borderColor: 'var(--card-border, rgba(226,232,240,0.8))' }}>
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="w-full h-full" style={{ backgroundColor: value }} />
        </div>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="input flex-1 uppercase font-mono font-bold tracking-wider !py-2.5"
          placeholder="#f97316"
        />
      </div>
      <div className="flex gap-2 flex-wrap items-center pt-1">
        {presets.map(c => {
          const isSelected = value.toLowerCase() === c.toLowerCase();
          return (
            <button
              type="button"
              key={c}
              onClick={() => onChange(c)}
              title={c}
              className={cn(
                'w-8 h-8 rounded-2xl border-2 transition-all duration-150 flex items-center justify-center cursor-pointer shadow-sm hover:scale-110',
                isSelected ? 'ring-2 ring-brand-500 scale-110 border-white' : 'border-default/80 hover:border-surface-400'
              )}
              style={{ backgroundColor: c }}
            >
              {isSelected && (
                <Check className={cn('w-4 h-4 drop-shadow', isDarkColor(c) ? 'text-white' : 'text-slate-900')} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
