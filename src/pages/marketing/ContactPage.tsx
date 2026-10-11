import React, { useState } from 'react';
import { 
  MapPin, PhoneCall, Send, Mail, MessageSquare, Clock, 
  CheckCircle2, AlertCircle, ArrowRight, Sparkles 
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import MarketingLayout from './components/MarketingLayout';
import MarketingSEO from './components/MarketingSEO';

export default function ContactPage() {
  const { lang } = useLanguage();
  const isAm = lang === 'am';

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [venueName, setVenueName] = useState('');
  const [subcity, setSubcity] = useState('Bole');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !message.trim()) {
      setError(isAm ? 'እባክዎ ሙሉ ስምዎን፣ ስልክ ቁጥርዎን እና መልእክትዎን ያስገቡ።' : 'Please complete your name, phone number, and inquiry message.');
      return;
    }
    setError(null);
    setSubmitted(true);
  };

  return (
    <MarketingLayout>
      <MarketingSEO
        title={isAm ? 'አድራሻችን እና ግኑኝነት | Contact KushinaPOS Addis Ababa' : 'Contact KushinaPOS: Addis Ababa Office, Phone & Telegram'}
        description={isAm ? 'በአዲስ አበባ ቦሌ የሚገኘውን ቢሯችንን ይጎብኙ፣ በስልክ ወይም በቴሌግራም ያግኙን።' : 'Connect with the KushinaPOS team in Bole, Addis Ababa. Phone: +251 91 100 0000, Telegram: @kushinapos.'}
        canonicalUrl="/contact"
      />

      {/* Hero Header */}
      <section className="pt-12 pb-16 md:py-20 bg-gradient-to-b from-surface-100 via-white to-surface-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 border-b border-surface-200/70 dark:border-surface-800/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200/80 dark:border-brand-800/80 text-brand-700 dark:text-brand-300 text-xs font-semibold uppercase tracking-wider mb-6">
            <MapPin className="w-4 h-4 text-brand-600" />
            <span>{isAm ? 'በአዲስ አበባ እንገኛለን' : 'Headquartered in Addis Ababa'}</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-surface-900 dark:text-white max-w-4xl mx-auto mb-6">
            {isAm ? 'ያነጋግሩን፤ በቦታው ድረስ መጥተን እናግዛችኋለን' : 'We are here to support your dining room'}
          </h1>

          <p className="text-base sm:text-xl text-surface-600 dark:text-surface-300 max-w-2xl mx-auto leading-relaxed">
            {isAm
              ? 'ስለ ሲስተሙ ማብራሪያ፣ የእቃዎች ዋጋ ወይም የነጻ ማሳያ ቀጠሮ ለመያዝ በማንኛውም ጊዜ ያነጋግሩን።'
              : 'Reach out by phone, Telegram, WhatsApp, or drop by our engineering office in Bole.'}
          </p>
        </div>
      </section>

      {/* Contact Information & Form */}
      <section className="py-16 md:py-24 bg-white dark:bg-surface-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* Left: Contact Details */}
            <div className="lg:col-span-5 space-y-8">
              <div>
                <h2 className="font-display text-2xl font-bold text-surface-900 dark:text-white mb-4">
                  {isAm ? 'የቀጥታ መገናኛ መስመሮቻችን' : 'Direct Channels'}
                </h2>
                <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed mb-6">
                  {isAm
                    ? 'የቴክኒክ ባለሙያዎቻችን በሳምንት 7 ቀናት ጥሪዎችንና መልእክቶችን በፍጥነት ይመልሳሉ።'
                    : 'Our local deployment desk responds rapidly during standard Ethiopian business hours and peak meal rushes.'}
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-surface-50 dark:bg-surface-850/60 border border-surface-200 dark:border-surface-800 flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-surface-400">
                      {isAm ? 'የቢሮ አድራሻ' : 'Office Location'}
                    </div>
                    <div className="text-sm font-bold text-surface-900 dark:text-white mt-0.5">
                      {isAm ? 'ቦሌ ክፍለ ከተማ፣ መድኃኔዓለም አደባባይ አጠገብ' : 'Bole Sub-City, Near Edna Mall / Medhanialem'}
                    </div>
                    <div className="text-xs text-surface-500 mt-0.5">Addis Ababa, Ethiopia</div>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-surface-50 dark:bg-surface-850/60 border border-surface-200 dark:border-surface-800 flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 shrink-0">
                    <PhoneCall className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-surface-400">
                      {isAm ? 'የስልክ ጥሪ' : 'Phone Direct'}
                    </div>
                    <a href="tel:+251911000000" className="text-sm font-bold text-brand-600 dark:text-brand-400 hover:underline mt-0.5 block">
                      +251 91 100 0000
                    </a>
                    <div className="text-xs text-surface-500 mt-0.5">Mon–Sun, 8:00 AM – 10:00 PM EAT</div>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-surface-50 dark:bg-surface-850/60 border border-surface-200 dark:border-surface-800 flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 shrink-0">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-surface-400">
                      Telegram Channel
                    </div>
                    <a href="https://t.me/kushinapos" target="_blank" rel="noreferrer" className="text-sm font-bold text-brand-600 dark:text-brand-400 hover:underline mt-0.5 block">
                      @kushinapos
                    </a>
                    <div className="text-xs text-surface-500 mt-0.5">{isAm ? 'ፈጣን የቴክኒክ ምላሽ' : 'Instant live support & updates'}</div>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-surface-50 dark:bg-surface-850/60 border border-surface-200 dark:border-surface-800 flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-surface-400">
                      Email
                    </div>
                    <a href="mailto:contact@kushinapos.com" className="text-sm font-bold text-surface-900 dark:text-white hover:underline mt-0.5 block">
                      contact@kushinapos.com
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Message Form */}
            <div className="lg:col-span-7 bg-surface-50 dark:bg-surface-850/60 p-8 sm:p-10 rounded-3xl border border-surface-200 dark:border-surface-800 shadow-xs">
              <h3 className="font-display text-2xl font-bold text-surface-900 dark:text-white mb-2">
                {isAm ? 'መልእክትዎን ይላኩልን' : 'Send us a message'}
              </h3>
              <p className="text-sm text-surface-600 dark:text-surface-400 mb-8">
                {isAm 
                  ? 'ጥያቄዎን ወይም አስተያየትዎን ያስቀምጡ፤ የቡድናችን አባል በ2 ሰዓት ውስጥ በስልክ ይደውልልዎታል።'
                  : 'Tell us about your restaurant or cafe. We will respond within 2 hours.'}
              </p>

              {submitted ? (
                <div className="p-8 rounded-2xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-brand-600 text-white flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h4 className="text-xl font-bold text-surface-900 dark:text-white">
                    {isAm ? 'መልእክትዎ ደርሶናል!' : 'Message Received!'}
                  </h4>
                  <p className="text-sm text-surface-600 dark:text-surface-300 max-w-md mx-auto leading-relaxed">
                    {isAm
                      ? `እናመሰግናለን ${fullName}። የቴክኒክ አማካሪያችን በስልክ ቁጥርዎ (${phone}) በቅርቡ ይደውላል።`
                      : `Thank you, ${fullName}. A KushinaPOS advisor will call you at ${phone} promptly.`}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300 mb-2">
                        {isAm ? 'ሙሉ ስም *' : 'Your Full Name *'}
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={isAm ? 'ለምሳሌ፡ ሰለሞን ተሾመ' : 'e.g. Solomon Teshome'}
                        required
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300 mb-2">
                        {isAm ? 'ስልክ ቁጥር *' : 'Phone Number *'}
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0911 00 00 00"
                        required
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300 mb-2">
                        {isAm ? 'የሬስቶራንት / ካፌ ስም' : 'Venue Name'}
                      </label>
                      <input
                        type="text"
                        value={venueName}
                        onChange={(e) => setVenueName(e.target.value)}
                        placeholder={isAm ? 'ለምሳሌ፡ ራስ ካፌ' : 'e.g. Ras Cafe'}
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300 mb-2">
                        {isAm ? 'ክፍለ ከተማ (አዲስ አበባ)' : 'Sub-City (Addis Ababa)'}
                      </label>
                      <select
                        value={subcity}
                        onChange={(e) => setSubcity(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="Bole">Bole (ቦሌ)</option>
                        <option value="Kirkos">Kirkos / Kazanchis (ቂርቆስ / ካዛንቺስ)</option>
                        <option value="Arada">Arada / Piassa (አራዳ / ፒያሳ)</option>
                        <option value="Yeka">Yeka / CMC (የካ / ሲኤምሲ)</option>
                        <option value="Nifas Silk">Nifas Silk / Sarbet (ንፋስ ስልክ / ሳርቤት)</option>
                        <option value="Kolfe">Kolfe (ኮልፌ)</option>
                        <option value="Lideta">Lideta (ልደታ)</option>
                        <option value="Other">Other / Regional City (ሌላ)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300 mb-2">
                      {isAm ? 'መልእክትዎ *' : 'Your Message or Question *'}
                    </label>
                    <textarea
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={isAm ? 'እንዴት ልንረዳዎ እንችላለን?' : 'How can we help your hospitality operations?'}
                      required
                      className="w-full px-4 py-3 rounded-xl bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-md shadow-brand-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{isAm ? 'መልእክቱን ላክ' : 'Send Message'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>

          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
