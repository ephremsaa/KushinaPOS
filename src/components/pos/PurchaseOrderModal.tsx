import React, { useState } from 'react';
import {
  Printer, X, Truck, Phone, Mail, Package,
  AlertTriangle, DollarSign, CheckCircle2, ChevronRight
} from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import type { InventoryItem, Supplier } from '../../types';

interface PurchaseOrderModalProps {
  items: InventoryItem[];
  suppliers: Supplier[];
  restaurantName: string;
  onClose: () => void;
}

export function PurchaseOrderModal({
  items,
  suppliers,
  restaurantName,
  onClose,
}: PurchaseOrderModalProps) {
  // Find all low-stock items
  const lowStockItems = items.filter((i) => i.quantity <= i.low_stock_threshold);

  // Group items by supplier
  const supplierMap = new Map<string, Supplier>();
  suppliers.forEach((s) => supplierMap.set(s.id, s));

  // Build supplier order groups
  const groupedOrders: {
    supplier: Supplier | null;
    items: {
      item: InventoryItem;
      suggestedOrderQty: number;
      estimatedCost: number;
    }[];
    totalCost: number;
  }[] = [];

  const unassignedItems: {
    item: InventoryItem;
    suggestedOrderQty: number;
    estimatedCost: number;
  }[] = [];

  lowStockItems.forEach((item) => {
    // Calculate suggested reorder: target is 3x the threshold
    const targetStock = Math.max(item.low_stock_threshold * 3, 10);
    const needed = Math.max(0, targetStock - item.quantity);
    const estimatedCost = needed * (item.cost_per_unit || 0);

    if (item.supplier_id && supplierMap.has(item.supplier_id)) {
      const supp = supplierMap.get(item.supplier_id)!;
      let grp = groupedOrders.find((g) => g.supplier?.id === supp.id);
      if (!grp) {
        grp = { supplier: supp, items: [], totalCost: 0 };
        groupedOrders.push(grp);
      }
      grp.items.push({ item, suggestedOrderQty: needed, estimatedCost });
      grp.totalCost += estimatedCost;
    } else {
      unassignedItems.push({ item, suggestedOrderQty: needed, estimatedCost });
    }
  });

  if (unassignedItems.length > 0) {
    groupedOrders.push({
      supplier: null,
      items: unassignedItems,
      totalCost: unassignedItems.reduce((acc, i) => acc + i.estimatedCost, 0),
    });
  }

  const grandTotalCost = groupedOrders.reduce((acc, g) => acc + g.totalCost, 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-surface rounded-[2rem] w-full max-w-2xl shadow-2xl border border-default flex flex-col max-h-[92vh] overflow-hidden my-auto">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-surface-100 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg text-primary">
                Supplier Purchase Reorder Sheet
              </h3>
              <p className="text-xs text-muted">
                {lowStockItems.length} low stock item{lowStockItems.length === 1 ? '' : 's'} requiring restock
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-100 text-surface-400 hover:text-surface-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 print:p-4 print:overflow-visible">
          {/* Printable Header */}
          <div className="border-b border-default pb-4 flex justify-between items-start">
            <div>
              <h2 className="font-display font-black text-2xl text-primary">
                {restaurantName}
              </h2>
              <p className="text-xs text-muted font-mono mt-0.5">
                PURCHASE REORDER MANIFEST · Generated {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-surface-400">Estimated Restock Budget</p>
              <p className="font-display font-black text-xl text-emerald-600 font-mono">
                {formatCurrency(grandTotalCost)}
              </p>
            </div>
          </div>

          {lowStockItems.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h4 className="font-bold text-base text-surface-800">Inventory Healthy</h4>
              <p className="text-xs text-muted">All items are currently above their minimum safety thresholds.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedOrders.map((grp, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-default/80 p-4 space-y-3 bg-surface-50/50"
                >
                  {/* Supplier Info Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-default">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-brand-500" />
                      <span className="font-bold text-sm text-primary">
                        {grp.supplier ? grp.supplier.name : 'Unassigned Supplier / Local Market'}
                      </span>
                    </div>

                    {grp.supplier && (
                      <div className="flex items-center gap-3 text-xs text-muted">
                        {grp.supplier.phone && (
                          <a
                            href={`tel:${grp.supplier.phone}`}
                            className="flex items-center gap-1 text-brand-600 hover:underline font-bold"
                          >
                            <Phone className="w-3.5 h-3.5" /> {grp.supplier.phone}
                          </a>
                        )}
                        {grp.supplier.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" /> {grp.supplier.email}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Items Table */}
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-surface-400 font-bold border-b border-default">
                        <th className="pb-1.5 font-bold">Item</th>
                        <th className="pb-1.5 text-center font-bold">In Stock</th>
                        <th className="pb-1.5 text-center font-bold">Threshold</th>
                        <th className="pb-1.5 text-center font-bold text-brand-600">Reorder Qty</th>
                        <th className="pb-1.5 text-right font-bold">Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {grp.items.map(({ item, suggestedOrderQty, estimatedCost }) => (
                        <tr key={item.id} className="py-2">
                          <td className="py-2 font-bold text-surface-800">
                            {item.name}
                          </td>
                          <td className="py-2 text-center text-red-600 font-bold font-mono">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="py-2 text-center text-muted font-mono">
                            {item.low_stock_threshold} {item.unit}
                          </td>
                          <td className="py-2 text-center font-bold font-mono text-brand-600 bg-brand-50/50 rounded-lg">
                            +{suggestedOrderQty} {item.unit}
                          </td>
                          <td className="py-2 text-right font-mono font-bold text-surface-800">
                            {formatCurrency(estimatedCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Group Subtotal */}
                  <div className="pt-2 flex justify-between items-center text-xs font-bold text-surface-700 border-t border-dashed border-default">
                    <span>Subtotal ({grp.items.length} items):</span>
                    <span className="font-mono text-sm text-primary">
                      {formatCurrency(grp.totalCost)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-surface-50 border-t border-default flex items-center justify-between gap-3 px-6 print:hidden">
          <button onClick={onClose} className="btn-secondary btn-sm flex-1">
            Close
          </button>
          <button
            onClick={handlePrint}
            disabled={lowStockItems.length === 0}
            className="btn-primary btn-sm flex-1 gap-1.5 shadow-md bg-surface-900 hover:bg-black text-white"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            Print Purchase Order
          </button>
        </div>
      </div>
    </div>
  );
}
