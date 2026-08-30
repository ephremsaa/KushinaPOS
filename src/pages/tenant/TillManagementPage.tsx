import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cashDrawerApi } from '../../lib/api';
import { formatCurrency, cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import {
  Banknote, AlertTriangle, ShieldAlert,
  ArrowRight, Lock, Unlock, Key, CheckCircle, Calculator
} from 'lucide-react';

export default function TillManagementPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [startingCash, setStartingCash] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { data: session, isLoading } = useQuery({
    queryKey: ['cash-drawer-current'],
    queryFn: async () => {
      const session = await cashDrawerApi.current();
      return session as any;
    },
  });

  const openMut = useMutation({
    mutationFn: (amount: number) => cashDrawerApi.open(amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-drawer-current'] });
      setStartingCash('');
      setError('');
    },
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to open till'),
  });

  const closeMut = useMutation({
    mutationFn: (data: { actual_cash: number; manager_pin?: string; notes?: string }) => cashDrawerApi.close(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-drawer-current'] });
      setActualCash('');
      setManagerPin('');
      setNotes('');
      setError('');
    },
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to close till'),
  });

  if (isLoading) return <div className="p-6 text-center text-surface-400">Loading till data...</div>;

  const handleOpen = () => {
    const amt = parseFloat(startingCash);
    if (isNaN(amt) || amt < 0) return setError('Enter a valid starting amount');
    openMut.mutate(amt);
  };

  const handleClose = () => {
    const amt = parseFloat(actualCash);
    if (isNaN(amt) || amt < 0) return setError('Enter a valid actual cash amount');
    
    // Check discrepancy client-side just to prompt for PIN before sending
    const discrepancy = amt - Number(session.expected_cash);
    if (Math.abs(discrepancy) > 5 && !managerPin) {
      return setError('Manager PIN required for discrepancy over $5');
    }

    closeMut.mutate({ actual_cash: amt, manager_pin: managerPin, notes });
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      <div className="page-header bg-white/40 p-5 rounded-[2rem] backdrop-blur-sm border border-white/60 shadow-sm">
        <h1 className="page-title flex items-center gap-2">
          <Banknote className="w-6 h-6 text-brand-500" />
          Cash Drawer
        </h1>
        <p className="page-subtitle">Manage your physical cash float.</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-2xl flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-bold">{error}</span>
        </div>
      )}

      {!session ? (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-surface-100 text-center space-y-6">
          <div className="w-20 h-20 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Lock className="w-10 h-10 text-surface-400" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-surface-900">Till is Closed</h2>
            <p className="text-sm text-surface-500 mt-2">Open the cash drawer to start accepting cash payments.</p>
          </div>
          
          <div className="max-w-xs mx-auto space-y-4">
            <div>
              <label className="label text-left">Starting Cash Float</label>
              <input 
                type="number" 
                className="input text-center text-2xl font-bold font-mono tracking-wider" 
                placeholder="0.00"
                value={startingCash}
                onChange={e => { setStartingCash(e.target.value); setError(''); }}
              />
            </div>
            <button 
              onClick={handleOpen}
              disabled={openMut.isPending}
              className="btn-primary w-full py-4 text-lg"
            >
              <Unlock className="w-5 h-5 mr-2" /> 
              {openMut.isPending ? 'Opening...' : 'Open Till'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-brand-100 space-y-8">
          <div className="flex items-center justify-between border-b border-surface-100 pb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                <h2 className="text-lg font-bold text-emerald-800 uppercase tracking-widest text-xs">Till Open</h2>
              </div>
              <p className="text-sm text-surface-500">Opened at {new Date(session.opened_at).toLocaleTimeString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-surface-400 mb-1">Starting Float</p>
              <p className="font-mono font-bold text-surface-900">{formatCurrency(session.starting_cash)}</p>
            </div>
          </div>

          <div className="bg-surface-50 p-6 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Calculator className="w-8 h-8 text-surface-400" />
              <div>
                <p className="text-sm font-semibold text-surface-600">Expected Cash in Drawer</p>
                <p className="text-xs text-surface-400 mt-1">Starting float + Cash sales - Cash refunds</p>
              </div>
            </div>
            <p className="text-3xl font-display font-bold text-surface-900 font-mono tracking-tight">
              {formatCurrency(session.expected_cash)}
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-surface-100">
            <h3 className="font-bold text-surface-900">Close Till</h3>
            <p className="text-sm text-surface-500 mb-4">Count the physical cash in your drawer and enter the total below.</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Actual Cash Counted</label>
                <input 
                  type="number" 
                  className="input text-2xl font-bold font-mono tracking-wider" 
                  placeholder="0.00"
                  value={actualCash}
                  onChange={e => { setActualCash(e.target.value); setError(''); }}
                />
              </div>
              {actualCash && Math.abs(Number(actualCash) - Number(session.expected_cash)) > 5 && (
                <div className="animate-fade-in">
                  <label className="label text-amber-700 flex items-center gap-1">
                    <Key className="w-3 h-3" /> Manager PIN
                  </label>
                  <input 
                    type="password" 
                    maxLength={4}
                    className="input border-amber-300 focus:ring-amber-200 bg-amber-50 text-xl font-bold tracking-widest text-center" 
                    placeholder="••••"
                    value={managerPin}
                    onChange={e => { setManagerPin(e.target.value); setError(''); }}
                  />
                </div>
              )}
            </div>

            {actualCash && (
              <div className={cn(
                "p-4 rounded-xl flex items-center justify-between animate-fade-in",
                Number(actualCash) === Number(session.expected_cash) 
                  ? "bg-emerald-50 text-emerald-800" 
                  : "bg-amber-50 text-amber-800 border border-amber-200"
              )}>
                <span className="font-bold text-sm">Discrepancy:</span>
                <span className="font-mono font-bold">
                  {Number(actualCash) - Number(session.expected_cash) > 0 ? '+' : ''}
                  {formatCurrency(Number(actualCash) - Number(session.expected_cash))}
                </span>
              </div>
            )}

            {actualCash && Math.abs(Number(actualCash) - Number(session.expected_cash)) > 0 && (
              <div>
                <label className="label">Discrepancy Note (Optional)</label>
                <input 
                  type="text" 
                  className="input text-sm" 
                  placeholder="e.g. Missing 50 cents"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            )}

            <div className="pt-4">
              <button 
                onClick={handleClose}
                disabled={closeMut.isPending}
                className="btn-primary w-full py-4 text-lg bg-surface-800 hover:bg-surface-900"
              >
                <Lock className="w-5 h-5 mr-2" /> 
                {closeMut.isPending ? 'Closing...' : 'Close Till & Submit Count'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
