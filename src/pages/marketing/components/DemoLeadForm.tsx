import React, { useState } from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { publicApi } from '../../../lib/api';
import { 
  CheckCircle2, ArrowRight, ShieldCheck, Sparkles, Phone, 
  Building, User, Mail, Clock, AlertCircle, Store 
} from 'lucide-react';

interface DemoLeadFormProps {
  className?: string;
  sourcePage?: string;
  preselectedVenue?: string;
  defaultInterest?: string;
  onSuccess?: () => void;
}

export function DemoLeadForm({ 
  className = '', 
  sourcePage = 'demo_page', 
  preselectedVenue = '', 
  defaultInterest = 'Full POS + Kitchen Display (KDS)',
  onSuccess 
}: DemoLeadFormProps) {
  const { lang } = useLanguage();
  const isAm = lang === 'am';

  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState(preselectedVenue);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [branches, setBranches] = useState('1');
  const [interest, setInterest] = useState(defaultInterest);
  const [preferredContactTime, setPreferredContactTime] = useState('Morning (9:00 AM – 12:00 PM)');
  const [consent, setConsent] = useState(true);

  // Honeypot field for bot trapping
  const [website, setWebsite] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(isAm ? 'እባክዎ ትክክለኛ የስልክ ቁጥር ያስገቡ (ለምሳሌ፡ 0911 00 00 00)።' : 'Please enter a valid phone number (e.g. 0911 00 00 00).');
      return;
    }

    if (!consent) {
      setError(isAm ? 'እባክዎ የስምምነት ሳጥኑን ምልክት ያድርጉበት።' : 'Please check the consent box to proceed.');
      return;
    }

    setIsSubmitting(true);

    try {
      await publicApi.submitLead({
        name: name.trim(),
        business_name: businessName.trim(),
        phone: cleanPhone,
        email: email.trim() || undefined,
        branches,
        interest,
        preferred_contact_time: preferredContactTime,
        source_page: sourcePage,
        language: lang,
        website: website.trim() || undefined, // Honeypot
      });

      setIsSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Lead submit error:', err);
      setError(
        err?.data?.error || err?.message || (isAm ? 'ስህተት ተከስቷል፤ እባክዎ በድጋሚ ይሞክሩ።' : 'Failed to submit inquiry. Please try again.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className={`p-8 sm:p-10 rounded-3xl bg-white dark:bg-surface-900 border border-brand-200 dark:border-brand-900/60 shadow-xl text-center animate-fade-in ${className}`}>
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h3 className="font-display font-extrabold text-2xl text-surface-950 dark:text-white mb-2">
          {isAm ? 'እናመሰግናለን፤ በአንድ የስራ ቀን ውስጥ እንደውላለን።' : 'Thanks, we will call you within one business day.'}
        </h3>
        <p className="text-surface-600 dark:text-surface-400 text-sm max-w-md mx-auto mb-6 leading-relaxed">
          {isAm
            ? `የ${businessName}ን የማሳያ ጥያቄ ተቀብለናል። የቴክኒክ ቡድናችን በ ${phone} በቅርቡ ይደውላል።`
            : `We have received your demo request for ${businessName}. Our Addis Ababa deployment specialist will contact you at ${phone}.`}
        </p>

        <div className="p-4 rounded-2xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 max-w-sm mx-auto text-xs text-surface-600 dark:text-surface-300 space-y-1.5 mb-6 text-left">
          <p className="flex items-center gap-2 font-bold text-surface-900 dark:text-white">
            <Building className="w-4 h-4 text-brand-600 shrink-0" /> {businessName}
          </p>
          <p className="flex items-center gap-2">
            <User className="w-4 h-4 text-surface-400 shrink-0" /> {name}
          </p>
          <p className="flex items-center gap-2 font-mono">
            <Phone className="w-4 h-4 text-surface-400 shrink-0" /> {phone}
          </p>
          <p className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-500 shrink-0" /> {interest}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="https://t.me/kushinapos"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs transition-all shadow-md inline-flex items-center justify-center gap-2"
          >
            {isAm ? 'በቴሌግራም አሁኑኑ ያግኙን' : 'Chat on Telegram Immediately'}
          </a>
          <button
            type="button"
            onClick={() => {
              setIsSubmitted(false);
              setName('');
              setBusinessName('');
              setPhone('');
              setEmail('');
              setBranches('1');
              setInterest(defaultInterest);
              setPreferredContactTime('Morning (9:00 AM – 12:00 PM)');
              setConsent(true);
            }}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-200 font-bold text-xs transition-all cursor-pointer"
          >
            {isAm ? 'ሌላ ቀጠሮ መዝግብ' : 'Submit Another Request'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`p-6 sm:p-8 rounded-3xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-xl space-y-4 ${className}`}>
      <div className="border-b border-surface-100 dark:border-surface-800 pb-4 mb-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-brand-50 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 border border-brand-200/60 dark:border-brand-800/60 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-brand-500" />
          <span>{isAm ? 'የነጻ ማሳያ ቀጠሮ' : 'Book a 1-on-1 Product Demo'}</span>
        </div>
        <h3 className="font-display font-extrabold text-xl sm:text-2xl text-surface-950 dark:text-white">
          {isAm ? 'ሬስቶራንትዎን በአካል ወይም በስልክ እንመልከት' : 'See KushinaPOS in action for your venue'}
        </h3>
        <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
          {isAm ? 'ምንም አይነት ክፍያ ወይም አስገዳጅ ውል የለም። በቦታው መጥተን እናሳያለን።' : 'No credit card required. Free on-site consultation across Addis Ababa.'}
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Honeypot field (hidden from view) */}
      <div style={{ display: 'none', position: 'absolute', left: '-9999px' }} aria-hidden="true">
        <label htmlFor="hp_demo_website">Do not fill this</label>
        <input
          id="hp_demo_website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {/* Row 1: Full Name & Restaurant Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-surface-700 dark:text-surface-300 mb-1.5" htmlFor="demoContactName">
            {isAm ? 'የእርስዎ ስም' : 'Your Full Name'} <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="demoContactName"
              type="text"
              required
              placeholder={isAm ? 'ለምሳሌ፡ ሰለሞን ተሾመ' : 'e.g. Dawit Haile'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-surface-700 dark:text-surface-300 mb-1.5" htmlFor="demoRestaurantName">
            {isAm ? 'የሬስቶራንት / ካፌ ስም' : 'Restaurant / Venue Name'} <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Store className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="demoRestaurantName"
              type="text"
              required
              placeholder={isAm ? 'ለምሳሌ፡ ራስ ካፌ' : 'e.g. Blue Nile Bistro'}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>
      </div>

      {/* Row 2: Phone & Optional Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-surface-700 dark:text-surface-300 mb-1.5" htmlFor="demoPhone">
            {isAm ? 'ስልክ ቁጥር' : 'Phone Number (Ethiopia)'} <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Phone className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="demoPhone"
              type="tel"
              required
              placeholder="0911 00 00 00"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-surface-700 dark:text-surface-300 mb-1.5" htmlFor="demoEmail">
            {isAm ? 'ኢሜይል (አስገዳጅ አይደለም)' : 'Email (Optional)'}
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="demoEmail"
              type="email"
              placeholder="owner@restaurant.et"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>
      </div>

      {/* Row 3: Branches & What do you need */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-surface-700 dark:text-surface-300 mb-1.5" htmlFor="demoBranches">
            {isAm ? 'የቅርንጫፎች ብዛት' : 'Number of Branches'}
          </label>
          <select
            id="demoBranches"
            value={branches}
            onChange={(e) => setBranches(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
          >
            <option value="1">{isAm ? '1 ቅርንጫፍ' : '1 Single Branch'}</option>
            <option value="2-3">{isAm ? '2 - 3 ቅርንጫፎች' : '2 – 3 Branches'}</option>
            <option value="4-10">{isAm ? '4 - 10 ቅርንጫፎች' : '4 – 10 Branches'}</option>
            <option value="10+">{isAm ? 'ከ10 በላይ ቅርንጫፎች' : '10+ Enterprise Branches'}</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-surface-700 dark:text-surface-300 mb-1.5" htmlFor="demoInterest">
            {isAm ? 'ምን አይነት አገልግሎት ይፈልጋሉ?' : 'What do you need?'}
          </label>
          <select
            id="demoInterest"
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
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
        <label className="block text-xs font-bold text-surface-700 dark:text-surface-300 mb-1.5" htmlFor="demoContactTime">
          {isAm ? 'የሚመርጡት የመገናኛ ሰዓት' : 'Preferred Contact Time'}
        </label>
        <div className="relative">
          <Clock className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            id="demoContactTime"
            value={preferredContactTime}
            onChange={(e) => setPreferredContactTime(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
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
          disabled={isSubmitting}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-brand-600 via-brand-500 to-emerald-600 hover:from-brand-700 hover:to-emerald-700 text-white font-extrabold text-sm transition-all shadow-md shadow-brand-500/25 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? (
            <span>{isAm ? 'እየተላከ ነው...' : 'Booking your demo...'}</span>
          ) : (
            <>
              <span>{isAm ? 'የነጻ ማሳያ ቀጠሮ ይያዙ' : 'Book Free 1-on-1 Demo'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      <div className="flex items-center justify-center gap-2 text-[11px] text-surface-400 pt-1 text-center">
        <ShieldCheck className="w-3.5 h-3.5 text-brand-500 shrink-0" />
        <span>{isAm ? 'የእርስዎ ስልክ እና መረጃ 100% በሚስጥር የተጠበቀ ነው።' : 'Zero spam. Direct local support from Addis Ababa.'}</span>
      </div>
    </form>
  );
}

export default DemoLeadForm;

