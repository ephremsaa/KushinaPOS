import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, X, Upload, BookOpen, Eye, EyeOff, ClipboardList,
  GripVertical, Tag, Clock, Flame, Leaf, Star, ChevronDown,
  ChevronRight, Trash2, Download, FileUp, Search, ToggleLeft,
  ToggleRight, Sparkles, Check, AlertCircle, Package
} from 'lucide-react';
import { menuApi, restaurantApi, inventoryApi, recipesApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, cn } from '../../lib/utils';
import { Modal } from '../../components/ui';
import { MenuEngineeringMatrix } from '../../components/analytics/MenuEngineeringMatrix';
import type { MenuItem, MenuCategory } from '../../types';
import { globalConfirm } from '../../contexts/ConfirmContext';
import { globalToast } from '../../components/ui/Toast';
import { assetUrl } from '../../lib/assetUrl';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModifierOption { id?: string; label: string; price_delta: number; sort_order?: number; }
interface Modifier {
  id?: string; name: string; is_required: boolean;
  min_select: number; max_select: number; options: ModifierOption[];
}

const TAGS = [
  { key: 'spicy',       label: '🌶 Spicy',       icon: Flame },
  { key: 'vegetarian',  label: '🥦 Vegetarian',   icon: Leaf },
  { key: 'vegan',       label: '🌱 Vegan',        icon: Leaf },
  { key: 'popular',     label: '⭐ Popular',      icon: Star },
  { key: 'new',         label: '✨ New',           icon: Sparkles },
  { key: 'gluten_free', label: '🌾 Gluten-Free',  icon: Check },
];

// ─── CSV Helpers ──────────────────────────────────────────────────────────────

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  return lines.slice(1).map(line => {
    const vals = line.match(/(".*?"|[^,]+)(?=,|$)/g) || [];
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (vals[i] || '').replace(/^"|"$/g, '').trim(); });
    return row;
  });
}

// ─── Modifier Editor ──────────────────────────────────────────────────────────

function ModifierEditor({ modifiers, onChange }: {
  modifiers: Modifier[];
  onChange: (m: Modifier[]) => void;
}) {
  const addGroup = () => onChange([...modifiers, { name: '', is_required: false, min_select: 0, max_select: 1, options: [{ label: '', price_delta: 0 }] }]);
  const removeGroup = (gi: number) => onChange(modifiers.filter((_, i) => i !== gi));
  const updateGroup = (gi: number, patch: Partial<Modifier>) => {
    const next = [...modifiers];
    next[gi] = { ...next[gi], ...patch };
    onChange(next);
  };
  const addOption = (gi: number) => {
    const next = [...modifiers];
    next[gi].options = [...next[gi].options, { label: '', price_delta: 0 }];
    onChange(next);
  };
  const updateOption = (gi: number, oi: number, patch: Partial<ModifierOption>) => {
    const next = [...modifiers];
    next[gi].options[oi] = { ...next[gi].options[oi], ...patch };
    onChange(next);
  };
  const removeOption = (gi: number, oi: number) => {
    const next = [...modifiers];
    next[gi].options = next[gi].options.filter((_, i) => i !== oi);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {modifiers.map((mod, gi) => (
        <div key={gi} className="border border-default rounded-2xl overflow-hidden">
          <div className="bg-surface-50 px-4 py-3 flex items-center gap-3">
            <GripVertical className="w-4 h-4 text-surface-300 flex-shrink-0" />
            <input
              className="input flex-1 py-1.5 text-sm font-semibold"
              placeholder="Group name (e.g. Size, Spice Level)"
              value={mod.name}
              onChange={e => updateGroup(gi, { name: e.target.value })}
            />
            <label className="flex items-center gap-1.5 text-xs font-semibold text-surface-600 flex-shrink-0">
              <input type="checkbox" checked={mod.is_required}
                onChange={e => updateGroup(gi, { is_required: e.target.checked })} />
              Required
            </label>
            <button onClick={async () => removeGroup(gi)} className="p-1.5 hover:bg-red-100 rounded-lg transition-colors">
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
          <div className="p-4 space-y-2">
            {mod.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  className="input flex-1 py-1.5 text-sm"
                  placeholder="Option label (e.g. Small, Large)"
                  value={opt.label}
                  onChange={e => updateOption(gi, oi, { label: e.target.value })}
                />
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-xs text-surface-400">+ETB</span>
                  <input
                    type="number"
                    step="0.5"
                    className="input w-20 py-1.5 text-sm text-right"
                    placeholder="0"
                    value={opt.price_delta || ''}
                    onChange={e => updateOption(gi, oi, { price_delta: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <button onClick={() => removeOption(gi, oi)} className="p-1.5 hover:bg-red-50 rounded-lg">
                  <X className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            ))}
            <button
              onClick={() => addOption(gi)}
              className="w-full text-left text-xs font-semibold text-brand-500 hover:text-brand-700 flex items-center gap-1 py-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add option
            </button>
          </div>
        </div>
      ))}
      <button onClick={addGroup} className="btn-secondary w-full gap-2 text-sm">
        <Plus className="w-4 h-4" /> Add Modifier Group
      </button>
    </div>
  );
}

// ─── Recipe Panel ─────────────────────────────────────────────────────────────

function RecipePanel({ item, invItems }: { item: MenuItem; invItems: any[] }) {
  const qc = useQueryClient();
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useQuery({
    queryKey: ['recipes', item.id],
    queryFn: async () => {
      const data = await recipesApi.get(item.id) as any[];
      setIngredients(data);
      setLoaded(true);
      return data;
    },
    enabled: !loaded,
  });

  const invMap = useMemo(() => {
    const map = new Map<string, any>();
    invItems.forEach((inv: any) => map.set(inv.id, inv));
    return map;
  }, [invItems]);

  const totalFoodCost = useMemo(() => {
    return ingredients.reduce((sum, ing) => {
      const inv = invMap.get(ing.inventory_item_id);
      const unitCost = Number(inv?.cost_per_unit) || 0;
      const qty = Number(ing.quantity_required) || 0;
      return sum + (unitCost * qty);
    }, 0);
  }, [ingredients, invMap]);

  const itemPrice = Number(item.price) || 0;
  const grossProfit = itemPrice > 0 ? itemPrice - totalFoodCost : 0;
  const marginPercent = itemPrice > 0 ? Math.round((grossProfit / itemPrice) * 100) : 0;

  const save = async () => {
    setSaving(true);
    try { await recipesApi.update(item.id, ingredients); qc.invalidateQueries({ queryKey: ['recipes', item.id] }); }
    catch { globalToast.info('Failed to save recipe'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-3 pt-2">
      <p className="text-xs text-muted">Link raw ingredients to calculate dish cost and auto-deplete stock when orders are placed.</p>

      {/* Real-time food cost and margin badge */}
      <div className="p-3.5 bg-surface-50 rounded-2xl border border-default flex items-center justify-between text-xs">
        <div>
          <p className="text-muted font-bold">Estimated Plate Cost</p>
          <p className="font-mono font-black text-sm text-primary mt-0.5">{formatCurrency(totalFoodCost)}</p>
        </div>
        <div className="text-right">
          <p className="text-muted font-bold">Gross Margin</p>
          <p className={cn(
            "font-mono font-black text-sm mt-0.5",
            marginPercent >= 65 ? "text-emerald-600" : marginPercent >= 40 ? "text-amber-600" : "text-red-600"
          )}>
            {itemPrice > 0 ? `${marginPercent}% (${formatCurrency(grossProfit)})` : 'N/A'}
          </p>
        </div>
      </div>

      {ingredients.map((ing, idx) => {
        const inv = invMap.get(ing.inventory_item_id);
        const lineCost = (Number(inv?.cost_per_unit) || 0) * (Number(ing.quantity_required) || 0);

        return (
          <div key={idx} className="flex gap-2 items-center bg-surface p-1 rounded-xl border border-surface-100">
            <select
              className="select flex-1 text-xs py-1.5"
              value={ing.inventory_item_id}
              onChange={e => { const n = [...ingredients]; n[idx].inventory_item_id = e.target.value; setIngredients(n); }}
            >
              <option value="">Select ingredient...</option>
              {invItems.map((invItem: any) => (
                <option key={invItem.id} value={invItem.id}>
                  {invItem.name} ({invItem.unit}) — {formatCurrency(invItem.cost_per_unit || 0)}/{invItem.unit}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="any"
              className="input w-16 text-xs py-1.5 text-right font-mono"
              placeholder="Qty"
              value={ing.quantity_required || ''}
              onChange={e => { const n = [...ingredients]; n[idx].quantity_required = Number(e.target.value); setIngredients(n); }}
            />
            <span className="text-[10px] text-surface-400 w-12 text-right font-mono font-bold">
              {formatCurrency(lineCost)}
            </span>
            <button
              onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))}
              className="p-1 hover:bg-red-50 text-surface-400 hover:text-red-500 rounded-lg cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => setIngredients([...ingredients, { inventory_item_id: '', quantity_required: 0 }])}
          className="btn-secondary text-xs flex-1 gap-1 py-2"
        >
          <Plus className="w-3.5 h-3.5" /> Add Ingredient
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="btn-primary text-xs px-5 gap-1 py-2 shadow-sm"
        >
          {saving ? '…' : <><Check className="w-3.5 h-3.5" /> Save Recipe</>}
        </button>
      </div>
    </div>
  );
}

// ─── Item Form / Slide-out Panel ──────────────────────────────────────────────

type PanelTab = 'details' | 'modifiers' | 'recipe';

function ItemPanel({
  item, categories, invItems, onClose, onSaved,
}: {
  item?: MenuItem; categories: MenuCategory[]; invItems: any[];
  onClose: () => void; onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<PanelTab>('details');
  const [form, setForm] = useState({
    name: item?.name ?? '',
    description: item?.description ?? '',
    price: item?.price !== undefined ? item.price : '' as number | string,
    category_id: item?.category_id ?? '',
    preparation_time_minutes: item?.preparation_time_minutes ?? 10,
    is_available: item?.is_available ?? true,
    tags: (item as any)?.tags ?? [] as string[],
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(item?.image_url ?? '');
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [modsLoaded, setModsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const upd = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  // Load existing modifiers
  useQuery({
    queryKey: ['modifiers', item?.id],
    queryFn: async () => {
      if (!item) { setModsLoaded(true); return []; }
      const data = await menuApi.getModifiers(item.id) as Modifier[];
      setModifiers(data);
      setModsLoaded(true);
      return data;
    },
    enabled: !!item && !modsLoaded,
  });

  const toggleTag = (tag: string) => {
    upd('tags', form.tags.includes(tag) ? form.tags.filter((t: string) => t !== tag) : [...form.tags, tag]);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const save = async () => {
    setSaving(true);
    try {
      let image_url = item?.image_url;
      if (imageFile) {
        const res = await restaurantApi.uploadMenuImage(imageFile);
        image_url = res.image_url;
      }
      const payload = { ...form, price: Number(form.price) || 0, preparation_time_minutes: Number(form.preparation_time_minutes) || 10, image_url };
      if (item) {
        await menuApi.updateItem(item.id, payload);
        await menuApi.saveModifiers(item.id, modifiers);
      } else {
        const created = await menuApi.createItem(payload) as MenuItem;
        if (modifiers.length > 0) await menuApi.saveModifiers(created.id, modifiers);
      }
      qc.invalidateQueries({ queryKey: ['menu-items'] });
      onSaved();
    } catch (e: any) {
      globalToast.info('Failed to save: ' + (e.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!item) return;
    if (!(await globalConfirm(`Delete "${item.name}"? This cannot be undone.`))) return;
    setDeleting(true);
    try {
      await menuApi.deleteItem(item.id);
      qc.invalidateQueries({ queryKey: ['menu-items'] });
      onClose();
    } finally { setDeleting(false); }
  };

  const TABS: { key: PanelTab; label: string; icon: React.ElementType }[] = [
    { key: 'details',   label: 'Details',   icon: Edit2 },
    { key: 'modifiers', label: 'Modifiers', icon: Tag },
    { key: 'recipe',    label: 'Recipe',    icon: Package },
  ];

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* Panel */}
      <div className="w-full max-w-xl bg-surface shadow-2xl flex flex-col h-full animate-slide-up overflow-hidden"
        style={{ borderRadius: '2rem 0 0 2rem' }}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-surface-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-xl text-primary">
              {item ? 'Edit Item' : 'New Menu Item'}
            </h3>
            <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-full transition-colors">
              <X className="w-5 h-5 text-surface-400" />
            </button>
          </div>
          {/* Tab bar */}
          <div className="flex gap-1 bg-surface-100 rounded-2xl p-1">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold transition-all',
                  tab === key ? 'bg-surface shadow-sm text-primary' : 'text-muted hover:text-surface-700'
                )}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {tab === 'details' && (
            <>
              {/* Image */}
              <label htmlFor="item-img" className="block cursor-pointer">
                <div className={cn(
                  'w-full h-40 rounded-2xl border-2 border-dashed overflow-hidden transition-all flex items-center justify-center relative group',
                  imagePreview ? 'border-transparent' : 'border-default hover:border-brand-400 bg-surface-50'
                )}>
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Upload className="w-8 h-8 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="text-center">
                      <Upload className="w-8 h-8 text-surface-300 mx-auto mb-2" />
                      <p className="text-sm text-surface-400">Click to upload photo</p>
                    </div>
                  )}
                </div>
                <input id="item-img" type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
              </label>

              {/* Name */}
              <div>
                <label className="label">Item name *</label>
                <input className="input" value={form.name}
                  onChange={e => upd('name', e.target.value)} placeholder="e.g. Tibs Firfir" />
              </div>

              {/* Description */}
              <div>
                <label className="label">Description</label>
                <textarea className="input min-h-[80px] resize-none" value={form.description}
                  onChange={e => upd('description', e.target.value)} placeholder="Brief description for customers" />
              </div>

              {/* Price + Prep time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Price (ETB) *</label>
                  <input type="number" step="0.5" className="input" value={form.price}
                    onChange={e => upd('price', e.target.value)} />
                </div>
                <div>
                  <label className="label flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Prep time (min)
                  </label>
                  <input type="number" className="input" value={form.preparation_time_minutes}
                    onChange={e => upd('preparation_time_minutes', e.target.value)} />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="label">Category</label>
                <select className="select" value={form.category_id}
                  onChange={e => upd('category_id', e.target.value)}>
                  <option value="">No category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="label flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Tags</label>
                <div className="flex flex-wrap gap-2">
                  {TAGS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleTag(key)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all',
                        form.tags.includes(key)
                          ? 'bg-brand-500 border-brand-500 text-white'
                          : 'bg-surface-50 border-default text-surface-600 hover:border-brand-300'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Availability toggle */}
              <div>
                <label className="label">Availability</label>
                <button
                  type="button"
                  onClick={() => upd('is_available', !form.is_available)}
                  className={cn(
                    'w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all',
                    form.is_available
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-surface-50 border-default text-surface-600'
                  )}
                >
                  <span className="font-semibold text-sm">
                    {form.is_available ? '✓ Available for ordering' : '✗ Currently 86\'d (unavailable)'}
                  </span>
                  {form.is_available
                    ? <ToggleRight className="w-6 h-6 text-emerald-600" />
                    : <ToggleLeft className="w-6 h-6 text-surface-400" />
                  }
                </button>
              </div>
            </>
          )}

          {tab === 'modifiers' && (
            <ModifierEditor modifiers={modifiers} onChange={setModifiers} />
          )}

          {tab === 'recipe' && item && (
            <RecipePanel item={item} invItems={invItems} />
          )}
          {tab === 'recipe' && !item && (
            <div className="text-center py-10 text-surface-400">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-semibold">Save the item first, then link ingredients.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-100 flex items-center gap-3 flex-shrink-0">
          {item && (
            <button onClick={del} disabled={deleting}
              className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors font-semibold mr-auto">
              <Trash2 className="w-4 h-4" /> {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving || !form.name.trim() || form.price === ''} className="btn-primary gap-2 min-w-[100px]">
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Saving…' : item ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Category Modal ───────────────────────────────────────────────────────────

function CategoryModal({ cat, onClose }: { cat?: MenuCategory; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(cat?.name ?? '');
  const [visible, setVisible] = useState(cat?.is_visible ?? true);
  const [sortOrder, setSortOrder] = useState(cat?.sort_order ?? 0);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      if (cat) {
        await menuApi.updateCategory(cat.id, { name, is_visible: visible, sort_order: Number(sortOrder) });
      } else {
        await menuApi.createCategory({ name, sort_order: Number(sortOrder) });
      }
      qc.invalidateQueries({ queryKey: ['menu-categories'] });
      qc.invalidateQueries({ queryKey: ['menu-items'] });
    } finally { setLoading(false); onClose(); }
  };

  const remove = async () => {
    if (!cat || !confirm(`Delete category "${cat.name}"? Items will become uncategorized.`)) return;
    await menuApi.deleteCategory(cat.id);
    qc.invalidateQueries({ queryKey: ['menu-categories'] });
    qc.invalidateQueries({ queryKey: ['menu-items'] });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-surface rounded-[2rem] w-full max-w-xs shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-primary">{cat ? 'Edit Category' : 'New Category'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-full"><X className="w-4 h-4" /></button>
        </div>
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Starters" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Sort order</label>
            <input type="number" className="input" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Visible</label>
            <button onClick={() => setVisible(!visible)}
              className={cn('w-full flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-sm font-bold transition-all',
                visible ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-surface-50 border-default text-muted')}>
              {visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {visible ? 'Yes' : 'Hidden'}
            </button>
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          {cat && <button onClick={remove} className="text-sm text-red-500 font-semibold hover:underline mr-auto">Delete</button>}
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={loading || !name} className="btn-primary">
            {loading ? '…' : cat ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CSV Import Dialog ────────────────────────────────────────────────────────

function ImportDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => setRows(parseCsv(ev.target?.result as string));
    reader.readAsText(f);
  };

  const doImport = async () => {
    setImporting(true);
    try {
      const r = await menuApi.importCsv(rows) as any;
      setResult(r);
      qc.invalidateQueries({ queryKey: ['menu-items'] });
      qc.invalidateQueries({ queryKey: ['menu-categories'] });
    } catch { globalToast.info('Import failed'); }
    finally { setImporting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface rounded-[2rem] w-full max-w-md shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-primary flex items-center gap-2"><FileUp className="w-5 h-5 text-brand-500" />Import CSV</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-full"><X className="w-4 h-4" /></button>
        </div>

        <div className="bg-surface-50 rounded-2xl p-4 text-xs text-surface-600 font-mono">
          Required columns: <strong>name, price</strong><br />
          Optional: description, category, prep_time_minutes, is_available, tags (pipe-separated)
        </div>

        {!result ? (
          <>
            <label className="flex flex-col items-center gap-3 border-2 border-dashed border-default rounded-2xl p-8 cursor-pointer hover:border-brand-400 transition-colors">
              <Upload className="w-8 h-8 text-surface-300" />
              <span className="text-sm text-muted">{rows.length > 0 ? `${rows.length} rows ready` : 'Choose CSV file'}</span>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </label>
            {rows.length > 0 && (
              <div className="max-h-40 overflow-y-auto border border-default rounded-xl text-xs">
                <table className="w-full">
                  <thead><tr className="bg-surface-50">{Object.keys(rows[0]).map(h => <th key={h} className="text-left px-2 py-1.5 font-semibold">{h}</th>)}</tr></thead>
                  <tbody>{rows.slice(0, 5).map((r, i) => <tr key={i} className="border-t border-surface-100">{Object.values(r).map((v, j) => <td key={j} className="px-2 py-1 truncate max-w-[100px]">{v}</td>)}</tr>)}</tbody>
                </table>
                {rows.length > 5 && <p className="text-center text-surface-400 py-1">…{rows.length - 5} more rows</p>}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button onClick={doImport} disabled={importing || rows.length === 0} className="btn-primary flex-1">
                {importing ? 'Importing…' : `Import ${rows.length} rows`}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <p className="font-bold text-primary">Imported {result.imported} items!</p>
            {result.errors.length > 0 && (
              <div className="text-left bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-800">
                {result.errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
            <button onClick={onClose} className="btn-primary w-full">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Menu Page ───────────────────────────────────────────────────────────

export default function MenuPage() {
  const qc = useQueryClient();
  const [selectedCat, setSelectedCat]   = useState('all');
  const [search, setSearch]             = useState('');
  const [panelItem, setPanelItem]       = useState<MenuItem | null | undefined>(undefined); // undefined = closed, null = new
  const [catModal, setCatModal]         = useState<{ open: boolean; cat?: MenuCategory }>({ open: false });
  const [showImport, setShowImport]     = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['menu-categories'],
    queryFn: () => menuApi.getCategories() as Promise<MenuCategory[]>,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: () => menuApi.getItems() as Promise<MenuItem[]>,
    refetchInterval: 30_000,
  });

  const { data: invItems = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryApi.list() as Promise<any[]>,
  });

  const toggleAvail = useMutation({
    mutationFn: (item: MenuItem) => menuApi.updateItem(item.id, { is_available: !item.is_available }),
    onMutate: async (item) => {
      await qc.cancelQueries({ queryKey: ['menu-items'] });
      qc.setQueryData(['menu-items'], (old: MenuItem[] | undefined) =>
        old?.map(i => i.id === item.id ? { ...i, is_available: !i.is_available } : i)
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['menu-items'] }),
  });

  const handleExport = () => {
    const url = menuApi.exportCsv();
    const a = document.createElement('a');
    a.href = url; a.download = 'menu.csv'; a.click();
  };

  const filtered = items.filter(item => {
    const matchesCat = selectedCat === 'all' || item.category_id === selectedCat;
    const matchesSearch = !search.trim() || item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.description ?? '').toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const available   = filtered.filter(i => i.is_available).length;
  const unavailable = filtered.length - available;

  return (
    <>
      {panelItem !== undefined && (
        <ItemPanel
          item={panelItem ?? undefined}
          categories={categories}
          invItems={invItems}
          onClose={() => setPanelItem(undefined)}
          onSaved={() => setPanelItem(undefined)}
        />
      )}
      {catModal.open && <CategoryModal cat={catModal.cat} onClose={() => setCatModal({ open: false })} />}
      {showImport && <ImportDialog onClose={() => setShowImport(false)} />}
      {showMatrixModal && (
        <Modal
          open={true}
          onClose={() => setShowMatrixModal(false)}
          title="AI Menu Profitability & Engineering Matrix"
          description="Gross Margin vs Sales Volume Quadrant Classifier"
          size="xl"
        >
          <div className="pt-2">
            <MenuEngineeringMatrix />
          </div>
        </Modal>
      )}

      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="page-header bg-surface/40 p-5 rounded-[2rem] backdrop-blur-sm border border-white/60 shadow-sm">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-brand-500" /> Menu
            </h1>
            <p className="page-subtitle">
              {items.length} items · {available} available · {unavailable > 0 && <span className="text-amber-600">{unavailable} unavailable</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowMatrixModal(true)} className="btn-gold btn-sm gap-1.5 text-xs shadow-glow-gold">
              <Sparkles className="w-3.5 h-3.5" /> AI Profit Advisor
            </button>
            <button onClick={handleExport} className="btn-secondary btn-sm gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button onClick={() => setShowImport(true)} className="btn-secondary btn-sm gap-1.5 text-xs">
              <FileUp className="w-3.5 h-3.5" /> Import CSV
            </button>
            <button onClick={() => setCatModal({ open: true })} className="btn-secondary gap-2">
              <Plus className="w-4 h-4" /> Category
            </button>
            <button onClick={() => setPanelItem(null)} className="btn-primary gap-2">
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            className="input pl-10 w-full"
            placeholder="Search menu…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-surface-400" /></button>}
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button
            onClick={() => setSelectedCat('all')}
            className={cn('flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all',
              selectedCat === 'all' ? 'bg-brand-500 text-white' : 'bg-surface border border-default text-surface-600 hover:border-brand-300')}
          >
            All ({items.length})
          </button>
          {categories.map(cat => {
            const count = items.filter(i => i.category_id === cat.id).length;
            return (
              <div key={cat.id} className="flex-shrink-0 flex items-center gap-0.5">
                <button
                  onClick={() => setSelectedCat(cat.id)}
                  className={cn('flex items-center gap-1.5 px-4 py-2 rounded-l-full text-sm font-bold transition-all',
                    selectedCat === cat.id ? 'bg-brand-500 text-white' : 'bg-surface border border-default text-surface-600 hover:border-brand-300')}
                >
                  {!cat.is_visible && <EyeOff className="w-3 h-3 opacity-60" />}
                  {cat.name} ({count})
                </button>
                <button
                  onClick={() => setCatModal({ open: true, cat })}
                  className={cn('px-2 py-2 rounded-r-full text-sm border transition-all',
                    selectedCat === cat.id ? 'bg-brand-600 text-white border-brand-600' : 'bg-surface border-default text-surface-400 hover:text-surface-700')}
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-52 bg-surface-100 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-surface/60 rounded-3xl border border-surface-100">
            <BookOpen className="w-14 h-14 text-surface-200 mx-auto mb-4" />
            <p className="text-muted font-semibold">No items found</p>
            <button className="btn-primary mt-4" onClick={() => setPanelItem(null)}>Add First Item</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map(item => {
              const itemTags: string[] = (item as any).tags ?? [];
              return (
                <div
                  key={item.id}
                  onClick={() => setPanelItem(item)}
                  className={cn(
                    'group bg-surface rounded-3xl border-2 overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 hover:border-brand-300',
                    !item.is_available ? 'opacity-60 border-default' : 'border-default'
                  )}
                >
                  {/* Image */}
                  <div className="relative h-36 bg-gradient-to-br from-brand-50 to-surface-100 overflow-hidden">
                    {item.image_url ? (
                      <img src={assetUrl(item.image_url)} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl">🍽️</div>
                    )}
                    {/* Availability overlay button */}
                    <button
                      onClick={e => { e.stopPropagation(); toggleAvail.mutate(item); }}
                      className={cn(
                        'absolute top-2 right-2 p-1.5 rounded-full shadow transition-all',
                        item.is_available ? 'bg-emerald-500 text-white' : 'bg-surface-600 text-white'
                      )}
                      title={item.is_available ? 'Mark unavailable (86)' : 'Mark available'}
                    >
                      {item.is_available ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    {!item.is_available && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <span className="bg-red-500 text-white text-xs font-extrabold px-2 py-1 rounded-full tracking-wider">86'd</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className="font-bold text-primary text-sm leading-tight truncate">{item.name}</p>
                    <p className="text-xs text-surface-400 mt-0.5 truncate">{(item as any).category_name ?? 'Uncategorized'}</p>

                    {/* Tags */}
                    {itemTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {itemTags.slice(0, 2).map(tag => {
                          const t = TAGS.find(t => t.key === tag);
                          return t ? <span key={tag} className="text-[10px] bg-brand-50 text-brand-600 rounded-full px-1.5 py-0.5 font-semibold">{t.label.split(' ')[0]}</span> : null;
                        })}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <span className="font-extrabold text-brand-600 text-sm">{formatCurrency(item.price)}</span>
                      <span className="text-[10px] text-surface-400 flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />{item.preparation_time_minutes}m
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
