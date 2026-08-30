import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../../lib/api';
import { formatCurrency, cn } from '../../lib/utils';
import type { Order } from '../../types';
import { Receipt, Search, Clock, Hash, CheckCircle, AlertTriangle } from 'lucide-react';

export default function BillHistoryPage() {
  const [search, setSearch] = useState('');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders-history'],
    queryFn: async () => {
      const data = await ordersApi.history();
      return data as Order[];
    },
  });

  const filtered = orders.filter(o => 
    o.id.toLowerCase().includes(search.toLowerCase()) || 
    (o.table_label && o.table_label.toLowerCase().includes(search.toLowerCase())) ||
    (o.customer_name && o.customer_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="page-header bg-white/40 p-5 rounded-[2rem] backdrop-blur-sm border border-white/60 shadow-sm flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <h1 className="page-title flex items-center gap-2">
            <Receipt className="w-6 h-6 text-brand-500" />
            Bill History
          </h1>
          <p className="page-subtitle">View and reprint past orders from your shift.</p>
        </div>
        
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input 
            className="input pl-10 w-full bg-white/60" 
            placeholder="Search order # or table..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-surface-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-surface-400">Loading history...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Receipt className="w-12 h-12 text-surface-300 mb-3" />
            <p className="font-bold text-surface-700">No bills found</p>
            <p className="text-sm text-surface-500 mt-1">You haven't completed any orders yet today.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-100 text-xs uppercase tracking-wider text-surface-500 font-bold">
                  <th className="p-4 pl-6">Order</th>
                  <th className="p-4">Time</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Method</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {filtered.map(order => (
                  <tr key={order.id} className="hover:bg-surface-50/50 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-surface-100 flex items-center justify-center text-surface-500 flex-shrink-0">
                          <Hash className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-surface-900 text-sm">
                            {order.id.split('-')[0].toUpperCase()}
                          </p>
                          {(order.table_label || order.customer_name) && (
                            <p className="text-xs text-surface-500">
                              {order.table_label ? `Table ${order.table_label}` : order.customer_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-surface-600">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-surface-400" />
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="p-4 font-mono font-bold text-surface-900 text-sm">
                      {formatCurrency(order.total)}
                    </td>
                    <td className="p-4">
                      <span className="capitalize text-xs font-semibold px-2 py-1 bg-surface-100 text-surface-700 rounded-lg">
                        {order.payment_method || 'Unknown'}
                      </span>
                    </td>
                    <td className="p-4">
                      {order.status === 'cancelled' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-bold">
                          <AlertTriangle className="w-3 h-3" /> Voided
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">
                          <CheckCircle className="w-3 h-3" /> Paid
                        </span>
                      )}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      {/* Using window.print in a real app would be complex here, 
                          but typically this triggers a reprint to the ESC/POS printer.
                          For now we just alert. */}
                      <button 
                        className="btn-secondary text-xs px-3 py-1.5"
                        onClick={() => alert(`Reprinting receipt for ${order.id.split('-')[0].toUpperCase()}`)}
                      >
                        Reprint
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
