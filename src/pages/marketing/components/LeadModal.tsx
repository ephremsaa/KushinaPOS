import React, { useState, useEffect, useRef } from 'react';
import { 
  X, CheckCircle2, ShieldCheck, Sparkles, Phone, Building, 
  User, Mail, Store, Clock, ArrowRight, AlertCircle, HelpCircle 
} from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useLeadModal } from '../context/LeadModalContext';
import { publicApi } from '../../../lib/api';

export function LeadModal() {
  const { lang } = useLanguage();
  const isAm = lang === 'am';
  const { isOpen, closeLeadModal, options } = useLeadModal();

  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [branches, setBranches] = useState('1');
  const [interest, setInterest] = useState('Full POS + Kitchen Display (KDS)');
  const [preferredContactTime, setPreferredContactTime] = useState('Morning (9:00 AM – 12:00 PM)');
  const [consent, setConsent] = useState(true);

  // Honeypot fields to trap spambots
  const [website, setWebsite] = useState('');

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  // Sync initial options when modal opens
  useEffect(() => {
    if (isOpen) {
      if (options.interest) setInterest(options.interest);
      if (options.defaultBusiness) setBusinessName(options.defaultBusiness);
      if (options.defaultName) setName(options.defaultName);
      setSubmitted(false);
      setError(null);
      setLoading(false);
    }
  }, [isOpen, options]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeLeadModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeLeadModal]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(isAm ? 'እባክዎ ሙሉ ስምዎን ያስገቡ።' : 'Please enter your full name.');
      return;
    }
    if (!businessName.trim()) {
      setError(isAm ? 'እባክዎ የሬስቶራንትዎን ወይም የካፌዎን ስም ያስገቡ።' : 'Please enter your restaurant/business name.');
      return;
    }
    const cleanPhone = phone.trim().replace(/[\s-]/g, '');
    if (!cleanPhone || cleanPhone.length < 9) {
      setError(isAm ? 'እባክዎ ትክክለኛ ስልክ ቁጥር ያስገቡ (ለምሳሌ፡ 0911 00 00 00)።' : 'Please enter a valid phone number (e.g. 0911 00 00 00).');
      return;
    }
    if (!consent) {
      setError(isAm ? 'እባክዎ የስምምነት ሳጥኑን ምልክት ያድርጉበት።' : 'Please check the consent box to proceed.');
      return;
    }

    setLoading(true);

    try {
      await publicApi.submitLead({
        name: name.trim(),
        business_name: businessName.trim(),
        phone: cleanPhone,
        email: email.trim() || undefined,
        branches,
        interest,
        preferred_contact_time: preferredContactTime,
        source_page: options.sourcePage || window.location.pathname,
        language: lang,
        website: website.trim() || undefined, // Honeypot
      });

      setSubmitted(true);
    } catch (err: any) {
      console.error('Lead submit error:', err);
      setError(
        err?.data?.error || err?.message || (isAm ? 'መልእክቱን መላክ አልተቻለም። እባክዎ በቀጥታ በስልክ ይደውሉልን።' : 'Could not submit inquiry. Please call us directly.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-surface-950/70 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-modal-title"
    >
      {/* Backdrop click area */}
      <div 
        className="fixed inset-0" 
        onClick={closeLeadModal} 
        aria-hidden="true" 
      />

      {/* Modal Card */}
      <div 
        ref={modalRef}
        className="relative z-10 w-full max-w-xl bg-white dark:bg-surface-900 rounded-3xl shadow-2xl border border-surface-200 dark:border-surface-800 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 sm:p-8 bg-gradient-to-r from-brand-50 via-surface-50 to-white dark:from-brand-950/40 dark:via-surface-900 dark:to-surface-900 border-b border-surface-200/80 dark:border-surface-800">
          <button
            type="button"
            onClick={closeLeadModal}
            className="absolute top-5 right-5 p-2 rounded-xl text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-200/50 dark:hover:bg-surface-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            <span>{isAm ? 'ነጻ ማሳያ / ዋጋ ይጠይቁ' : 'Book a Demo • Get a Quote'}</span>
          </div>

          <h2 id="lead-modal-title" className="font-display text-xl sm:text-2xl font-extrabold text-surface-900 dark:text-white">
            {isAm ? 'የሬስቶራንትዎን የቴክኖሎጂ ፍላጎት ያሳውቁን' : 'Experience KushinaPOS in Your Restaurant'}
          </h2>
          <p className="text-xs sm:text-sm text-surface-600 dark:text-surface-400 mt-1">
            {isAm
              ? 'መረጃዎን ይሙሉ፤ በአዲስ አበባ ውስጥ ባሉበት ቦታ መጥተን ታብሌቱንና ፕሪንተሩን በነጻ እናሳያችኋለን።'
              : 'Our specialists will bring demo tablets and printers directly to your venue in Addis Ababa.'}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8">
          {submitted ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="font-display text-2xl font-bold text-surface-900 dark:text-white">
                {isAm ? 'እናመሰግናለን፤ በአንድ የስራ ቀን ውስጥ እንደውላለን።' : 'Thanks, we will call you within one business day.'}
              </h3>
              <p className="text-sm text-surface-600 dark:text-surface-400 max-w-md mx-auto leading-relaxed">
                {isAm
                  ? `የ${businessName}ን ጥያቄ ተቀብለናል። የቴክኒክ ባለሙያችን በስልክ ቁጥርዎ (${phone}) ይደውላል።`
                  : `We have received your demo inquiry for ${businessName}. A dedicated advisor will reach out to ${phone} promptly.`}
              </p>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={closeLeadModal}
                  className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
                >
                  {isAm ? 'ዝጋ' : 'Close'}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs sm:text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Honeypot field (hidden from view) */}
              <div style={{ display: 'none', position: 'absolute', left: '-9999px' }} aria-hidden="true">
                <label htmlFor="hp_website">Do not fill this</label>
                <input
                  id="hp_website"
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              {/* Row 1: Name & Restaurant Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300 mb-1.5">
                    {isAm ? 'ሙሉ ስም *' : 'Your Full Name *'}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={isAm ? 'ለምሳሌ፡ ሰለሞን ተሾመ' : 'e.g. Dawit Haile'}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300 mb-1.5">
                    {isAm ? 'የሬስቶራንት / ካፌ ስም *' : 'Restaurant / Venue Name *'}
                  </label>
                  <div className="relative">
                    <Store className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder={isAm ? 'ለምሳሌ፡ ራስ ካፌ' : 'e.g. Blue Nile Lounge'}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300 mb-1.5">
                    {isAm ? 'ስልክ ቁጥር *' : 'Phone Number (Ethiopia) *'}
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0911 00 00 00"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300 mb-1.5">
                    {isAm ? 'ኢሜይል (አስገዳጅ አይደለም)' : 'Email (Optional)'}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="owner@restaurant.et"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Branches & "What do you need" (Interest) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300 mb-1.5">
                    {isAm ? 'የቅርንጫፎች ብዛት' : 'Number of Branches'}
                  </label>
                  <select
                    value={branches}
                    onChange={(e) => setBranches(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="1">{isAm ? '1 ቅርንጫፍ' : '1 Single Branch'}</option>
                    <option value="2-3">{isAm ? '2 - 3 ቅርንጫፎች' : '2 – 3 Branches'}</option>
                    <option value="4-10">{isAm ? '4 - 10 ቅርንጫፎች' : '4 – 10 Branches'}</option>
                    <option value="10+">{isAm ? 'ከ10 በላይ ቅርንጫፎች' : '10+ Enterprise Branches'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300 mb-1.5">
                    {isAm ? 'ምን አይነት አገልግሎት ይፈልጋሉ?' : 'What do you need?'}
                  </label>
                  <select
                    value={interest}
                    onChange={(e) => setInterest(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="Full POS + Kitchen Display (KDS)">Full POS + Kitchen Display (KDS)</option>
                    <option value="Single Counter POS (Cafe / Bakery)">Single Counter POS (Cafe / Bakery)</option>
                    <option value="Hardware Bundle (Tablet + Printer + Drawer)">Hardware Bundle (Tablet + Printer + Drawer)</option>
                    <option value="Multi-Branch HQ Management">Multi-Branch HQ Management</option>
                    <option value="Table QR Menu & Online Ordering">Table QR Menu & Online Ordering</option>
                    <option value="Other / Custom Hospitality Consultation">Other / Custom Hospitality Consultation</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Preferred Contact Time */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300 mb-1.5">
                  {isAm ? 'የሚመርጡት የመገናኛ ሰዓት' : 'Preferred Contact Time'}
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={preferredContactTime}
                    onChange={(e) => setPreferredContactTime(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="Morning (9:00 AM – 12:00 PM)">{isAm ? 'ጠዋት (ከ3:00 - 6:00 ሰዓት)' : 'Morning (9:00 AM – 12:00 PM)'}</option>
                    <option value="Afternoon (2:00 PM – 5:00 PM)">{isAm ? 'ከሰአት (ከ8:00 - 11:00 ሰዓት)' : 'Afternoon (2:00 PM – 5:00 PM)'}</option>
                    <option value="Evening (6:00 PM – 8:00 PM)">{isAm ? 'ምሽት (ከ12:00 - 2:00 ሰዓት)' : 'Evening (6:00 PM – 8:00 PM)'}</option>
                    <option value="Anytime">{isAm ? 'በማንኛውም የስራ ሰዓት' : 'Anytime during business hours'}</option>
                  </select>
                </div>
              </div>

              {/* Consent Checkbox */}
              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-surface-600 dark:text-surface-400 select-none">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 rounded border-surface-300 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                  />
                  <span>
                    {isAm
                      ? 'የኩሽና ፖስ ቡድን ስለ ሲስተሙ ማብራሪያና ዋጋ በስልክ እንዲያነጋግረኝ እስማማለሁ።'
                      : 'I agree to be contacted by the KushinaPOS team regarding POS setup, demo walk-through, and pricing.'}
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-brand-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{isAm ? 'ቀጠሮውን ይላኩ' : 'Submit Demo Request'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 text-[11px] text-surface-500 pt-1 text-center">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                <span>{isAm ? 'ምንም አይነት ክፍያ ወይም ግዴታ የለበትም። 100% ነጻ ማሳያ።' : '100% free with zero obligation. Local Addis Ababa field service.'}</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default LeadModal;
