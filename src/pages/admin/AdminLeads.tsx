import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, Search, Filter, Download, Phone, Mail, 
  Store, Clock, Calendar, CheckCircle2, AlertCircle, 
  FileText, MessageSquare, ExternalLink, RefreshCw, 
  Sparkles, Check, ChevronDown, Edit3, ArrowUpRight 
} from 'lucide-react';
import { adminApi, BASE_URL, getToken } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';
import type { Lead, LeadStatus, LeadCounts } from '../../types';

const STATUS_CONFIG: Record<LeadStatus, { label: string; badge: string; dot: string }> = {
  new: {
    label: 'New Inquiry',
    badge: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    dot: 'bg-blue-400',
  },
  contacted: {
    label: 'Contacted',
    badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    dot: 'bg-amber-400',
  },
  'demo booked': {
    label: 'Demo Booked',
    badge: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
    dot: 'bg-purple-400',
  },
  won: {
    label: 'Won (Customer)',
    badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  lost: {
    label: 'Lost',
    badge: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    dot: 'bg-rose-400',
  },
};

export default function AdminLeads() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  
  // Note editing state
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  // Fetch leads and counts
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-leads', selectedStatus, search],
    queryFn: async () => {
      const res = await adminApi.leads({
        status: selectedStatus,
        search: search.trim() || undefined,
      });
      return res as { leads: Lead[]; counts: LeadCounts };
    },
  });

  const leads = data?.leads || [];
  const counts = data?.counts || { total: 0, new: 0, contacted: 0, demo_booked: 0, won: 0, lost: 0 };

  // Status mutation
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      return adminApi.updateLeadStatus(id, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
    },
  });

  // Notes mutation
  const notesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      return adminApi.updateLeadNotes(id, notes);
    },
    onSuccess: () => {
      setEditingLeadId(null);
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
    },
  });

  const handleStartEditNotes = (lead: Lead) => {
    setEditingLeadId(lead.id);
    setNotesDraft(lead.notes || '');
  };

  const handleSaveNotes = (id: string) => {
    notesMutation.mutate({ id, notes: notesDraft });
  };

  const handleExportCsv = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${BASE_URL}/admin/leads/export`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kushina_leads_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV Export failed:', err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/60 p-6 rounded-3xl border border-slate-800/80 shadow-xl backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded-md bg-orange-500/10 text-orange-400">
              <Users className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-orange-400 uppercase tracking-widest">
              Growth & Pipeline
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
            Lead Inquiries
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Prospects requesting on-site restaurant walkthroughs, hardware quotes, and demo callbacks
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3.5 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-orange-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-4 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-lg shadow-orange-600/25 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards / Status Filter Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { key: 'all', label: 'All Inquiries', count: counts.total, color: 'text-white', activeClass: 'border-orange-500 bg-orange-500/10' },
          { key: 'new', label: 'New', count: counts.new, color: 'text-blue-400', activeClass: 'border-blue-500 bg-blue-500/10' },
          { key: 'contacted', label: 'Contacted', count: counts.contacted, color: 'text-amber-400', activeClass: 'border-amber-500 bg-amber-500/10' },
          { key: 'demo booked', label: 'Demo Booked', count: counts.demo_booked, color: 'text-purple-400', activeClass: 'border-purple-500 bg-purple-500/10' },
          { key: 'won', label: 'Won', count: counts.won, color: 'text-emerald-400', activeClass: 'border-emerald-500 bg-emerald-500/10' },
          { key: 'lost', label: 'Lost', count: counts.lost, color: 'text-rose-400', activeClass: 'border-rose-500 bg-rose-500/10' },
        ].map((tab) => {
          const isActive = selectedStatus === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSelectedStatus(tab.key)}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                isActive 
                  ? `${tab.activeClass} shadow-md` 
                  : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {tab.label}
              </div>
              <div className={`text-2xl font-display font-black mt-1 ${tab.color}`}>
                {tab.count}
              </div>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by restaurant name, contact person, phone, email, notes..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all"
          />
        </div>
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="text-xs text-slate-400 hover:text-white px-2 py-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* Leads Table / Card View */}
      {isLoading ? (
        <div className="p-16 text-center text-slate-400 bg-slate-950/60 rounded-3xl border border-slate-800">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold">Loading inquiries...</p>
        </div>
      ) : leads.length === 0 ? (
        <div className="p-16 text-center text-slate-400 bg-slate-950/60 rounded-3xl border border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-slate-500 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">No lead inquiries found</h3>
          <p className="text-xs max-w-sm mx-auto text-slate-400">
            {search || selectedStatus !== 'all' 
              ? 'No leads matching your current search or status filter.' 
              : 'New demo bookings and quote requests from the public marketing site will automatically populate here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {leads.map((lead) => {
            const currentStatus = lead.status as LeadStatus;
            const statusConfig = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.new;
            const isEditingNotes = editingLeadId === lead.id;

            return (
              <div
                key={lead.id}
                className="bg-slate-950/70 border border-slate-800/80 hover:border-slate-700/90 rounded-3xl p-6 shadow-xl transition-all space-y-4"
              >
                {/* Top Row: Venue, Contact, Status Picker */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/60 pb-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center font-display font-black text-lg shrink-0">
                      {lead.business_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-lg font-bold text-white">
                          {lead.business_name}
                        </h3>
                        <span className="text-xs text-slate-400 font-medium">
                          ({lead.name})
                        </span>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {lead.branches === '1' ? '1 Branch' : `${lead.branches} Branches`}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-400 uppercase font-mono">
                          {lead.language.toUpperCase()}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-400 mt-1.5 flex-wrap">
                        <a
                          href={`tel:${lead.phone}`}
                          className="flex items-center gap-1.5 text-orange-400 hover:underline font-mono font-bold"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{lead.phone}</span>
                        </a>

                        {lead.email && (
                          <a
                            href={`mailto:${lead.email}`}
                            className="flex items-center gap-1.5 hover:text-slate-200"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span>{lead.email}</span>
                          </a>
                        )}

                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Submitted: {formatDateTime(lead.created_at)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Dropdown */}
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-slate-400 font-medium">
                      Status:
                    </div>
                    <select
                      value={lead.status}
                      onChange={(e) => statusMutation.mutate({ id: lead.id, status: e.target.value as LeadStatus })}
                      disabled={statusMutation.isPending}
                      className={`text-xs font-bold px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all cursor-pointer ${statusConfig.badge}`}
                    >
                      <option value="new" className="bg-slate-900 text-white">New Inquiry</option>
                      <option value="contacted" className="bg-slate-900 text-white">Contacted</option>
                      <option value="demo booked" className="bg-slate-900 text-white">Demo Booked</option>
                      <option value="won" className="bg-slate-900 text-white">Won (Customer)</option>
                      <option value="lost" className="bg-slate-900 text-white">Lost</option>
                    </select>
                  </div>
                </div>

                {/* Middle Row: Inquiry Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-500 font-medium uppercase tracking-wider block mb-1">
                      Primary Interest
                    </span>
                    <span className="text-slate-200 font-bold">
                      {lead.interest}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-500 font-medium uppercase tracking-wider block mb-1">
                      Preferred Call Time
                    </span>
                    <span className="text-slate-200 font-bold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-orange-400" />
                      <span>{lead.preferred_contact_time}</span>
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-500 font-medium uppercase tracking-wider block mb-1">
                      Source Page
                    </span>
                    <span className="text-slate-200 font-mono">
                      {lead.source_page || '/'}
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Staff Notes */}
                <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-orange-400" />
                      <span>Follow-Up Notes</span>
                    </span>
                    {!isEditingNotes && (
                      <button
                        type="button"
                        onClick={() => handleStartEditNotes(lead)}
                        className="text-xs text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>{lead.notes ? 'Edit Notes' : '+ Add Note'}</span>
                      </button>
                    )}
                  </div>

                  {isEditingNotes ? (
                    <div className="space-y-2">
                      <textarea
                        rows={2}
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        placeholder="Add call notes e.g., 'Called manager, booked Tuesday 10AM on-site walkthrough with tablet & printer bundle'..."
                        className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingLeadId(null)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveNotes(lead.id)}
                          disabled={notesMutation.isPending}
                          className="px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-500 cursor-pointer"
                        >
                          {notesMutation.isPending ? 'Saving...' : 'Save Note'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-300 leading-relaxed italic">
                      {lead.notes ? `"${lead.notes}"` : 'No follow-up notes recorded yet.'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
