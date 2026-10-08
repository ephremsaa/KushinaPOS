import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar as CalendarIcon, Clock, Users, Plus, Phone, Trash2, Check, User, MapPin } from 'lucide-react';
import { reservationsApi, tablesApi } from '../../lib/api';
import { Button, Modal, Input } from '../../components/ui';
import { cn, formatDateTime, formatCurrency } from '../../lib/utils';
import type { Reservation, Table } from '../../types';

export default function ReservationsPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ['reservations', date],
    queryFn: async () => (await reservationsApi.get(date)) as Reservation[],
  });

  const { data: tables = [] } = useQuery({
    queryKey: ['tables'],
    queryFn: async () => (await tablesApi.list()) as Table[],
  });

  const openModal = (res?: Reservation) => {
    setSelectedRes(res || null);
    setModalOpen(true);
  };

  const handleStatusChange = async (id: string, status: string) => {
    await reservationsApi.update(id, { status });
    qc.invalidateQueries({ queryKey: ['reservations'] });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-fade-in">
      <div className="page-header bg-white/60 p-6 rounded-3xl backdrop-blur-sm border border-white/80 shadow-card">
        <div>
          <h1 className="page-title">Reservations</h1>
          <p className="page-subtitle">Manage upcoming bookings and walk-ins</p>
        </div>
        <div className="flex items-center gap-3">
          <Input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
            className="w-40"
          />
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => openModal()}>
            New Booking
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
           {[...Array(3)].map((_, i) => (
             <div key={i} className="h-20 bg-white/60 rounded-2xl animate-pulse" />
           ))}
        </div>
      ) : reservations.length === 0 ? (
        <div className="card text-center py-20">
          <CalendarIcon className="w-12 h-12 text-surface-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-surface-900">No reservations</h3>
          <p className="text-surface-500 mt-1">No bookings found for {date}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {reservations.map(res => (
            <div key={res.id} className="card p-5 flex items-center justify-between hover:shadow-md transition-shadow">
              <div className="flex gap-6 items-center">
                <div className="flex flex-col items-center justify-center w-20 h-20 bg-brand-50 text-brand-700 rounded-2xl">
                  <span className="text-sm font-bold">{new Date(res.reservation_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                
                <div className="space-y-1">
                  <h3 className="font-bold text-lg text-surface-900 flex items-center gap-2">
                    {res.customer_name}
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold",
                      res.status === 'confirmed' ? "bg-emerald-100 text-emerald-800" :
                      res.status === 'seated' ? "bg-brand-100 text-brand-800" :
                      res.status === 'cancelled' || res.status === 'no_show' ? "bg-red-100 text-red-800" :
                      "bg-surface-100 text-surface-800"
                    )}>
                      {res.status.replace('_', ' ')}
                    </span>
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-surface-500">
                    <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {res.customer_phone}</span>
                    <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {res.party_size} people</span>
                    {res.table_label && (
                      <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Table {res.table_label}</span>
                    )}
                  </div>
                  {res.notes && <p className="text-sm text-surface-400 mt-2 italic">"{res.notes}"</p>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {res.status === 'confirmed' && (
                  <Button variant="secondary" size="sm" onClick={() => handleStatusChange(res.id, 'seated')}>
                    Mark Seated
                  </Button>
                )}
                {res.status === 'confirmed' && (
                  <Button variant="ghost" size="sm" onClick={() => handleStatusChange(res.id, 'no_show')}>
                    No Show
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => openModal(res)}>
                  Edit
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <ReservationModal
          res={selectedRes}
          tables={tables}
          onClose={() => setModalOpen(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['reservations'] })}
        />
      )}
    </div>
  );
}

function ReservationModal({ res, tables, onClose, onSaved }: any) {
  const [form, setForm] = useState({
    customer_name: res?.customer_name || '',
    customer_phone: res?.customer_phone || '',
    party_size: res?.party_size || 2,
    reservation_time: res?.reservation_time ? new Date(res.reservation_time).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
    table_id: res?.table_id || '',
    notes: res?.notes || '',
    status: res?.status || 'confirmed'
  });
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      const payload = {
        ...form,
        reservation_time: new Date(form.reservation_time).toISOString(),
        table_id: form.table_id || null
      };

      if (res) {
        await reservationsApi.update(res.id, payload);
      } else {
        await reservationsApi.create(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to save reservation');
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!res) return;
    if (!confirm('Cancel this reservation?')) return;
    await reservationsApi.update(res.id, { status: 'cancelled' });
    onSaved();
    onClose();
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={res ? 'Edit Reservation' : 'New Reservation'}
      size="md"
      footer={
        <div className="flex w-full justify-between">
          {res ? (
            <Button variant="danger" size="sm" onClick={remove}>Cancel Booking</Button>
          ) : <div/>}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button variant="primary" loading={loading} onClick={save}>Save</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Customer Name" value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} required />
        <Input label="Phone Number" value={form.customer_phone} onChange={e => setForm({...form, customer_phone: e.target.value})} required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Party Size" type="number" min={1} value={form.party_size} onChange={e => setForm({...form, party_size: Number(e.target.value)})} required />
          <Input label="Date & Time" type="datetime-local" value={form.reservation_time} onChange={e => setForm({...form, reservation_time: e.target.value})} required />
        </div>
        <div>
          <label className="block text-xs font-bold text-surface-600 mb-1.5 uppercase tracking-wider">Assign Table (Optional)</label>
          <select className="select" value={form.table_id} onChange={e => setForm({...form, table_id: e.target.value})}>
            <option value="">No table assigned</option>
            {tables.map((t: Table) => (
              <option key={t.id} value={t.id}>Table {t.label} ({t.capacity} seats)</option>
            ))}
          </select>
        </div>
        <Input label="Notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
        {res && (
          <div>
            <label className="block text-xs font-bold text-surface-600 mb-1.5 uppercase tracking-wider">Status</label>
            <select className="select" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="seated">Seated</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>
          </div>
        )}
      </div>
    </Modal>
  );
}
