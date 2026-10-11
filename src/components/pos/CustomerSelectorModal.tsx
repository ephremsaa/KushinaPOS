import React, { useState, useEffect } from 'react';
import {
  Users, Search, UserPlus, Coins, Award, Check, X,
  Phone, AlertCircle, Loader2, Sparkles
} from 'lucide-react';
import { customersApi } from '../../lib/api';
import { Button, Input, Modal } from '../ui';
import { formatCurrency, cn } from '../../lib/utils';
import { globalToast } from '../ui/Toast';
import type { Customer } from '../../types';

interface CustomerSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer?: (customer: Customer) => void;
  onSelect?: (customer: Customer) => void;
  selectedCustomerId?: string;
  pointValueEtb?: number;
}

export function CustomerSelectorModal({
  isOpen,
  onClose,
  onSelectCustomer,
  onSelect,
  selectedCustomerId,
  pointValueEtb = 0.10,
}: CustomerSelectorModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  // Quick Create State
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickConsent, setQuickConsent] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Search when query changes
  useEffect(() => {
    if (!isOpen) return;
    if (!query.trim()) {
      setResults([]);
      setShowQuickCreate(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await customersApi.searchByPhone(query.trim());
        setResults(Array.isArray(data) ? data : []);
        if (data.length === 0) {
          // If query looks like a phone number, prepopulate quick-create
          setQuickPhone(query.trim());
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  // Handle Quick Create
  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim()) {
      return setCreateError('Name is required');
    }
    if (!quickPhone.trim()) {
      return setCreateError('Phone number is required');
    }

    setCreating(true);
    setCreateError('');
    try {
      const res = await customersApi.create({
        name: quickName.trim(),
        phone: quickPhone.trim(),
        marketing_consent: quickConsent,
      });

      if (res.customer) {
        globalToast.success(`Customer "${res.customer.name}" created`);
        onSelectCustomer?.(res.customer);
        onSelect?.(res.customer);
        handleClose();
      }
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create customer');
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setQuery('');
    setResults([]);
    setShowQuickCreate(false);
    setQuickName('');
    setQuickPhone('');
    setQuickConsent(false);
    setCreateError('');
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="Attach Customer to Order"
      description="Search existing loyalty account by Ethiopian phone (+251...) or quick-create."
      size="md"
    >
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-default-400 absolute left-3.5 top-3" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search phone number (09... or +251...) or name..."
            className="pl-9 pr-9"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-2.5 text-default-400 hover:text-default-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Results */}
        {loading ? (
          <div className="flex items-center justify-center py-8 space-x-2 text-default-400 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
            <span>Searching customers...</span>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {results.map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  onSelectCustomer?.(c);
                  onSelect?.(c);
                  handleClose();
                }}
                className="p-3 rounded-2xl border border-default bg-card hover:bg-brand-50/20 hover:border-brand-500/50 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-500/10 text-brand-600 font-bold flex items-center justify-center text-xs border border-brand-500/20">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-default-900 text-xs">{c.name}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        {c.tier || 'Bronze'}
                      </span>
                    </div>
                    <p className="text-[11px] text-default-400 font-mono mt-0.5">{c.phone}</p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-400">
                    <Coins className="w-3.5 h-3.5" />
                    <span>{c.points} pts</span>
                  </div>
                  <span className="text-[10px] text-default-400">
                    ({formatCurrency(c.points * pointValueEtb)})
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : query && !showQuickCreate ? (
          <div className="text-center py-6 border border-dashed rounded-2xl border-default bg-default-50/50 p-4">
            <p className="text-xs text-default-600 font-medium">No customer found for "{query}"</p>
            <p className="text-[11px] text-default-400 mt-0.5">Quick-create this customer account in 5 seconds:</p>
            <Button
              size="sm"
              variant="outline"
              icon={<UserPlus className="w-3.5 h-3.5 text-brand-500" />}
              className="mt-3"
              onClick={() => {
                setShowQuickCreate(true);
                setQuickPhone(query.trim());
              }}
            >
              Quick Create Customer
            </Button>
          </div>
        ) : null}

        {/* Quick Create Drawer / Box */}
        {(showQuickCreate || (!query && !results.length)) && (
          <div className="pt-2 border-t border-default/60">
            {!showQuickCreate ? (
              <button
                onClick={() => setShowQuickCreate(true)}
                className="w-full py-2.5 px-3 rounded-xl border border-dashed border-default hover:border-brand-500 hover:bg-brand-50/10 text-xs font-bold text-default-700 flex items-center justify-center gap-2 transition-all"
              >
                <UserPlus className="w-4 h-4 text-brand-500" />
                Quick-Create New Customer
              </button>
            ) : (
              <form onSubmit={handleQuickCreate} className="space-y-3 bg-default-50 dark:bg-card p-4 rounded-2xl border border-default animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-default-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                    Quick Customer Registration
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowQuickCreate(false)}
                    className="text-default-400 hover:text-default-700 text-xs"
                  >
                    Cancel
                  </button>
                </div>

                {createError && (
                  <div className="p-2.5 rounded-xl bg-red-500/10 text-red-600 text-[11px] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-semibold text-default-700 block mb-1">Full Name *</label>
                  <Input
                    autoFocus
                    required
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    placeholder="e.g. Almaz Kebede"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-default-700 block mb-1">Phone Number (+251...) *</label>
                  <Input
                    required
                    value={quickPhone}
                    onChange={(e) => setQuickPhone(e.target.value)}
                    placeholder="0911223344"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="qc_consent"
                    checked={quickConsent}
                    onChange={(e) => setQuickConsent(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-default text-brand-600 focus:ring-brand-500"
                  />
                  <label htmlFor="qc_consent" className="text-[11px] text-default-600 cursor-pointer">
                    Customer consented to marketing messages & rewards
                  </label>
                </div>

                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  loading={creating}
                  className="w-full mt-2"
                >
                  Create & Select
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
