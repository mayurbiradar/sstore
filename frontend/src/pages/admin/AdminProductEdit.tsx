import { useEffect, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Trash2, Star, Package, Image as ImageIcon,
  Hash, ToggleLeft, ToggleRight, Layers, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import * as productApi from '../../api/productApi';
import type { Product } from '../../api/productApi';
import { API_BASE_URL } from '../../constants';
import { checkAdminAndProceed } from '../../utils/authUtils';

/** Convert paise (backend) → rupees (UI input). */
const toRupees = (paise: number | null | undefined) =>
  paise == null ? '' : (paise / 100).toString();

/** Convert rupees (UI input) → paise (backend). NaN/empty → null. */
const fromRupees = (rupees: string): number | null => {
  if (rupees === '' || rupees == null) return null;
  const n = Number(rupees);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

/** Build the absolute image URL the way Collection/Home/ProductDetail do. */
const imageSrc = (rel: string) =>
  rel && rel.startsWith('/images/') ? `${API_BASE_URL}${rel}` : rel;

/**
 * Local mutable shape. Differs from {@link Product} in that every
 * editable field is nullable so the form can clear values mid-edit,
 * and the editable fields are explicit (no images array, no
 * timestamps). The save handler projects this into
 * {@link productApi.UpdateProductPayload} which is what hits the backend.
 */
interface DraftProduct {
  id: string;
  /** Read-only identifier — shown to admin for reference. */
  sku: string;
  /** Read-only identifier — URL slug. */
  slug: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  image: string;
  stock: number;
  taxable: boolean;
  active: boolean;
  featured: boolean;
}

export default function AdminProductEdit() {
  const navigate = useNavigate();
  const { productId } = useParams<{ productId: string }>();
  const [draft, setDraft] = useState<DraftProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    checkAdminAndProceed(
      () => {
        if (!productId) {
          navigate('/admin');
          return;
        }
        setLoading(true);
        const token = localStorage.getItem('accessToken') || '';
        productApi.getProduct(productId, token)
          .then((p: Product) => {
            setDraft({
              id: p.id,
              sku: p.sku ?? '',
              slug: p.slug ?? '',
              name: p.name ?? '',
              description: p.description ?? '',
              price: p.price ?? 0,
              currency: p.currency ?? 'INR',
              image: p.image ?? '',
              stock: p.stock ?? 0,
              taxable: p.taxable ?? true,
              active: p.active ?? true,
              featured: p.featured ?? false,
            });
            setLoading(false);
          })
          .catch(() => {
            toast.error('Could not load product');
            navigate('/admin');
          });
      },
      (path: string) => navigate(path),
    );
  }, [productId, navigate]);

  const update = <K extends keyof DraftProduct>(key: K, value: DraftProduct[K]) =>
    setDraft(d => d ? { ...d, [key]: value } : d);

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const payload: productApi.UpdateProductPayload = {
        name: draft.name,
        description: draft.description,
        price: draft.price,
        stock: draft.stock,
        taxable: draft.taxable,
        active: draft.active,
        featured: draft.featured,
      };
      const token = localStorage.getItem('accessToken') || '';
      await productApi.updateProduct(draft.id, payload, token);
      toast.success('Product saved');
      // Refresh draft so updatedAt / version reflect server state.
      const fresh = await productApi.getProduct(draft.id, token);
      setDraft(d => d ? {
        ...d,
        id: fresh.id,
        name: fresh.name ?? d.name,
        description: fresh.description ?? d.description,
        price: fresh.price ?? d.price,
        currency: fresh.currency ?? d.currency,
        image: fresh.image ?? d.image,
        stock: fresh.stock ?? d.stock,
        taxable: fresh.taxable ?? d.taxable,
        active: fresh.active ?? d.active,
        featured: fresh.featured ?? d.featured,
      } : d);
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft?.id) return;
    if (!confirm(`Soft-delete "${draft.name}"? It will be hidden from the storefront but order history still references it.`)) {
      return;
    }
    const token = localStorage.getItem('accessToken') || '';
    try {
      await productApi.deleteProduct(draft.id, token);
      toast.success('Product deleted');
      navigate('/admin');
    } catch {
      toast.error('Delete failed');
    }
  };

  if (loading || !draft) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-rose-600" />
      </div>
    );
  }

  const onNumber = (key: 'stock') =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value === '' ? 0 : Number(e.target.value);
      update(key, Number.isFinite(v) ? v : 0);
    };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-rose-50 hover:text-rose-600">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-600">Edit product</p>
              <h1 className="text-2xl font-black text-slate-950">{draft.name || 'Untitled product'}</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleDelete} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50">
              <Trash2 className="h-4 w-4" /> Delete
            </button>
            <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-slate-400">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Draft / inactive banner */}
        {!draft.active && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div>
              <strong className="font-bold">Inactive product.</strong> Set a price, description, and at least one
              unit of stock, then switch <strong>Active</strong> on to make it visible in the storefront.
            </div>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Main column */}
          <div className="space-y-5 lg:col-span-2">
            {/* Basics */}
            <Section icon={<Package className="h-4 w-4" />} title="Basics">
              <Field label="Name *">
                <input
                  type="text"
                  value={draft.name ?? ''}
                  onChange={e => update('name', e.target.value)}
                  className={inputCls}
                  placeholder="e.g. Gold-plated ring"
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={draft.description ?? ''}
                  onChange={e => update('description', e.target.value)}
                  rows={6}
                  className={inputCls}
                  placeholder="Full description with bullet points, materials, sizing…"
                />
              </Field>
            </Section>

            {/* Pricing */}
            <Section icon={<Hash className="h-4 w-4" />} title="Pricing">
              <Field label="Price (₹) *" hint="Stored as paise; enter in rupees.">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={toRupees(draft.price)}
                  onChange={e => {
                    const v = fromRupees(e.target.value);
                    if (v != null) update('price', v);
                  }}
                  className={inputCls}
                />
              </Field>
              <Field label="Taxable">
                <BoolToggle
                  value={draft.taxable ?? true}
                  onChange={v => update('taxable', v)}
                />
              </Field>
            </Section>

            {/* Inventory */}
            <Section icon={<Layers className="h-4 w-4" />} title="Inventory">
              <Field label="Stock *" hint="Units available for purchase.">
                <input type="number" min={0} value={draft.stock ?? 0} onChange={onNumber('stock')} className={inputCls} />
              </Field>
            </Section>
          </div>

          {/* Side column */}
          <div className="space-y-5">
            {/* Primary image */}
            <Section icon={<ImageIcon className="h-4 w-4" />} title="Primary image">
              {draft.image ? (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <img src={imageSrc(draft.image)} alt={draft.name} className="h-48 w-full object-cover" />
                </div>
              ) : (
                <div className="flex h-48 w-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                  No image
                </div>
              )}
              <p className="mt-2 text-xs text-slate-500">
                Re-upload to replace this image. (For multi-image upload, use the dashboard's "Add Product" flow.)
              </p>
            </Section>

            {/* Lifecycle */}
            <Section icon={<Star className="h-4 w-4" />} title="Lifecycle">
              <Field label="Active (visible in storefront)">
                <BoolToggle value={draft.active ?? true} onChange={v => update('active', v)} />
              </Field>
              <Field label="Featured (showcase)">
                <BoolToggle value={draft.featured ?? false} onChange={v => update('featured', v)} />
              </Field>
            </Section>

            <Section title="Identifiers">
              <Field label="SKU"><code className="block rounded bg-slate-100 px-3 py-2 text-xs">{draft.sku ?? '—'}</code></Field>
              <Field label="Slug"><code className="block rounded bg-slate-100 px-3 py-2 text-xs">{draft.slug ?? '—'}</code></Field>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100';

function Section({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
        {icon}
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function BoolToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition ${
        value
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-slate-50 text-slate-500'
      }`}
    >
      {value ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
      {value ? 'On' : 'Off'}
    </button>
  );
}