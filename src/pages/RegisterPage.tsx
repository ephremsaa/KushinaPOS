import React, { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChefHat, ArrowRight, ArrowLeft, Upload, Loader2,
  Sparkles, CheckCircle2, ShieldCheck, Store, MapPin,
  Lock, Mail, Phone, FileText, Check
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    city: 'Addis Ababa',
    cuisine_type: 'Ethiopian Traditional',
    tax_id: '',
    address: '',
  });

  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(form);

      if (docFile) {
        const fd = new FormData();
        fd.append('document', docFile);
        try {
          await api.upload('/restaurants/me/document', fd);
        } catch {
          // Non-fatal
        }
      }

      navigate('/pending');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans selection:bg-orange-500 selection:text-white">
      {/* Background Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-orange-500/20 rounded-full blur-[140px] animate-pulse-soft" />
        <div className="absolute -bottom-40 -left-40 w-[30rem] h-[30rem] bg-amber-500/15 rounded-full blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.8) 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        />
      </div>

      <div className="w-full max-w-xl relative z-10">
        
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-4 group">
            <div className="w-12 h-12 bg-gradient-to-tr from-brand-600 to-amber-400 rounded-2xl flex items-center justify-center shadow-glow-sm group-hover:scale-105 transition-transform">
              <ChefHat className="w-7 h-7 text-white" />
            </div>
            <span className="font-display font-extrabold text-2xl text-white tracking-tight">
              kushina<span className="text-brand-500">POS</span>
            </span>
          </Link>

          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
            Register Your Restaurant
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Start your 14-day free trial · Telebirr & CBE Ready
          </p>

          {/* Stepper Progress */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <div className="flex items-center gap-2">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step >= 1 ? 'bg-brand-500 text-white shadow-glow-sm' : 'bg-slate-800 text-slate-400'
              }`}>
                {step > 1 ? <Check className="w-3.5 h-3.5" /> : '1'}
              </span>
              <span className={`text-xs font-semibold ${step >= 1 ? 'text-white' : 'text-slate-500'}`}>
                Basic Info
              </span>
            </div>
            <div className={`w-12 h-0.5 rounded-full ${step >= 2 ? 'bg-brand-500' : 'bg-slate-800'}`} />
            <div className="flex items-center gap-2">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step >= 2 ? 'bg-brand-500 text-white shadow-glow-sm' : 'bg-slate-800 text-slate-400'
              }`}>
                2
              </span>
              <span className={`text-xs font-semibold ${step >= 2 ? 'text-white' : 'text-slate-500'}`}>
                Location & Tax
              </span>
            </div>
          </div>
        </div>

        {/* Card Container */}
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 shadow-2xl">
          
          {error && (
            <div className="p-4 mb-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs sm:text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={step === 1 ? (e) => { e.preventDefault(); setStep(2); } : handleSubmit}>
            
            {/* STEP 1: Basic Information */}
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Restaurant Name *
                  </label>
                  <div className="relative">
                    <Store className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                      value={form.name}
                      onChange={e => upd('name', e.target.value)}
                      placeholder="e.g. Habesha Gourmet & Lounge"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                        value={form.email}
                        onChange={e => upd('email', e.target.value)}
                        placeholder="owner@restaurant.et"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                        value={form.phone}
                        onChange={e => upd('phone', e.target.value)}
                        placeholder="+251 91 123 4567"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Password * (Min 8 Characters)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                      value={form.password}
                      onChange={e => upd('password', e.target.value)}
                      placeholder="••••••••••••"
                      required
                      minLength={8}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      City / Region
                    </label>
                    <input
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                      value={form.city}
                      onChange={e => upd('city', e.target.value)}
                      placeholder="Addis Ababa"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      Cuisine Type
                    </label>
                    <input
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                      value={form.cuisine_type}
                      onChange={e => upd('cuisine_type', e.target.value)}
                      placeholder="Ethiopian Traditional / Grill / Cafe"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-4 bg-gradient-to-r from-brand-500 via-orange-500 to-amber-500 hover:from-brand-600 hover:to-amber-600 text-white font-bold text-sm py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-glow-sm hover:shadow-glow transition-all"
                >
                  <span>Continue to Step 2</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* STEP 2: Location & Verification */}
            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Restaurant Physical Address
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                      value={form.address}
                      onChange={e => upd('address', e.target.value)}
                      placeholder="e.g. Bole Road, Behind Edna Mall, Addis Ababa"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Tax ID / TIN Number (Optional)
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                      value={form.tax_id}
                      onChange={e => upd('tax_id', e.target.value)}
                      placeholder="e.g. 0012345678"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Business License / Registration (Optional)
                  </label>
                  <label
                    htmlFor="doc-upload"
                    className="flex items-center gap-3 border-2 border-dashed border-slate-800 hover:border-brand-500/50 rounded-2xl p-4 cursor-pointer bg-slate-950/50 hover:bg-slate-950 transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400 flex-shrink-0">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {docFile ? docFile.name : 'Upload Document or Photo'}
                      </p>
                      <p className="text-xs text-slate-500">PDF, JPG, PNG · Speeds up account approval</p>
                    </div>
                  </label>
                  <input
                    id="doc-upload"
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={e => setDocFile(e.target.files?.[0] ?? null)}
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-brand-500 via-orange-500 to-amber-500 hover:from-brand-600 hover:to-amber-600 text-white font-bold text-sm py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-glow-sm hover:shadow-glow disabled:opacity-50 transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Registration</span>
                        <CheckCircle2 className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

              </div>
            )}

          </form>

          {/* Footer inside card */}
          <div className="mt-6 pt-6 border-t border-slate-800/80 text-center text-xs text-slate-400">
            Already have an active restaurant?{' '}
            <Link to="/login" className="text-brand-400 font-bold hover:underline">
              Sign in to POS
            </Link>
          </div>

        </div>

      </div>
    </div>
  );
}
