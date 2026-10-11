import React, { useState, useEffect } from 'react';
import {
  ShoppingBag, Truck, Store, Clock, Plus, Trash2, Edit2,
  Check, AlertCircle, Loader2, DollarSign, MapPin, Sparkles
} from 'lucide-react';
import { restaurantApi } from '../../../lib/api';
import { Button, Input, Modal } from '../../../components/ui';
import { formatCurrency, cn } from '../../../lib/utils';
import { globalToast } from '../../../components/ui/Toast';
import { useLanguage } from '../../../contexts/LanguageContext';

interface DeliveryZone {
  id: string;
  restaurant_id: string;
  name: string;
  fee: number | string;
  min_order_amount: number | string;
  estimated_minutes: number;
  is_active: boolean;
}

interface OnlineOrderingTabProps {
  restaurant: any;
  onRefresh: () => void;
}

export default function OnlineOrderingTab({ restaurant, onRefresh }: OnlineOrderingTabProps) {
  const { t: _t } = useLanguage();

  // Settings state
  const [onlineEnabled, setOnlineEnabled] = useState(Boolean(restaurant?.online_ordering_enabled));
  const [pickupEnabled, setPickupEnabled] = useState(Boolean(restaurant?.online_pickup_enabled ?? true));
  const [deliveryEnabled, setDeliveryEnabled] = useState(Boolean(restaurant?.online_delivery_enabled));
  const [autoAccept, setAutoAccept] = useState(Boolean(restaurant?.online_auto_accept));
  const [prepTimeMinutes, setPrepTimeMinutes] = useState(Number(restaurant?.online_prep_time_minutes ?? 25));
  const [maxActiveOrders, setMaxActiveOrders] = useState(Number(restaurant?.online_max_active_orders ?? 20));

  // Payment methods: array of string e.g. ['cash', 'telebirr', 'cbe_birr']
  const initialMethods = Array.isArray(restaurant?.online_payment_methods)
    ? restaurant.online_payment_methods
    : ['cash', 'telebirr', 'cbe_birr'];
  const [paymentMethods, setPaymentMethods] = useState<string[]>(initialMethods);

  // Delivery Zones state
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Zone Modal
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [zoneName, setZoneName] = useState('');
  const [zoneFee, setZoneFee] = useState('50');
  const [zoneMinOrder, setZoneMinOrder] = useState('0');
  const [zoneEstMinutes, setZoneEstMinutes] = useState('35');
  const [zoneSaving, setZoneSaving] = useState(false);
  const [zoneError, setZoneError] = useState('');

  // Fetch Delivery Zones
  const loadZones = async () => {
    setZonesLoading(true);
    try {
      const data = await restaurantApi.getDeliveryZones();
      setZones(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load delivery zones:', err);
      globalToast.error('Failed to load delivery zones');
    } finally {
      setZonesLoading(false);
    }
  };

  useEffect(() => {
    loadZones();
  }, []);

  // Sync settings if restaurant changes
  useEffect(() => {
    if (restaurant) {
      setOnlineEnabled(Boolean(restaurant.online_ordering_enabled));
      setPickupEnabled(Boolean(restaurant.online_pickup_enabled ?? true));
      setDeliveryEnabled(Boolean(restaurant.online_delivery_enabled));
      setAutoAccept(Boolean(restaurant.online_auto_accept));
      setPrepTimeMinutes(Number(restaurant.online_prep_time_minutes ?? 25));
      setMaxActiveOrders(Number(restaurant.online_max_active_orders ?? 20));
      if (Array.isArray(restaurant.online_payment_methods)) {
        setPaymentMethods(restaurant.online_payment_methods);
      }
    }
  }, [restaurant]);

  const togglePaymentMethod = (method: string) => {
    setPaymentMethods((prev: string[]) =>
      prev.includes(method) ? prev.filter((m: string) => m !== method) : [...prev, method]
    );
  };

  const handleSaveSettings = async () => {
    if (paymentMethods.length === 0) {
      globalToast.error('Please select at least one accepted payment option.');
      return;
    }

    setSavingSettings(true);
    try {
      await restaurantApi.update({
        online_ordering_enabled: onlineEnabled,
        online_pickup_enabled: pickupEnabled,
        online_delivery_enabled: deliveryEnabled,
        online_auto_accept: autoAccept,
        online_prep_time_minutes: prepTimeMinutes,
        online_max_active_orders: maxActiveOrders,
        online_payment_methods: paymentMethods,
      });
      globalToast.success('Online ordering settings updated');
      onRefresh();
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      globalToast.error(err.message || 'Failed to save online ordering settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const openAddZoneModal = () => {
    setEditingZone(null);
    setZoneName('');
    setZoneFee('50');
    setZoneMinOrder('0');
    setZoneEstMinutes('35');
    setZoneError('');
    setIsZoneModalOpen(true);
  };

  const openEditZoneModal = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setZoneName(zone.name);
    setZoneFee(String(zone.fee));
    setZoneMinOrder(String(zone.min_order_amount));
    setZoneEstMinutes(String(zone.estimated_minutes));
    setZoneError('');
    setIsZoneModalOpen(true);
  };

  const handleSaveZone = async () => {
    if (!zoneName.trim()) {
      setZoneError('Zone name / Landmark area is required');
      return;
    }

    const feeNum = parseFloat(zoneFee);
    const minOrderNum = parseFloat(zoneMinOrder);
    const estMinsNum = parseInt(zoneEstMinutes, 10);

    if (isNaN(feeNum) || feeNum < 0) {
      setZoneError('Delivery fee must be a valid positive number');
      return;
    }
    if (isNaN(minOrderNum) || minOrderNum < 0) {
      setZoneError('Minimum order amount must be a valid positive number');
      return;
    }
    if (isNaN(estMinsNum) || estMinsNum < 5) {
      setZoneError('Estimated minutes must be at least 5 minutes');
      return;
    }

    setZoneSaving(true);
    setZoneError('');

    try {
      const payload = {
        name: zoneName.trim(),
        fee: feeNum,
        min_order_amount: minOrderNum,
        estimated_minutes: estMinsNum,
        is_active: editingZone ? editingZone.is_active : true,
      };

      if (editingZone) {
        await restaurantApi.updateDeliveryZone(editingZone.id, payload);
        globalToast.success('Delivery zone updated');
      } else {
        await restaurantApi.createDeliveryZone(payload);
        globalToast.success('Delivery zone added');
      }

      setIsZoneModalOpen(false);
      loadZones();
    } catch (err: any) {
      setZoneError(err.message || 'Failed to save delivery zone');
    } finally {
      setZoneSaving(false);
    }
  };

  const handleDeleteZone = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete delivery zone "${name}"?`)) return;
    try {
      await restaurantApi.deleteDeliveryZone(id);
      globalToast.success('Delivery zone removed');
      loadZones();
    } catch (err: any) {
      globalToast.error(err.message || 'Failed to delete delivery zone');
    }
  };

  const handleToggleZoneStatus = async (zone: DeliveryZone) => {
    try {
      await restaurantApi.updateDeliveryZone(zone.id, { is_active: !zone.is_active });
      setZones((prev: DeliveryZone[]) => prev.map((z: DeliveryZone) => z.id === zone.id ? { ...z, is_active: !zone.is_active } : z));
    } catch (err: any) {
      globalToast.error('Failed to update zone status');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-brand-600 via-emerald-600 to-teal-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold tracking-wide uppercase">
              <ShoppingBag className="w-3.5 h-3.5" />
              Ethiopian Landmark Online Ordering
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight">
              Pickup & Delivery Setup
            </h2>
            <p className="text-white/80 text-sm leading-relaxed">
              Accept orders directly from your branded web menu (<code className="bg-black/20 px-2 py-0.5 rounded text-white font-mono text-xs">/r/{restaurant?.slug || 'slug'}/order</code>).
              Orders automatically respect operating hours, kitchen capacity, and Ethiopian landmark delivery zones.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20">
            <div className="text-right">
              <p className="text-xs text-white/70 font-medium">Online Service Status</p>
              <p className="text-sm font-bold">{onlineEnabled ? 'Accepting Orders' : 'Offline / Closed'}</p>
            </div>
            <button
              onClick={() => setOnlineEnabled(!onlineEnabled)}
              className={cn(
                'w-12 h-6 rounded-full transition-colors relative cursor-pointer',
                onlineEnabled ? 'bg-emerald-400' : 'bg-white/30'
              )}
            >
              <div
                className={cn(
                  'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow',
                  onlineEnabled ? 'right-0.5' : 'left-0.5'
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Fulfillment Channels */}
        <div className="card p-6 space-y-5 border border-default/80">
          <div className="flex items-center gap-3 pb-3 border-b border-default/60">
            <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-primary">Fulfillment Channels</h3>
              <p className="text-xs text-muted">Enable pickup takeaway or landmark-based delivery</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-50 border border-default/60">
              <div>
                <p className="text-sm font-bold text-primary flex items-center gap-2">
                  <Store className="w-4 h-4 text-emerald-600" /> Customer Pickup
                </p>
                <p className="text-xs text-muted mt-0.5">Customers pick up directly from the restaurant counter</p>
              </div>
              <button
                type="button"
                onClick={() => setPickupEnabled(!pickupEnabled)}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors relative cursor-pointer',
                  pickupEnabled ? 'bg-brand-600' : 'bg-surface-300'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow',
                    pickupEnabled ? 'right-0.5' : 'left-0.5'
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-50 border border-default/60">
              <div>
                <p className="text-sm font-bold text-primary flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-600" /> Landmark Delivery
                </p>
                <p className="text-xs text-muted mt-0.5">Deliver to customers via dispatch drivers and named zones</p>
              </div>
              <button
                type="button"
                onClick={() => setDeliveryEnabled(!deliveryEnabled)}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors relative cursor-pointer',
                  deliveryEnabled ? 'bg-brand-600' : 'bg-surface-300'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow',
                    deliveryEnabled ? 'right-0.5' : 'left-0.5'
                  )}
                />
              </button>
            </div>
          </div>

          {/* Operating Hours Note */}
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs flex items-start gap-2.5">
            <Clock className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
            <p>
              <strong>Operating Hours Guard:</strong> Online orders are automatically blocked outside operating hours configured in your <span className="font-semibold underline">Operating Hours</span> tab.
            </p>
          </div>
        </div>

        {/* Card 2: Kitchen Capacity & Acceptance */}
        <div className="card p-6 space-y-5 border border-default/80">
          <div className="flex items-center gap-3 pb-3 border-b border-default/60">
            <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-primary">Kitchen & Capacity</h3>
              <p className="text-xs text-muted">Control preparation estimation and load throttling</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label text-xs font-bold text-primary">Est. Prep Time (Mins)</label>
                <Input
                  type="number"
                  min="5"
                  max="180"
                  value={prepTimeMinutes}
                  onChange={e => setPrepTimeMinutes(parseInt(e.target.value) || 25)}
                  className="!py-2 font-mono font-bold"
                />
                <p className="text-[10px] text-muted mt-1">Default time communicated to customer</p>
              </div>

              <div>
                <label className="label text-xs font-bold text-primary">Max Active Orders</label>
                <Input
                  type="number"
                  min="1"
                  max="200"
                  value={maxActiveOrders}
                  onChange={e => setMaxActiveOrders(parseInt(e.target.value) || 20)}
                  className="!py-2 font-mono font-bold"
                />
                <p className="text-[10px] text-muted mt-1">Stops incoming orders when full</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-50 border border-default/60">
              <div>
                <p className="text-sm font-bold text-primary flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" /> Auto-Accept Orders
                </p>
                <p className="text-xs text-muted mt-0.5">Directly route to KDS without staff confirmation</p>
              </div>
              <button
                type="button"
                onClick={() => setAutoAccept(!autoAccept)}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors relative cursor-pointer',
                  autoAccept ? 'bg-brand-600' : 'bg-surface-300'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow',
                    autoAccept ? 'right-0.5' : 'left-0.5'
                  )}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Accepted Payment Methods */}
      <div className="card p-6 space-y-4 border border-default/80">
        <div className="flex items-center justify-between pb-3 border-b border-default/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-primary">Accepted Payment Methods</h3>
              <p className="text-xs text-muted">Orders are always created unpaid; verified upon handback or transfer proof</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Cash */}
          <label className={cn(
            'flex items-center gap-3.5 p-4 rounded-2xl border-2 transition-all cursor-pointer',
            paymentMethods.includes('cash')
              ? 'border-brand-500 bg-brand-50/40 text-brand-900 shadow-xs'
              : 'border-default bg-surface hover:border-surface-300'
          )}>
            <input
              type="checkbox"
              checked={paymentMethods.includes('cash')}
              onChange={() => togglePaymentMethod('cash')}
              className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 cursor-pointer"
            />
            <div>
              <p className="font-bold text-sm">💵 Cash on Delivery / Pickup</p>
              <p className="text-xs text-muted mt-0.5">Driver or counter cash handover</p>
            </div>
          </label>

          {/* Telebirr */}
          <label className={cn(
            'flex items-center gap-3.5 p-4 rounded-2xl border-2 transition-all cursor-pointer',
            paymentMethods.includes('telebirr')
              ? 'border-brand-500 bg-brand-50/40 text-brand-900 shadow-xs'
              : 'border-default bg-surface hover:border-surface-300'
          )}>
            <input
              type="checkbox"
              checked={paymentMethods.includes('telebirr')}
              onChange={() => togglePaymentMethod('telebirr')}
              className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 cursor-pointer"
            />
            <div>
              <p className="font-bold text-sm">📱 Telebirr Transfer</p>
              <p className="text-xs text-muted mt-0.5">Reference number & screenshot</p>
            </div>
          </label>

          {/* CBE Birr */}
          <label className={cn(
            'flex items-center gap-3.5 p-4 rounded-2xl border-2 transition-all cursor-pointer',
            paymentMethods.includes('cbe_birr')
              ? 'border-brand-500 bg-brand-50/40 text-brand-900 shadow-xs'
              : 'border-default bg-surface hover:border-surface-300'
          )}>
            <input
              type="checkbox"
              checked={paymentMethods.includes('cbe_birr')}
              onChange={() => togglePaymentMethod('cbe_birr')}
              className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 cursor-pointer"
            />
            <div>
              <p className="font-bold text-sm">🏦 CBE Birr Transfer</p>
              <p className="text-xs text-muted mt-0.5">Commercial Bank of Ethiopia</p>
            </div>
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            variant="primary"
            loading={savingSettings}
            onClick={handleSaveSettings}
            className="gap-2"
          >
            <Check className="w-4 h-4" /> Save Online Settings
          </Button>
        </div>
      </div>

      {/* Card 4: Delivery Zones (Ethiopian Landmarks) */}
      <div className="card p-6 space-y-5 border border-default/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-default/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-primary">Delivery Zones (Landmark Based)</h3>
              <p className="text-xs text-muted">
                Ethiopian addresses are landmark-based (e.g. Bole Medhanialem, Kazanchis, Mexico, Sarbet). Configure flat fees and minimum order requirements.
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={openAddZoneModal}
            icon={<Plus className="w-4 h-4" />}
            className="flex-shrink-0"
          >
            Add Delivery Zone
          </Button>
        </div>

        {zonesLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-muted gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
            <p className="text-xs">Loading delivery zones…</p>
          </div>
        ) : zones.length === 0 ? (
          <div className="py-12 border-2 border-dashed border-default rounded-3xl text-center space-y-3 p-6 bg-surface-50/50">
            <MapPin className="w-10 h-10 text-surface-400 mx-auto" />
            <div className="space-y-1">
              <p className="font-bold text-primary text-sm">No Delivery Zones Defined</p>
              <p className="text-xs text-muted max-w-md mx-auto">
                Add named delivery areas like "Bole - Edna Mall", "Kazanchis", or "Sarbet" with their respective delivery fee and minimum order amount.
              </p>
            </div>
            <Button variant="primary" onClick={openAddZoneModal} icon={<Plus className="w-4 h-4" />}>
              Create First Delivery Zone
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-default/80">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-50 border-b border-default text-[11px] uppercase tracking-wider text-surface-500 font-semibold">
                <tr>
                  <th className="py-3 px-4">Zone / Landmark Name</th>
                  <th className="py-3 px-4">Delivery Fee</th>
                  <th className="py-3 px-4">Min. Order</th>
                  <th className="py-3 px-4">Est. Time</th>
                  <th className="py-3 px-4 text-center">Active</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 font-medium">
                {zones.map((zone: DeliveryZone) => (
                  <tr key={zone.id} className="hover:bg-surface-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-primary flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
                      {zone.name}
                    </td>
                    <td className="py-3.5 px-4 text-emerald-700 font-bold font-mono">
                      {formatCurrency(Number(zone.fee))}
                    </td>
                    <td className="py-3.5 px-4 text-surface-600 font-mono">
                      {Number(zone.min_order_amount) > 0 ? formatCurrency(Number(zone.min_order_amount)) : 'None'}
                    </td>
                    <td className="py-3.5 px-4 text-surface-600">
                      ⏱️ {zone.estimated_minutes} mins
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleToggleZoneStatus(zone)}
                        className={cn(
                          'w-9 h-5 rounded-full transition-colors relative cursor-pointer inline-block align-middle',
                          zone.is_active ? 'bg-emerald-500' : 'bg-surface-300'
                        )}
                      >
                        <div
                          className={cn(
                            'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform shadow',
                            zone.is_active ? 'right-0.5' : 'left-0.5'
                          )}
                        />
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1">
                      <button
                        onClick={() => openEditZoneModal(zone)}
                        className="p-1.5 text-muted hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit zone"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteZone(zone.id, zone.name)}
                        className="p-1.5 text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete zone"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Delivery Zone Modal */}
      <Modal
        open={isZoneModalOpen}
        onClose={() => setIsZoneModalOpen(false)}
        title={editingZone ? 'Edit Delivery Zone' : 'Add Ethiopian Delivery Zone'}
        description="Enter the named area or landmark, delivery fee in ETB, and minimum order requirements."
        icon={<MapPin className="w-5 h-5 text-brand-600" />}
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button variant="ghost" onClick={() => setIsZoneModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={zoneSaving} onClick={handleSaveZone}>
              {editingZone ? 'Save Changes' : 'Create Zone'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pt-2">
          {zoneError && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{zoneError}</span>
            </div>
          )}

          <div>
            <label className="label text-xs font-bold text-primary">Landmark / Zone Name *</label>
            <Input
              type="text"
              placeholder="e.g. Bole - Edna Mall / Medhanialem"
              value={zoneName}
              onChange={e => setZoneName(e.target.value)}
              className="!py-2.5"
            />
            <p className="text-[11px] text-muted mt-1">
              Descriptive Ethiopian landmark area shown to customer in delivery dropdown
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label text-xs font-bold text-primary">Delivery Fee (ETB) *</label>
              <Input
                type="number"
                min="0"
                step="5"
                placeholder="50"
                value={zoneFee}
                onChange={e => setZoneFee(e.target.value)}
                className="!py-2.5 font-mono font-bold"
              />
            </div>

            <div>
              <label className="label text-xs font-bold text-primary">Minimum Order (ETB)</label>
              <Input
                type="number"
                min="0"
                step="25"
                placeholder="0"
                value={zoneMinOrder}
                onChange={e => setZoneMinOrder(e.target.value)}
                className="!py-2.5 font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="label text-xs font-bold text-primary">Estimated Delivery Time (Minutes) *</label>
            <Input
              type="number"
              min="5"
              max="240"
              placeholder="35"
              value={zoneEstMinutes}
              onChange={e => setZoneEstMinutes(e.target.value)}
              className="!py-2.5 font-mono font-bold"
            />
            <p className="text-[11px] text-muted mt-1">
              Estimated duration from order acceptance to delivery arrival
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
