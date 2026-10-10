import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import type { Order } from '../../types';
import { Receipt, Search, Clock, Printer, AlertTriangle, CheckCircle } from 'lucide-react';
import { DataTable, Badge, Input, Button } from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
import { ThermalReceipt } from '../../components/pos/ThermalReceipt';
import { useAuth } from '../../contexts/AuthContext';
import { globalToast } from '../../components/ui/Toast';

export default function BillHistoryPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [reprintOrder, setReprintOrder] = useState<Order | null>(null);
  const queryClient = useQueryClient();

  const confirmMutation = useMutation({
    mutationFn: (id: string) => ordersApi.confirmPayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-history'] });
    },
    onError: () => globalToast.info('Failed to confirm payment'),
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders-history'],
    queryFn: async () => {
      const data = await ordersApi.history();
      return data as Order[];
    },
    refetchInterval: 10000,
  });

  const filtered = orders.filter(o =>
    o.id.toLowerCase().includes(search.toLowerCase()) ||
    (o.table_label && o.table_label.toLowerCase().includes(search.toLowerCase())) ||
    (o.customer_name && o.customer_name.toLowerCase().includes(search.toLowerCase())) ||
    (o.payment_reference && o.payment_reference.toLowerCase().includes(search.toLowerCase()))
  );

  const columns: DataTableColumn<Order>[] = [
    {
      key: 'id',
      label: 'Order',
      sortable: true,
      render: (_v, row) => (
        <div>
          <p className="font-mono font-bold text-primary text-sm">
            #{row.id.split('-')[0].toUpperCase()}
          </p>
          {(row.table_label || row.customer_name) && (
            <p className="text-xs text-muted mt-0.5">
              {row.table_label ? `Table ${row.table_label}` : row.customer_name}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'created_at',
      label: 'Time',
      sortable: true,
      render: (_v, row) => (
        <div className="flex items-center gap-1.5 text-sm text-surface-600">
          <Clock className="w-3.5 h-3.5 text-surface-400" />
          {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      sortable: true,
      render: (_v, row) => (
        <span className="font-mono font-bold text-primary text-sm">
          {formatCurrency(row.total)}
        </span>
      ),
    },
    {
      key: 'payment_method',
      label: 'Method',
      render: (_v, row) => (
        <div className="flex flex-col gap-0.5">
          <span className="capitalize text-xs font-semibold px-2.5 py-1 bg-surface-100 text-surface-700 rounded-xl inline-block w-fit">
            {row.payment_method?.replace('_', ' ') || 'Unknown'}
          </span>
          {row.payment_reference && (
            <span className="text-[10px] text-muted font-mono pl-1">
              Ref: {row.payment_reference}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_v, row) => (
        row.status === 'cancelled' ? (
          <Badge status="cancelled" dot>Voided</Badge>
        ) : (
          <div className="flex flex-col gap-1">
            <Badge status="served" dot><CheckCircle className="w-3 h-3 inline mr-1" />Paid</Badge>
            {row.is_payment_confirmed === false && (
              <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Unconfirmed
              </span>
            )}
          </div>
        )
      ),
    },
    {
      key: 'id' as keyof Order,
      label: '',
      align: 'right',
      render: (_v, row) => (
        <div className="flex justify-end gap-2">
          {row.is_payment_confirmed === false && row.status !== 'cancelled' && (
            <Button
              variant="outline"
              size="sm"
              icon={<CheckCircle className="w-3.5 h-3.5" />}
              onClick={() => confirmMutation.mutate(row.id)}
              disabled={confirmMutation.isPending}
            >
              Confirm
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={<Printer className="w-3.5 h-3.5" />}
            onClick={() => setReprintOrder(row)}
          >
            Reprint
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Receipt className="w-6 h-6 text-brand-500" />
            Bill History
          </h1>
          <p className="page-subtitle">View and reprint past orders from your shift.</p>
        </div>
        <div className="w-full md:w-64">
          <Input
            placeholder="Search order # or table…"
            icon={<Search className="w-4 h-4" />}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        keyField="id"
        emptyIcon={<Receipt className="w-8 h-8" />}
        emptyTitle="No bills found"
        emptyDescription={
          search
            ? `No bills match "${search}". Try a different order # or table.`
            : "You haven't completed any orders yet today."
        }
        skeletonRows={6}
      />

      {reprintOrder && (
        <ThermalReceipt
          order={reprintOrder}
          tipAmount={0}
          paymentMethod={reprintOrder.payment_method || 'cash'}
          amountTendered={reprintOrder.total}
          change={0}
          restaurantName={(user?.restaurant as any)?.name ?? user?.restaurantName ?? 'Restaurant'}
          restaurantLogo={(user?.restaurant as any)?.logo_url}
          taxId={(user?.restaurant as any)?.tax_id}
          address={(user?.restaurant as any)?.address}
          phone={(user?.restaurant as any)?.phone}
          receiptHeader={(user?.restaurant as any)?.receipt_header}
          receiptFooter={(user?.restaurant as any)?.receipt_footer}
          showTaxBreakdown={(user?.restaurant as any)?.receipt_show_tax_breakdown ?? true}
          showLogo={(user?.restaurant as any)?.receipt_show_logo ?? true}
          onClose={() => setReprintOrder(null)}
        />
      )}
    </div>
  );
}
