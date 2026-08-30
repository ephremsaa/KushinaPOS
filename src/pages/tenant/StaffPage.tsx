import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, X, Users, Mail, Phone, Shield, UserCheck, UserX,
  Clock, LogIn, LogOut, ChevronRight, Edit2, Key, Check,
  AlertCircle, Calendar, Search, MoreVertical, Timer,
  RefreshCw, Fingerprint, Eye, EyeOff
} from 'lucide-react';
import { staffApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { cn, getInitials, getRoleLabel, getRoleBadgeClass, formatDateTime } from '../../lib/utils';
import type { Staff, StaffRole } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Shift {
  id: string; staff_id: string; staff_name?: string; role?: string;
  clocked_in_at: string; clocked_out_at: string | null; notes?: string;
}

const ROLES: StaffRole[] = ['manager', 'cashier', 'kitchen', 'waiter'];

const ROLE_COLORS: Record<string, string> = {
  owner:   'from-purple-500 to-purple-700',
  manager: 'from-blue-500 to-blue-700',
  cashier: 'from-emerald-500 to-emerald-700',
  kitchen: 'from-amber-500 to-amber-700',
  waiter:  'from-surface-400 to-surface-600',
};

const ROLE_PERMS: Record<string, string[]> = {
  owner:   ['Everything', 'Platform billing', 'All reports', 'Manage staff', 'Void orders', 'Discount override'],
  manager: ['All orders', 'All reports', 'Manage menu', 'Manage tables', 'Clock in/out staff', 'Void orders (PIN)', 'Discount override (PIN)'],
  cashier: ['POS / Checkout', 'View orders', 'Basic reports', 'Manage tables'],
  kitchen: ['Kitchen display', 'Update order status'],
  waiter:  ['POS (limited)', 'View own orders', 'Update order status'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hoursWorked(clockedIn: string, clockedOut: string | null): string {
  const end = clockedOut ? new Date(clockedOut) : new Date();
  const diff = (end.getTime() - new Date(clockedIn).getTime()) / 3600000;
  if (diff < 0) return '—';
  const h = Math.floor(diff);
  const m = Math.floor((diff - h) * 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function totalHours(shifts: Shift[]): number {
  return shifts.reduce((sum, s) => {
    if (!s.clocked_out_at) return sum;
    return sum + (new Date(s.clocked_out_at).getTime() - new Date(s.clocked_in_at).getTime()) / 3600000;
  }, 0);
}

// ─── Staff Form Panel ─────────────────────────────────────────────────────────

type PanelMode = 'view' | 'edit' | 'new';

function StaffPanel({
  staff,
  mode,
  onClose,
  onSaved,
  canOwner,
}: {
  staff?: Staff;
  mode: PanelMode;
  onClose: () => void;
  onSaved: () => void;
  canOwner: boolean;
}) {
  const qc = useQueryClient();
  const isNew = mode === 'new';
  const [form, setForm] = useState({
    name:     staff?.name ?? '',
    email:    staff?.email ?? '',
    phone:    (staff as any)?.phone ?? '',
    role:     staff?.role ?? 'cashier' as StaffRole,
    password: '',
    pin:      '',
    deactivation_note: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'info' | 'perms' | 'shifts'>('info');

  // Shifts for existing staff
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const { data: shifts = [] } = useQuery({
    queryKey: ['staff-shifts', staff?.id, dateFrom],
    queryFn: () => staffApi.shifts(staff!.id, { date_from: dateFrom, limit: '100' }) as Promise<Shift[]>,
    enabled: !!staff && tab === 'shifts',
  });

  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name || !form.email) { setError('Name and email are required'); return; }
    setSaving(true); setError('');
    try {
      const payload: Record<string, unknown> = {
        name: form.name, email: form.email, phone: form.phone || null, role: form.role,
      };
      if (form.password) payload.password = form.password;
      if (form.pin)      payload.pin      = form.pin;

      if (isNew) {
        if (!form.password) { setError('Initial password is required'); setSaving(false); return; }
        await staffApi.create(payload);
      } else {
        await staffApi.update(staff!.id, payload);
      }
      qc.invalidateQueries({ queryKey: ['staff'] });
      onSaved();
    } catch (e: any) {
      setError(e.message?.includes('already exists') ? 'Email already in use' : (e.message || 'Failed'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!staff) return;
    const next = !staff.is_active;
    setSaving(true);
    try {
      await staffApi.update(staff.id, {
        is_active: next,
        deactivation_note: !next ? (form.deactivation_note || 'Deactivated by manager') : null,
      });
      qc.invalidateQueries({ queryKey: ['staff'] });
      onSaved();
    } finally { setSaving(false); }
  };

  const totalH = totalHours(shifts);

  const TABS = [
    { key: 'info',   label: 'Info' },
    { key: 'perms',  label: 'Permissions' },
    ...(!isNew ? [{ key: 'shifts', label: 'Shifts' }] : []),
  ] as { key: string; label: string }[];

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col h-full overflow-hidden"
        style={{ borderRadius: '2rem 0 0 2rem' }}>

        {/* Header */}
        <div className="px-6 pt-6 pb-0 flex-shrink-0">
          <div className="flex items-start justify-between mb-5">
            {/* Avatar + name */}
            <div className="flex items-center gap-4">
              <div className={cn(
                'w-14 h-14 rounded-2xl bg-gradient-to-br text-white font-extrabold text-lg flex items-center justify-center flex-shrink-0',
                ROLE_COLORS[form.role] ?? ROLE_COLORS.waiter
              )}>
                {isNew ? <Users className="w-6 h-6" /> : getInitials(form.name || 'N')}
              </div>
              <div>
                <h3 className="font-display font-bold text-xl text-surface-900">
                  {isNew ? 'New Staff Member' : form.name}
                </h3>
                {!isNew && (
                  <span className={cn('inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full mt-1', getRoleBadgeClass(form.role))}>
                    <Shield className="w-3 h-3" /> {getRoleLabel(form.role)}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-full">
              <X className="w-5 h-5 text-surface-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-surface-100 rounded-2xl p-1 mb-1">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key as any)}
                className={cn('flex-1 py-2 rounded-xl text-sm font-bold transition-all',
                  tab === t.key ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700')}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {/* INFO TAB */}
          {tab === 'info' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Full name *</label>
                  <input className="input" value={form.name} onChange={e => upd('name', e.target.value)}
                    placeholder="Abebe Kebede" disabled={!canOwner && !isNew} />
                </div>
                <div>
                  <label className="label flex items-center gap-1.5"><Mail className="w-3 h-3" />Email *</label>
                  <input type="email" className="input" value={form.email}
                    onChange={e => upd('email', e.target.value)} placeholder="staff@resto.com"
                    disabled={!canOwner && !isNew} />
                </div>
                <div>
                  <label className="label flex items-center gap-1.5"><Phone className="w-3 h-3" />Phone</label>
                  <input className="input" value={form.phone} onChange={e => upd('phone', e.target.value)}
                    placeholder="+251 9xx xxx xxx" />
                </div>
              </div>

              {/* Role */}
              {canOwner && (
                <div>
                  <label className="label flex items-center gap-1.5"><Shield className="w-3 h-3" />Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map(r => (
                      <button
                        key={r}
                        onClick={() => upd('role', r)}
                        disabled={staff?.role === 'owner'}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left',
                          form.role === r
                            ? 'border-brand-400 bg-brand-50'
                            : 'border-surface-200 hover:border-brand-200 bg-white'
                        )}
                      >
                        <div className={cn('w-8 h-8 rounded-xl bg-gradient-to-br flex-shrink-0', ROLE_COLORS[r])}>
                          <Shield className="w-4 h-4 text-white m-2" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-surface-900">{getRoleLabel(r)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Password */}
              {canOwner && (
                <div>
                  <label className="label flex items-center gap-1.5">
                    <Key className="w-3 h-3" />{isNew ? 'Initial Password *' : 'New Password'}
                    {!isNew && <span className="text-surface-400 font-normal">(leave blank to keep)</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input pr-10"
                      value={form.password}
                      onChange={e => upd('password', e.target.value)}
                      placeholder={isNew ? 'Set a password' : '••••••••'}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Staff Login PIN */}
              {canOwner && (
                <div>
                  <label className="label flex items-center gap-1.5">
                    <Fingerprint className="w-3 h-3 text-brand-500" />Login PIN *
                    <span className="text-surface-400 font-normal">(4 digits — used for staff portal login)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPin ? 'text' : 'password'}
                      className="input pr-10 tracking-widest font-mono"
                      maxLength={4}
                      value={form.pin}
                      onChange={e => upd('pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder={isNew ? 'e.g. 1234' : (staff as any)?.has_pin ? '••••  (set)' : 'Not set'}
                    />
                    <button type="button" onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-surface-400 mt-1">
                    Staff use this PIN to log in via the Staff Portal.
                  </p>
                </div>
              )}

              {/* Deactivation note */}
              {!isNew && canOwner && staff && !staff.is_active && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
                  <p className="font-semibold">⛔ Deactivated</p>
                  {(staff as any).deactivation_note && <p className="mt-1 text-xs">{(staff as any).deactivation_note}</p>}
                  {(staff as any).deactivated_at && <p className="text-xs text-red-500 mt-0.5">On {formatDateTime((staff as any).deactivated_at)}</p>}
                </div>
              )}

              {!isNew && canOwner && staff && staff.is_active && (
                <div>
                  <label className="label">Deactivation note (if deactivating)</label>
                  <input className="input text-sm" value={form.deactivation_note}
                    onChange={e => upd('deactivation_note', e.target.value)}
                    placeholder="e.g. Resigned, contract ended" />
                </div>
              )}
            </>
          )}

          {/* PERMISSIONS TAB */}
          {tab === 'perms' && (
            <div className="space-y-4">
              <div className={cn('rounded-2xl p-4 bg-gradient-to-br text-white', ROLE_COLORS[form.role] ?? ROLE_COLORS.waiter)}>
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5" />
                  <span className="font-bold">{getRoleLabel(form.role)} Permissions</span>
                </div>
                <p className="text-sm opacity-80">This role has predefined access. You can change the role on the Info tab.</p>
              </div>
              <div className="space-y-2">
                {(ROLE_PERMS[form.role] ?? []).map(perm => (
                  <div key={perm} className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="text-sm font-semibold text-emerald-800">{perm}</span>
                  </div>
                ))}
              </div>
              {/* What they CAN'T do */}
              {form.role !== 'owner' && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-surface-400 uppercase tracking-widest">Restricted</p>
                  {Object.values(ROLE_PERMS.owner)
                    .filter(p => !(ROLE_PERMS[form.role] ?? []).includes(p))
                    .slice(0, 4)
                    .map(perm => (
                      <div key={perm} className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl border border-surface-100">
                        <X className="w-4 h-4 text-surface-300 flex-shrink-0" />
                        <span className="text-sm text-surface-400">{perm}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* SHIFTS TAB */}
          {tab === 'shifts' && !isNew && (
            <div className="space-y-4">
              {/* Date filter */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="label">From</label>
                  <input type="date" className="input text-sm" value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div className="pt-5">
                  <span className="text-surface-300">→</span>
                </div>
                <div className="flex-1">
                  <label className="label">To</label>
                  <input type="date" className="input text-sm"
                    defaultValue={new Date().toISOString().slice(0, 10)} readOnly />
                </div>
              </div>

              {/* Summary card */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-brand-50 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-extrabold text-brand-700">{shifts.length}</p>
                  <p className="text-xs font-semibold text-brand-500 mt-1">Total Shifts</p>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-extrabold text-emerald-700">{totalH.toFixed(1)}h</p>
                  <p className="text-xs font-semibold text-emerald-500 mt-1">Hours Worked</p>
                </div>
              </div>

              {/* Shift list */}
              {shifts.length === 0 ? (
                <div className="text-center py-10 text-surface-300">
                  <Timer className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="font-semibold text-surface-400">No shifts recorded</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {shifts.map(s => (
                    <div key={s.id} className="bg-surface-50 rounded-2xl p-3 border border-surface-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-surface-900">
                            {new Date(s.clocked_in_at).toLocaleDateString('en-ET', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-xs text-surface-400 mt-0.5">
                            {new Date(s.clocked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {' → '}
                            {s.clocked_out_at
                              ? new Date(s.clocked_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : <span className="text-emerald-500 font-semibold">Still clocked in</span>}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-extrabold text-brand-600">{hoursWorked(s.clocked_in_at, s.clocked_out_at)}</p>
                          {!s.clocked_out_at && <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">Active</span>}
                        </div>
                      </div>
                      {s.notes && <p className="text-xs text-surface-400 italic mt-1.5">"{s.notes}"</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-100 flex items-center gap-3 flex-shrink-0">
          {!isNew && canOwner && staff && staff.role !== 'owner' && (
            <button
              onClick={toggleActive}
              disabled={saving}
              className={cn(
                'flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl transition-colors mr-auto',
                staff.is_active
                  ? 'text-amber-600 hover:bg-amber-50 border border-amber-200'
                  : 'text-emerald-600 hover:bg-emerald-50 border border-emerald-200'
              )}
            >
              {staff.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
              {staff.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
          )}
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          {(isNew || canOwner) && (
            <button onClick={save} disabled={saving} className="btn-primary gap-2 min-w-[100px]">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Saving…' : isNew ? 'Add Staff' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Clock In/Out Confirm Modal ────────────────────────────────────────────────

function ClockModal({
  staff,
  action,
  onConfirm,
  onClose,
}: {
  staff: Staff;
  action: 'in' | 'out';
  onConfirm: (notes?: string) => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2rem] w-full max-w-xs shadow-2xl p-6 space-y-4">
        <div className="text-center">
          <div className={cn('w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3', action === 'in' ? 'bg-emerald-100' : 'bg-amber-100')}>
            {action === 'in' ? <LogIn className="w-8 h-8 text-emerald-600" /> : <LogOut className="w-8 h-8 text-amber-600" />}
          </div>
          <h3 className="font-bold text-surface-900">Clock {action === 'in' ? 'In' : 'Out'}</h3>
          <p className="text-sm text-surface-500 mt-1">{staff.name}</p>
          <p className="text-xs text-surface-400">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        {action === 'out' && (
          <div>
            <label className="label">Notes (optional)</label>
            <input className="input text-sm" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Left early" />
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => onConfirm(notes || undefined)}
            className={cn('flex-1 text-white font-bold py-2.5 rounded-2xl transition-colors', action === 'in' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600')}
          >
            Clock {action === 'in' ? 'In' : 'Out'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Staff Page ──────────────────────────────────────────────────────────

export default function StaffPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const staffRole: string = user?.staffRole ?? (user?.role === 'restaurant_owner' ? 'owner' : 'waiter');
  const canOwner   = ['owner'].includes(staffRole);
  const canManager = ['owner', 'manager'].includes(staffRole);

  const [search, setSearch]           = useState('');
  const [filterRole, setFilterRole]   = useState('all');
  const [filterActive, setFilterActive] = useState('active');
  const [panel, setPanel]             = useState<{ mode: PanelMode; staff?: Staff } | null>(null);
  const [clockModal, setClockModal]   = useState<{ staff: Staff; action: 'in' | 'out' } | null>(null);

  const { data: staffList = [], isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list() as Promise<Staff[]>,
    refetchInterval: 30_000,
  });

  const { data: activeNow = [] } = useQuery({
    queryKey: ['staff-active'],
    queryFn: () => staffApi.activeNow() as Promise<(Shift & { staff_name: string; role: string })[]>,
    refetchInterval: 60_000,
    enabled: canManager,
  });

  const clockInMut = useMutation({
    mutationFn: (id: string) => staffApi.clockIn(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-active'] }); setClockModal(null); },
  });
  const clockOutMut = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => staffApi.clockOut(id, notes),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-active'] }); setClockModal(null); },
  });

  const filtered = useMemo(() => {
    return staffList.filter(s => {
      const matchSearch = !search.trim() || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
      const matchRole   = filterRole === 'all' || s.role === filterRole;
      const matchActive = filterActive === 'all' || (filterActive === 'active' ? s.is_active : !s.is_active);
      return matchSearch && matchRole && matchActive;
    });
  }, [staffList, search, filterRole, filterActive]);

  const activeSet = new Set(activeNow.map(a => a.staff_id));
  const activeCount = staffList.filter(s => s.is_active).length;
  const clockedInCount = activeNow.length;

  return (
    <>
      {panel && (
        <StaffPanel
          staff={panel.staff}
          mode={panel.mode}
          canOwner={canOwner}
          onClose={() => setPanel(null)}
          onSaved={() => setPanel(null)}
        />
      )}
      {clockModal && (
        <ClockModal
          staff={clockModal.staff}
          action={clockModal.action}
          onClose={() => setClockModal(null)}
          onConfirm={notes => {
            if (clockModal.action === 'in') clockInMut.mutate(clockModal.staff.id);
            else clockOutMut.mutate({ id: clockModal.staff.id, notes });
          }}
        />
      )}

      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="page-header bg-white/40 p-5 rounded-[2rem] backdrop-blur-sm border border-white/60 shadow-sm flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <h1 className="page-title flex items-center gap-2"><Users className="w-6 h-6 text-brand-500" />Staff</h1>
            <p className="page-subtitle">
              {activeCount} active · {' '}
              <span className={cn(clockedInCount > 0 ? 'text-emerald-600 font-semibold' : 'text-surface-400')}>
                {clockedInCount} clocked in now
              </span>
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {Boolean(canOwner && user?.restaurant?.slug) && (
              <button 
                onClick={() => window.open(`/r/${user?.restaurant?.slug}/staff/login`, '_blank')} 
                className="btn-secondary gap-2"
                title={`/r/${user?.restaurant?.slug}/staff/login`}
              >
                <LogIn className="w-4 h-4" /> Open Staff Portal
              </button>
            )}
            {canOwner && (
              <button onClick={() => setPanel({ mode: 'new' })} className="btn-primary gap-2">
                <Plus className="w-4 h-4" /> Add Staff
              </button>
            )}
          </div>
        </div>

        {/* Currently clocked in banner */}
        {canManager && activeNow.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-sm font-bold text-emerald-800">Currently On Shift</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeNow.map(a => (
                <div key={a.id} className="flex items-center gap-2 bg-white border border-emerald-200 rounded-full px-3 py-1.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                    {getInitials(a.staff_name)}
                  </div>
                  <span className="text-xs font-semibold text-surface-700">{a.staff_name}</span>
                  <span className="text-[10px] text-emerald-600">{hoursWorked(a.clocked_in_at, null)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input className="input pl-10 w-full" placeholder="Search staff…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {/* Role filter */}
          <select className="select text-sm w-auto" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            <option value="all">All roles</option>
            {['manager', 'cashier', 'kitchen', 'waiter'].map(r => (
              <option key={r} value={r}>{getRoleLabel(r)}</option>
            ))}
          </select>
          {/* Active filter */}
          <div className="flex bg-surface-100 rounded-2xl p-1 gap-1">
            {[['active', 'Active'], ['inactive', 'Inactive'], ['all', 'All']].map(([v, l]) => (
              <button key={v} onClick={() => setFilterActive(v)}
                className={cn('px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                  filterActive === v ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500')}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Staff grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 bg-surface-100 rounded-3xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white/60 rounded-3xl border border-surface-100">
            <Users className="w-14 h-14 text-surface-200 mx-auto mb-4" />
            <p className="text-surface-500 font-semibold">No staff members found</p>
            {canOwner && <button className="btn-primary mt-4" onClick={() => setPanel({ mode: 'new' })}>Add First Staff Member</button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(s => {
              const isClockedIn = activeSet.has(s.id);
              const shift = activeNow.find(a => a.staff_id === s.id);
              return (
                <div
                  key={s.id}
                  className={cn(
                    'bg-white rounded-3xl border-2 p-5 transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer group',
                    !s.is_active ? 'opacity-60 border-surface-100' : 'border-surface-200 hover:border-brand-200'
                  )}
                  onClick={() => setPanel({ mode: 'edit', staff: s })}
                >
                  {/* Avatar row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-12 h-12 rounded-2xl bg-gradient-to-br text-white font-extrabold text-base flex items-center justify-center flex-shrink-0 relative',
                        ROLE_COLORS[s.role] ?? ROLE_COLORS.waiter
                      )}>
                        {getInitials(s.name)}
                        {isClockedIn && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-surface-900 text-sm">{s.name}</p>
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', getRoleBadgeClass(s.role))}>
                          {getRoleLabel(s.role)}
                        </span>
                      </div>
                    </div>
                    {!s.is_active && (
                      <span className="text-[10px] bg-surface-100 text-surface-400 font-bold px-2 py-1 rounded-full">Inactive</span>
                    )}
                  </div>

                  {/* Contact */}
                  <div className="space-y-1 mb-4">
                    <p className="text-xs text-surface-500 flex items-center gap-1.5">
                      <Mail className="w-3 h-3" /> {s.email}
                    </p>
                    {(s as any).phone && (
                      <p className="text-xs text-surface-500 flex items-center gap-1.5">
                        <Phone className="w-3 h-3" /> {(s as any).phone}
                      </p>
                    )}
                    {(s as any).has_pin && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1.5">
                        <Fingerprint className="w-3 h-3" /> Login PIN set
                      </p>
                    )}
                  </div>

                  {/* Clock status + actions */}
                  {canManager && s.is_active && s.role !== 'owner' && (
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      {isClockedIn ? (
                        <>
                          <div className="flex-1 text-xs text-emerald-700 bg-emerald-50 rounded-xl px-2 py-1.5 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            {hoursWorked(shift!.clocked_in_at, null)}
                          </div>
                          <button
                            onClick={() => setClockModal({ staff: s, action: 'out' })}
                            className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-xl px-3 py-1.5 transition-colors"
                          >
                            <LogOut className="w-3.5 h-3.5" /> Out
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setClockModal({ staff: s, action: 'in' })}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 bg-surface-50 border border-surface-200 hover:bg-emerald-50 hover:border-emerald-200 rounded-xl py-1.5 transition-colors"
                        >
                          <LogIn className="w-3.5 h-3.5" /> Clock In
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
