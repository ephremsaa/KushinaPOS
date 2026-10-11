import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, UserPlus, Search, Download, Send, Coins, MessageSquare,
  Calendar, Shield, Trash2, Edit3, Filter, ArrowUpDown, CheckCircle2,
  AlertCircle, X, ExternalLink, Lock, Phone, Mail, FileText, Sparkles,
  History, ArrowUpRight, ArrowDownLeft, RefreshCw, Eye, EyeOff, Award
} from 'lucide-react';
import { customersApi, reportsApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Button, Input, Modal, Badge } from '../../components/ui';
import { formatCurrency, cn } from '../../lib/utils';
import { globalToast } from '../../components/ui/Toast';
import type { Customer, LoyaltyTransaction, CustomersLoyaltyReport } from '../../types';

export default function CustomersPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const isOwnerOrManager = user?.role === 'restaurant_owner' ||
    user?.role === 'platform_admin' ||
    ['owner', 'manager'].includes(user?.staffRole || '');

  // Main state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('all');
  const [sort, setSort] = useState('last_visit');
  const [segmentsCount, setSegmentsCount] = useState({
    all: 0,
    new: 0,
    regular: 0,
    inactive_30d: 0,
    consented: 0
  });

  // KPI Metrics state
  const [kpiReport, setKpiReport] = useState<CustomersLoyaltyReport | null>(null);
  const [loadingKpis, setLoadingKpis] = useState(true);

  // Add / Edit Modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    birthday: '',
    notes: '',
    marketing_consent: false
  });
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Profile Drawer state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState<{
    customer: Customer;
    orders: any[];
    loyaltyTransactions: LoyaltyTransaction[];
    loyaltySettings: any;
  } | null>(null);

  // Adjust Points Modal state
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  // Marketing Campaign Modal state
  const [isMarketingModalOpen, setIsMarketingModalOpen] = useState(false);
  const [marketingSegment, setMarketingSegment] = useState('consented');
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignMessage, setCampaignMessage] = useState('');
  const [campaignChannel, setCampaignChannel] = useState<'whatsapp' | 'telegram' | 'manual'>('whatsapp');
  const [campaignSaving, setCampaignSaving] = useState(false);
  const [marketingLimit, setMarketingLimit] = useState<{ sentToday: number; limit: number; remaining: number } | null>(null);
  const [campaignResults, setCampaignResults] = useState<{ campaign: any; dispatches: any[] } | null>(null);

  // Load KPI report
  const loadKpis = async () => {
    try {
      setLoadingKpis(true);
      const data = await reportsApi.customersLoyalty();
      setKpiReport(data);
    } catch (err) {
      console.error('Failed to load customer KPIs:', err);
    } finally {
      setLoadingKpis(false);
    }
  };

  // Load Customers list
  const loadCustomers = async () => {
    try {
      setLoading(true);
      const res = await customersApi.list({
        search: search.trim() || undefined,
        segment,
        sort,
        limit: 100
      });
      setCustomers(res.customers || []);
      setTotal(res.total || 0);
      if (res.segments) {
        setSegmentsCount(res.segments);
      }
    } catch (err: any) {
      console.error('Failed to fetch customers:', err);
      globalToast.error(err?.message || 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKpis();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, segment, sort]);

  // Load Customer Profile Drawer
  const openCustomerProfile = async (id: string) => {
    setSelectedCustomerId(id);
    setProfileLoading(true);
    try {
      const data = await customersApi.get(id);
      setProfileData(data);
    } catch (err: any) {
      console.error('Failed to load customer profile:', err);
      globalToast.error(err?.message || 'Failed to load profile');
    } finally {
      setProfileLoading(false);
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      birthday: '',
      notes: '',
      marketing_consent: false
    });
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setFormData({
      name: cust.name,
      phone: cust.phone,
      email: cust.email || '',
      birthday: cust.birthday ? cust.birthday.slice(0, 10) : '',
      notes: cust.notes || '',
      marketing_consent: Boolean(cust.marketing_consent)
    });
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Save Customer (Create / Update)
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSaving(true);
    setFormError('');

    try {
      if (!formData.name.trim()) throw new Error('Customer name is required');
      if (!formData.phone.trim()) throw new Error('Phone number is required');

      if (editingCustomer) {
        await customersApi.update(editingCustomer.id, formData);
        globalToast.success('Customer profile updated');
      } else {
        await customersApi.create(formData);
        globalToast.success('Customer added successfully');
      }

      setIsFormModalOpen(false);
      loadCustomers();
      loadKpis();
      if (selectedCustomerId && editingCustomer?.id === selectedCustomerId) {
        openCustomerProfile(selectedCustomerId);
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save customer');
    } finally {
      setFormSaving(false);
    }
  };

  // Handle Manual Points Adjustment
  const handleAdjustPoints = async () => {
    if (!profileData?.customer) return;
    const pts = parseInt(adjustPoints, 10);
    if (isNaN(pts) || pts === 0) {
      return setAdjustError('Enter a valid non-zero points adjustment');
    }
    if (!adjustReason.trim()) {
      return setAdjustError('Adjustment reason is mandatory for audit');
    }
    if (!managerPin || managerPin.length < 4) {
      return setAdjustError('Manager PIN is required');
    }

    setAdjustSaving(true);
    setAdjustError('');
    try {
      await customersApi.adjustPoints(profileData.customer.id, {
        points: pts,
        manager_pin: managerPin,
        reason: adjustReason.trim()
      });
      globalToast.success(`Successfully adjusted ${pts > 0 ? `+${pts}` : pts} points`);
      setIsAdjustModalOpen(false);
      setAdjustPoints('');
      setAdjustReason('');
      setManagerPin('');
      // Reload profile and lists
      openCustomerProfile(profileData.customer.id);
      loadCustomers();
      loadKpis();
    } catch (err: any) {
      setAdjustError(err?.message || 'Points adjustment failed');
    } finally {
      setAdjustSaving(false);
    }
  };

  // Anonymize Customer (Privacy / GDPR)
  const handleAnonymize = async (cust: Customer) => {
    if (!window.confirm(`Are you sure you want to anonymize customer "${cust.name}"? This removes their phone, name, email, and notes permanently to protect privacy, while maintaining your ledger and sales figures.`)) {
      return;
    }

    try {
      await customersApi.anonymize(cust.id);
      globalToast.success('Customer successfully anonymized');
      loadCustomers();
      loadKpis();
      if (selectedCustomerId === cust.id) {
        setSelectedCustomerId(null);
      }
    } catch (err: any) {
      globalToast.error(err?.message || 'Failed to anonymize customer');
    }
  };

  // Delete Customer
  const handleDelete = async (cust: Customer) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${cust.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await customersApi.delete(cust.id);
      globalToast.success('Customer deleted');
      loadCustomers();
      loadKpis();
      if (selectedCustomerId === cust.id) {
        setSelectedCustomerId(null);
      }
    } catch (err: any) {
      globalToast.error(err?.message || 'Failed to delete customer');
    }
  };

  // Export CSV
  const handleExportCsv = async () => {
    try {
      await customersApi.exportCsv();
      globalToast.success('Customer CSV export generated');
    } catch (err: any) {
      globalToast.error(err?.message || 'CSV Export failed');
    }
  };

  // Open Marketing Modal
  const openMarketingModal = async () => {
    setIsMarketingModalOpen(true);
    setCampaignResults(null);
    setCampaignTitle('');
    setCampaignMessage('Hello! We miss you at Kushina Restaurant. Show this message for 10% off your next visit!');
    try {
      const limits = await customersApi.getMarketingLimit();
      setMarketingLimit(limits);
    } catch (err) {
      console.error(err);
    }
  };

  // Dispatch Campaign
  const handleSendCampaign = async () => {
    if (!campaignTitle.trim()) {
      globalToast.error('Please enter a campaign title');
      return;
    }
    if (!campaignMessage.trim()) {
      globalToast.error('Please enter a campaign message');
      return;
    }

    setCampaignSaving(true);
    try {
      const res = await customersApi.createCampaign({
        title: campaignTitle.trim(),
        message: campaignMessage.trim(),
        channel: campaignChannel,
        segment: marketingSegment
      });
      setCampaignResults(res);
      globalToast.success(`Campaign prepared for ${res.dispatches.length} customers!`);
      loadKpis();
    } catch (err: any) {
      globalToast.error(err?.message || 'Campaign creation failed');
    } finally {
      setCampaignSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-default-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-brand-500" />
            {t('nav.customers', 'Customers & Loyalty')}
          </h1>
          <p className="text-sm text-default-500 mt-1">
            CRM database, ledger-backed loyalty rewards, and permission-based marketing.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {isOwnerOrManager && (
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={handleExportCsv}
            >
              Export CSV
            </Button>
          )}

          {isOwnerOrManager && (
            <Button
              variant="outline"
              size="sm"
              icon={<Send className="w-4 h-4 text-emerald-500" />}
              onClick={openMarketingModal}
            >
              New Campaign
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            icon={<UserPlus className="w-4 h-4" />}
            onClick={openCreateModal}
          >
            Add Customer
          </Button>
        </div>
      </div>

      {/* ── KPI Metric Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-default rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-default-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Repeat Patrons</span>
            <Sparkles className="w-4 h-4 text-brand-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-default-900">
              {kpiReport ? `${kpiReport.repeat_customer_rate}%` : '—'}
            </span>
            <span className="text-xs text-default-500">
              ({kpiReport?.repeat_customers || 0} repeat)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-default-400">
            {kpiReport?.total_ordering_customers || 0} customers with orders
          </div>
        </div>

        <div className="bg-card border border-default rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-default-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Spend</span>
            <Coins className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-default-900">
              {kpiReport ? formatCurrency(kpiReport.average_spend_per_customer) : '—'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-default-400">
            Per active customer
          </div>
        </div>

        <div className="bg-card border border-default rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-default-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Points Liability</span>
            <Award className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-default-900">
              {kpiReport ? formatCurrency(kpiReport.loyalty_liability_etb) : '—'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-default-400">
            {kpiReport?.loyalty_points_outstanding?.toLocaleString() || 0} points in circulation
          </div>
        </div>

        <div className="bg-card border border-default rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-default-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Marketing Reach</span>
            <MessageSquare className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {kpiReport?.consented_marketing_count || 0}
            </span>
            <span className="text-xs text-default-500">consented</span>
          </div>
          <div className="mt-1 text-[11px] text-default-400">
            Opt-in rate: {kpiReport && kpiReport.total_customers > 0
              ? `${Math.round((kpiReport.consented_marketing_count / kpiReport.total_customers) * 100)}%`
              : '0%'}
          </div>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="bg-card border border-default rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-default-400 absolute left-3.5 top-3" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone (+251...), or notes..."
              className="pl-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-default-400 hover:text-default-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-default-400 font-semibold uppercase whitespace-nowrap">Sort By:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="text-xs bg-default-50 dark:bg-card border border-default rounded-xl px-3 py-2 text-default-700 font-medium focus:ring-1 focus:ring-brand-500 outline-none"
            >
              <option value="last_visit">Last Visit (Recent first)</option>
              <option value="spend">Total Spend (High to Low)</option>
              <option value="orders">Order Count (Most orders)</option>
              <option value="points">Loyalty Balance (Highest points)</option>
              <option value="created_at">Joined Date (Newest first)</option>
              <option value="name">Customer Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Segment Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'All Customers', count: segmentsCount.all },
            { id: 'new', label: 'New (Last 30d)', count: segmentsCount.new },
            { id: 'regular', label: 'Regulars (2+ visits)', count: segmentsCount.regular },
            { id: 'inactive_30d', label: 'At Risk (No visit >30d)', count: segmentsCount.inactive_30d },
            { id: 'consented', label: 'Marketing Consented', count: segmentsCount.consented },
          ].map((seg) => (
            <button
              key={seg.id}
              onClick={() => setSegment(seg.id)}
              className={cn(
                'px-3 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap flex items-center gap-1.5',
                segment === seg.id
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-default-100 dark:bg-card text-default-600 hover:bg-default-200/60 border border-transparent hover:border-default'
              )}
            >
              <span>{seg.label}</span>
              <span className={cn(
                'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                segment === seg.id ? 'bg-white/20 text-white' : 'bg-default-200 text-default-700'
              )}>
                {seg.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Customers Data Table ── */}
      <div className="bg-card border border-default rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-3">
            <RefreshCw className="w-6 h-6 text-brand-500 animate-spin" />
            <p className="text-sm text-default-500">Loading customers...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 rounded-2xl bg-default-100 flex items-center justify-center mx-auto text-default-400 mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-default-900">No Customers Found</h3>
            <p className="text-xs text-default-500 max-w-sm mx-auto mt-1">
              {search
                ? `No customers matched "${search}". Try searching by phone or name.`
                : 'Customers will be recorded automatically when orders are placed or manually added.'}
            </p>
            <div className="mt-4">
              <Button size="sm" variant="primary" onClick={openCreateModal} icon={<UserPlus className="w-4 h-4" />}>
                Add First Customer
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-default-100/70 dark:bg-default-900/40 text-default-600 uppercase font-bold tracking-wider border-b border-default">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Phone Number</th>
                  <th className="py-3 px-4">Loyalty Tier</th>
                  <th className="py-3 px-4">Points Balance</th>
                  <th className="py-3 px-4">Orders / Spent</th>
                  <th className="py-3 px-4">Last Visit</th>
                  <th className="py-3 px-4">Consent</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default/50">
                {customers.map((c, idx) => (
                  <tr
                    key={c.id ? `cust-${c.id}-${idx}` : `cust-row-${idx}`}
                    onClick={() => openCustomerProfile(c.id)}
                    className="hover:bg-default-50/70 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-bold text-default-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-500/10 text-brand-600 font-bold flex items-center justify-center text-xs border border-brand-500/20">
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-default-900 leading-tight">{c.name}</p>
                          {c.email && (
                            <p className="text-[11px] text-default-400 font-normal leading-tight">{c.email}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-default-700 font-mono font-medium">
                      {c.phone}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[11px] bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        <Award className="w-3 h-3" />
                        {c.tier || 'Bronze'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-default-900">
                      <div className="flex items-center gap-1 text-brand-600 dark:text-brand-400">
                        <Coins className="w-3.5 h-3.5" />
                        <span>{c.points} pts</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-bold text-default-900 leading-tight">{formatCurrency(c.total_spent)}</p>
                      <p className="text-[11px] text-default-400 font-normal">{c.order_count} orders</p>
                    </td>

                    <td className="py-3.5 px-4 text-default-600 whitespace-nowrap">
                      {c.last_visit_at
                        ? new Date(c.last_visit_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'Never'}
                    </td>

                    <td className="py-3.5 px-4">
                      {c.marketing_consent ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[11px] font-medium text-default-400">
                          No
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(c)}
                          className="p-1.5 rounded-lg text-default-500 hover:text-default-900 hover:bg-default-100 transition-colors"
                          title="Edit Customer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {isOwnerOrManager && (
                          <button
                            onClick={() => handleAnonymize(c)}
                            className="p-1.5 rounded-lg text-amber-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                            title="Anonymize (Privacy / GDPR)"
                          >
                            <Shield className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isOwnerOrManager && (
                          <button
                            onClick={() => handleDelete(c)}
                            className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                            title="Delete Customer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          CUSTOMER PROFILE DRAWER
         ══════════════════════════════════════════════════════════════ */}
      {selectedCustomerId && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-fadeIn">
          <div className="w-full max-w-xl bg-card h-full shadow-2xl border-l border-default flex flex-col justify-between overflow-y-auto">
            {profileLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12">
                <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
                <p className="text-sm text-default-500 mt-2">Loading customer profile...</p>
              </div>
            ) : profileData ? (
              <div className="p-6 space-y-6">
                {/* Drawer Header */}
                <div className="flex items-start justify-between border-b border-default pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-600 font-black text-base flex items-center justify-center border border-brand-500/20">
                      {profileData.customer.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-default-900 leading-tight">
                        {profileData.customer.name}
                      </h2>
                      <p className="text-xs text-default-500 font-mono mt-0.5">
                        {profileData.customer.phone}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Edit3 className="w-3.5 h-3.5" />}
                      onClick={() => openEditModal(profileData.customer)}
                    >
                      Edit
                    </Button>
                    <button
                      onClick={() => setSelectedCustomerId(null)}
                      className="p-2 rounded-xl text-default-400 hover:text-default-700 hover:bg-default-100"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Loyalty Balance Badge Card */}
                <div className="rounded-2xl p-4 bg-gradient-to-r from-brand-500/10 via-amber-500/5 to-transparent border border-brand-500/20 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider block">
                      Loyalty Balance ({profileData.customer.tier} Tier)
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-black text-default-900">
                        {profileData.customer.points}
                      </span>
                      <span className="text-xs text-default-500 font-semibold">points</span>
                    </div>
                    <p className="text-xs text-default-500 mt-0.5">
                      Equivalent to {formatCurrency((profileData.customer.points * (Number(profileData.loyaltySettings?.loyalty_point_val_etb) || 0.10)))} ETB discount
                    </p>
                  </div>

                  {isOwnerOrManager && (
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<Coins className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setAdjustPoints('');
                        setAdjustReason('');
                        setManagerPin('');
                        setAdjustError('');
                        setIsAdjustModalOpen(true);
                      }}
                    >
                      Adjust Points
                    </Button>
                  )}
                </div>

                {/* Summary Metadata Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-default-50 dark:bg-card border border-default">
                    <span className="text-default-400 block font-medium">Total Spent</span>
                    <span className="text-base font-bold text-default-900 mt-0.5 block">
                      {formatCurrency(profileData.customer.total_spent)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-default-50 dark:bg-card border border-default">
                    <span className="text-default-400 block font-medium">Total Orders</span>
                    <span className="text-base font-bold text-default-900 mt-0.5 block">
                      {profileData.customer.order_count}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-default-50 dark:bg-card border border-default">
                    <span className="text-default-400 block font-medium">Last Visit</span>
                    <span className="font-semibold text-default-800 mt-0.5 block">
                      {profileData.customer.last_visit_at
                        ? new Date(profileData.customer.last_visit_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                        : 'Never'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-default-50 dark:bg-card border border-default">
                    <span className="text-default-400 block font-medium">Marketing Consent</span>
                    <span className="font-semibold mt-0.5 block">
                      {profileData.customer.marketing_consent ? (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Consented
                        </span>
                      ) : (
                        <span className="text-default-400">Not opted-in</span>
                      )}
                    </span>
                  </div>
                </div>

                {profileData.customer.notes && (
                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs">
                    <span className="font-bold text-amber-700 dark:text-amber-400 block mb-1">Customer Notes:</span>
                    <p className="text-default-700">{profileData.customer.notes}</p>
                  </div>
                )}

                {/* Order History */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-default-900 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-brand-500" />
                    Order History ({profileData.orders?.length || 0})
                  </h3>
                  {(!profileData.orders || profileData.orders.length === 0) ? (
                    <p className="text-xs text-default-400 py-3 text-center border border-dashed rounded-xl border-default">
                      No linked orders found.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {profileData.orders.map((o) => (
                        <div
                          key={o.id}
                          className="p-3 rounded-xl border border-default bg-card flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-default-900">
                              Order #{o.local_id || o.id.slice(0, 8)}
                            </span>
                            <span className="text-default-400 ml-2 font-mono">
                              {new Date(o.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <p className="text-[11px] text-default-500 capitalize">{o.order_type} • {o.status}</p>
                          </div>
                          <span className="font-bold text-default-900">
                            {formatCurrency(o.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Loyalty Ledger History */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-default-900 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-indigo-500" />
                    Loyalty Ledger Activity
                  </h3>
                  {(!profileData.loyaltyTransactions || profileData.loyaltyTransactions.length === 0) ? (
                    <p className="text-xs text-default-400 py-3 text-center border border-dashed rounded-xl border-default">
                      No loyalty points ledger entries yet.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {profileData.loyaltyTransactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="p-2.5 rounded-xl border border-default bg-card flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`font-bold uppercase text-[10px] px-1.5 py-0.2 rounded-md ${
                                tx.type === 'earn' ? 'bg-emerald-500/10 text-emerald-600' :
                                tx.type === 'redeem' ? 'bg-amber-500/10 text-amber-600' :
                                'bg-blue-500/10 text-blue-600'
                              }`}>
                                {tx.type}
                              </span>
                              <span className="text-default-400 text-[11px]">
                                {new Date(tx.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[11px] text-default-500 mt-0.5">{tx.note || 'Ledger event'}</p>
                          </div>
                          <div className="text-right">
                            <span className={`font-bold ${tx.points >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {tx.points > 0 ? `+${tx.points}` : tx.points} pts
                            </span>
                            <span className="text-[10px] text-default-400 block">
                              Balance: {tx.balance_after}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-default bg-default-50 dark:bg-card flex items-center justify-between">
              {profileData?.customer && isOwnerOrManager && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-amber-600 hover:text-amber-800"
                  icon={<Shield className="w-3.5 h-3.5" />}
                  onClick={() => handleAnonymize(profileData.customer)}
                >
                  Anonymize Profile
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedCustomerId(null)}
              >
                Close Drawer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ADD / EDIT CUSTOMER MODAL
         ══════════════════════════════════════════════════════════════ */}
      <Modal
        open={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
        description="Customer profile unique by Ethiopian phone number (+251...)"
        size="md"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button variant="ghost" onClick={() => setIsFormModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={formSaving}
              onClick={handleSaveCustomer}
            >
              {editingCustomer ? 'Save Changes' : 'Create Customer'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveCustomer} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="label">Full Name *</label>
            <Input
              required
              value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Abebe Bikila"
            />
          </div>

          <div>
            <label className="label">Phone Number * (+251... or 09...)</label>
            <Input
              required
              value={formData.phone}
              onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
              placeholder="0911223344 or +251911223344"
            />
            <p className="text-[11px] text-default-400 mt-1">
              Automatically normalized to standard Ethiopian +251 format.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Email Address (Optional)</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                placeholder="customer@gmail.com"
              />
            </div>
            <div>
              <label className="label">Birthday (Optional)</label>
              <Input
                type="date"
                value={formData.birthday}
                onChange={(e) => setFormData((f) => ({ ...f, birthday: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label">Preferences / Notes</label>
            <Input
              value={formData.notes}
              onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. Likes window seating, allergic to peanuts"
            />
          </div>

          {/* Marketing Consent Checkbox */}
          <div className="p-3.5 rounded-xl border border-default bg-default-50/60 dark:bg-card flex items-start gap-3">
            <input
              type="checkbox"
              id="marketing_consent_chk"
              checked={formData.marketing_consent}
              onChange={(e) => setFormData((f) => ({ ...f, marketing_consent: e.target.checked }))}
              className="mt-1 h-4 w-4 rounded border-default text-brand-600 focus:ring-brand-500 cursor-pointer"
            />
            <label htmlFor="marketing_consent_chk" className="text-xs text-default-700 cursor-pointer">
              <span className="font-bold text-default-900 block">Marketing & Promotion Consent</span>
              Customer explicitly opted-in to receive promotional updates and offers via WhatsApp / SMS. Every message includes mandatory opt-out instructions.
            </label>
          </div>
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          MANUAL POINTS ADJUSTMENT MODAL (MANAGER PIN PROTECTED)
         ══════════════════════════════════════════════════════════════ */}
      <Modal
        open={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title="Manual Points Adjustment"
        description="Authorized ledger adjustment with manager PIN and audit logging."
        size="md"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button variant="ghost" onClick={() => setIsAdjustModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={adjustSaving}
              onClick={handleAdjustPoints}
            >
              Confirm Adjustment
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {adjustError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{adjustError}</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-default-50 border border-default flex items-center justify-between text-xs">
            <span className="text-default-500 font-medium">Current Balance:</span>
            <span className="font-bold text-default-900">{profileData?.customer?.points || 0} points</span>
          </div>

          <div>
            <label className="label">Points Adjustment (positive to add, negative to deduct) *</label>
            <Input
              type="number"
              step="1"
              value={adjustPoints}
              onChange={(e) => setAdjustPoints(e.target.value)}
              placeholder="e.g. +50 or -20"
            />
            <p className="text-[11px] text-default-400 mt-1">
              Ledger guarantees balance can never drop below 0.
            </p>
          </div>

          <div>
            <label className="label">Reason / Justification *</label>
            <Input
              required
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="e.g. VIP goodwill bonus, service recovery"
            />
          </div>

          <div>
            <label className="label">Manager PIN *</label>
            <Input
              type="password"
              maxLength={6}
              value={managerPin}
              onChange={(e) => setManagerPin(e.target.value)}
              placeholder="Enter 4-6 digit manager PIN"
            />
            <p className="text-[11px] text-default-400 mt-1">
              Required for security attribution in audit logs.
            </p>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          MARKETING CAMPAIGN MODAL (ETHICAL & LEGAL)
         ══════════════════════════════════════════════════════════════ */}
      <Modal
        open={isMarketingModalOpen}
        onClose={() => setIsMarketingModalOpen(false)}
        title="Send Marketing Campaign"
        description="Reach consented customers with WhatsApp or Telegram broadcast lists."
        size="lg"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button variant="ghost" onClick={() => setIsMarketingModalOpen(false)}>
              Close
            </Button>
            {!campaignResults && (
              <Button
                variant="primary"
                loading={campaignSaving}
                onClick={handleSendCampaign}
                icon={<Send className="w-4 h-4" />}
              >
                Generate & Dispatch
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {marketingLimit && (
            <div className="p-3 rounded-xl bg-default-50 border border-default flex items-center justify-between text-xs">
              <span className="text-default-500 font-medium">Daily Restaurant Limit:</span>
              <span className="font-bold text-default-800">
                {marketingLimit.sentToday} / {marketingLimit.limit} sent today ({marketingLimit.remaining} remaining)
              </span>
            </div>
          )}

          {!campaignResults ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Target Segment</label>
                  <select
                    value={marketingSegment}
                    onChange={(e) => setMarketingSegment(e.target.value)}
                    className="w-full text-xs bg-default-50 dark:bg-card border border-default rounded-xl px-3 py-2 text-default-700 font-medium outline-none"
                  >
                    <option value="consented">All Consented Customers ({segmentsCount.consented})</option>
                    <option value="inactive_30d">Inactive in 30 Days (Winback)</option>
                    <option value="regular">Active Regulars (VIP Perks)</option>
                    <option value="new">New Customers (Welcome Offer)</option>
                  </select>
                </div>

                <div>
                  <label className="label">Messaging Channel</label>
                  <select
                    value={campaignChannel}
                    onChange={(e) => setCampaignChannel(e.target.value as any)}
                    className="w-full text-xs bg-default-50 dark:bg-card border border-default rounded-xl px-3 py-2 text-default-700 font-medium outline-none"
                  >
                    <option value="whatsapp">WhatsApp (Direct Chat Link)</option>
                    <option value="telegram">Telegram (Share Link)</option>
                    <option value="manual">Manual Copy & Paste</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Campaign Title</label>
                <Input
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  placeholder="e.g. Weekend Special 10% Discount"
                />
              </div>

              <div>
                <label className="label">Message Body</label>
                <textarea
                  rows={4}
                  value={campaignMessage}
                  onChange={(e) => setCampaignMessage(e.target.value)}
                  className="w-full text-xs bg-default-50 dark:bg-card border border-default rounded-xl p-3 text-default-900 outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Type promotional text here..."
                />
                <div className="mt-1 flex items-center justify-between text-[11px] text-default-400">
                  <span>Mandatory opt-out clause auto-appended: "(Reply STOP to opt out)"</span>
                  <span>{campaignMessage.length} characters</span>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span>
                  Campaign "<strong>{campaignResults.campaign.title}</strong>" recorded! {campaignResults.dispatches.length} recipient links prepared.
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {campaignResults.dispatches.map((d: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-default bg-card flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-default-900">{d.customer_name}</span>
                      <span className="text-default-400 font-mono ml-2">{d.to}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(d.message);
                          globalToast.success('Message copied to clipboard');
                        }}
                      >
                        Copy Text
                      </Button>
                      {d.whatsappUrl && (
                        <a
                          href={d.whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500 text-white font-semibold flex items-center gap-1 hover:bg-emerald-600"
                        >
                          <ExternalLink className="w-3 h-3" /> WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
