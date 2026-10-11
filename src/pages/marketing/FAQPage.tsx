import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  HelpCircle, ChevronDown, ChevronUp, Search, PhoneCall, 
  Send, ArrowRight, Sparkles, ShieldCheck 
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import MarketingLayout from './components/MarketingLayout';
import MarketingSEO from './components/MarketingSEO';

interface FaqCategory {
  category: string;
  categoryAm: string;
  questions: { q: string; qAm: string; a: string; aAm: string }[];
}

export default function FAQPage() {
  const { lang } = useLanguage();
  const isAm = lang === 'am';
  const [searchTerm, setSearchTerm] = useState('');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({ '0-0': true });

  const toggleItem = (key: string) => {
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const categories: FaqCategory[] = [
    {
      category: 'Offline Reliability & Connectivity',
      categoryAm: 'ያለ ኢንተርኔት የመስራት አቅም',
      questions: [
        {
          q: 'Does KushinaPOS work when Ethio Telecom internet cuts out?',
          qAm: 'የኢትዮ ቴሌኮም ኢንተርኔት ሲቋረጥ ኩሽና ፖስ ይሰራል?',
          a: 'Yes, 100%. KushinaPOS has a built-in offline engine. Cashiers continue taking orders, printing receipts to local thermal printers, and opening cash drawers without internet. Once connectivity returns, all transactions silently sync to the cloud.',
          aAm: 'አዎ፤ 100% ይሰራል! ኩሽና ፖስ በውስጡ የራሱ መረጃ ቋት አለው። ኢንተርኔት በሌለበት ጊዜም ካሸሮች መሸጥ፣ ደረሰኝ ማተም እና ካሽ ቦክስ መክፈት ይችላሉ። ኔትወርክ ሲመለስ መረጃው በራሱ ወደ ክላውድ ይተላለፋል።',
        },
        {
          q: 'What happens during a power blackout?',
          qAm: 'መብራት በሚጠፋበት ጊዜ ምን ይደረጋል?',
          a: 'Because KushinaPOS runs on battery-powered Android tablets or iPads, the screen stays on. Paired with a mini-UPS for your receipt printer and WiFi router, your till operations remain uninterrupted.',
          aAm: 'ኩሽና ፖስ በባትሪ በሚሰሩ ታብሌቶች ወይም ስልኮች ላይ ስለሚሰራ ስክሪኑ እንደበራ ይቆያል። ለፕሪንተሩ እና ለራውተሩ አነስተኛ ዩፒኤስ (UPS) በመጠቀም ያለ ምንም መስተጓጎል ስራዎን ይቀጥላሉ።',
        },
      ],
    },
    {
      category: 'Hardware & Printers',
      categoryAm: 'የካሸር እቃዎች እና ፕሪንተሮች',
      questions: [
        {
          q: 'Do I have to purchase hardware from you, or can I use my own?',
          qAm: 'የካሸር እቃዎችን ከእናንተ መግዛት ግዴታ ነው፤ ወይስ የራሴን መጠቀም እችላለሁ?',
          a: 'You can use your own hardware! KushinaPOS works on standard Android tablets (Android 9.0+), Windows PCs, iPads, and standard 80mm or 58mm ESC/POS thermal printers. If you need new hardware, we sell pre-tested bundles with a 1-year replacement warranty.',
          aAm: 'የራስዎትን እቃዎች መጠቀም ይችላሉ! ኩሽና ፖስ በማንኛውም መደበኛ የአንድሮይድ ታብሌት፣ ዊንዶውስ ኮምፒውተር፣ አይፓድ እና 80ሚሊ ወይም 58ሚሊ የደረሰኝ ፕሪንተሮች ላይ ይሰራል። አዲስ እቃ ከፈለጉ ደግሞ ከ1 አመት ዋስትና ጋር እናቀርባለን።',
        },
        {
          q: 'Does the receipt printer print in Amharic (Fidel)?',
          qAm: 'የደረሰኝ ፕሪንተሩ በአማርኛ ፊደላት ያትማል?',
          a: 'Yes. KushinaPOS features custom bitmap Ge’ez character rendering that prints sharp, crisp Fidel on any standard thermal paper printer without illegible question marks or garbled characters.',
          aAm: 'አዎ! ኩሽና ፖስ ማንኛውንም የአማርኛ ጽሁፍ በግልጽና በጥራት የሚያትም አሰራር ስላለው በደረሰኙ ላይ ግልጽ የአማርኛ ፊደላት ይወጣሉ።',
        },
      ],
    },
    {
      category: 'Payments & Anti-Fraud',
      categoryAm: 'ክፍያዎች እና የደህንነት ቁጥጥር',
      questions: [
        {
          q: 'How does KushinaPOS prevent fake Telebirr screenshot scams?',
          qAm: 'ኩሽና ፖስ የውሸት የቴሌብር ደረሰኝ ማጭበርበርን እንዴት ያስቀራል?',
          a: 'Our system enforces unique transaction reference verification. When a customer pays, the cashier or waiter records the unique reference ID. The system locks out any duplicate reference, preventing old screenshots from being reused.',
          aAm: 'ሲስተሙ እያንዳንዱን የማረጋገጫ ቁጥር (Reference ID) ይመዘግባል። ተመሳሳይ ቁጥር ለሁለተኛ ጊዜ እንዳይገባ ስለሚከለክል ደንበኞች የድሮ የክፍያ ፎቶ እያሳዩ እንዳያጭበረብሩ ሙሉ በሙሉ ይከላከላል።',
        },
        {
          q: 'Can customers split a bill between Cash and Telebirr?',
          qAm: 'ደንበኞች ሂሳብ በጥሬ ገንዘብ እና በቴሌብር ከፋፍለው መክፈል ይችላሉ?',
          a: 'Yes, with one tap! You can split any order across cash, Telebirr, CBE Birr, and bank transfer. The receipt shows the itemized split breakdown clearly.',
          aAm: 'አዎ፤ በአንድ ንክኪ ብቻ! ማንኛውንም ሂሳብ በጥሬ ገንዘብ፣ በቴሌብር እና በሲቢኢ ብር ከፋፍሎ ማጠናቀቅ ይቻላል፤ ደረሰኙም ላይ በግልጽ ተለይቶ ይወጣል።',
        },
      ],
    },
    {
      category: 'Pricing, Contracts & Support',
      categoryAm: 'ዋጋ፣ ውል እና የቴክኒክ ድጋፍ',
      questions: [
        {
          q: 'Are there any foreign currency (USD) fees or hidden charges?',
          qAm: 'የዶላር ክፍያ ወይም ድብቅ ተጨማሪ ወጪ አለ?',
          a: 'Zero foreign currency hurdles. All our subscriptions are priced and billed in Ethiopian Birr (ETB). Starter is 499 ETB/mo, Growth is 999 ETB/mo, and Pro is 1,999 ETB/mo. If you pay annually, you get 2 months free.',
          aAm: 'ምንም አይነት የዶላር ክፍያ የለም! ሁሉም ዋጋችን በኢትዮጵያ ብር ብቻ ነው። ጀማሪ 499 ብር/በወር፣ እድገት 999 ብር/በወር እና ፕሮ 1,999 ብር/በወር ነው። የአመቱን ከከፈሉ የ2 ወር ነጻ አገልግሎት ያገኛሉ።',
        },
        {
          q: 'How fast can our restaurant get up and running?',
          qAm: 'ስራ ለመጀመር ስንት ቀን ይወስዳል?',
          a: 'Most venues are fully live within 24 to 48 hours. Our team inputs your food menu, configures your printers, trains your staff in Amharic, and stands by your side during your first live meal rush.',
          aAm: 'በ24 እስከ 48 ሰዓታት ውስጥ ሙሉ በሙሉ ስራ መጀመር ይችላሉ። ምግቦችን አስገብተን፣ እቃዎችን ገጥመን እና ሰራተኞችን አሰልጥነን በመጀመሪያው ቀን ከጎንዎ ቆመን እናግዛለን።',
        },
      ],
    },
  ];

  return (
    <MarketingLayout>
      <MarketingSEO
        title={isAm ? 'ተደጋግመው የሚጠየቁ ጥያቄዎች እና መልሶቻቸው | KushinaPOS FAQ' : 'Frequently Asked Questions: Hardware, Payments, Offline | KushinaPOS'}
        description={isAm ? 'ስለ ኩሽና ፖስ አሰራር፣ እቃዎች፣ የቴሌብር ክፍያ እና ዋጋ ተደጋግመው የሚጠየቁ ጥያቄዎች እና ግልጽ መልሶቻቸው።' : 'Clear answers to all your questions regarding offline reliability, Android tablet hardware, Telebirr integration, Amharic receipts, and ETB pricing.'}
        canonicalUrl="/faq"
      />

      {/* Hero Header */}
      <section className="pt-12 pb-16 md:py-20 bg-gradient-to-b from-surface-100 via-white to-surface-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 border-b border-surface-200/70 dark:border-surface-800/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200/80 dark:border-brand-800/80 text-brand-700 dark:text-brand-300 text-xs font-semibold uppercase tracking-wider mb-6">
            <HelpCircle className="w-4 h-4 text-brand-600" />
            <span>{isAm ? 'የእውቀት ማዕከል' : 'Frequently Asked Questions'}</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-surface-900 dark:text-white max-w-4xl mx-auto mb-6">
            {isAm 
              ? 'ስለ ኩሽና ፖስ ማወቅ የሚፈልጉት ነገር ሁሉ' 
              : 'Everything you need to know about KushinaPOS'}
          </h1>

          <p className="text-base sm:text-xl text-surface-600 dark:text-surface-300 max-w-2xl mx-auto leading-relaxed mb-8">
            {isAm
              ? 'ግልጽ እና እውነተኛ መልሶች ለእያንዳንዱ የሬስቶራንት ባለቤት ጥያቄ።'
              : 'Transparent answers to practical questions on offline mode, hardware, payments, and setup.'}
          </p>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto relative">
            <Search className="w-5 h-5 text-surface-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isAm ? 'ጥያቄዎን እዚህ ይፈልጉ...' : 'Search questions, hardware, Telebirr...'}
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            />
          </div>
        </div>
      </section>

      {/* Categorized FAQs */}
      <section className="py-16 md:py-24 bg-white dark:bg-surface-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {categories.map((cat, catIdx) => {
            const filteredQuestions = cat.questions.filter((q) => {
              if (!searchTerm) return true;
              const term = searchTerm.toLowerCase();
              return (
                q.q.toLowerCase().includes(term) ||
                q.qAm.toLowerCase().includes(term) ||
                q.a.toLowerCase().includes(term) ||
                q.aAm.toLowerCase().includes(term)
              );
            });

            if (filteredQuestions.length === 0) return null;

            return (
              <div key={catIdx} className="space-y-4">
                <h2 className="font-display text-xl sm:text-2xl font-bold text-surface-900 dark:text-white border-b border-surface-200 dark:border-surface-800 pb-3">
                  {isAm ? cat.categoryAm : cat.category}
                </h2>

                <div className="space-y-3">
                  {filteredQuestions.map((q, qIdx) => {
                    const key = `${catIdx}-${qIdx}`;
                    const isOpen = !!openItems[key];

                    return (
                      <div
                        key={qIdx}
                        className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-850/60 overflow-hidden"
                      >
                        <button
                          onClick={() => toggleItem(key)}
                          className="w-full py-5 px-6 text-left flex items-center justify-between gap-4 font-bold text-surface-900 dark:text-white cursor-pointer hover:text-brand-600 transition-colors"
                        >
                          <span className="text-base sm:text-lg">{isAm ? q.qAm : q.q}</span>
                          <span className="p-1 rounded-lg bg-surface-200/60 dark:bg-surface-700 text-surface-600 dark:text-surface-300 shrink-0">
                            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="px-6 pb-6 pt-1 text-sm sm:text-base text-surface-600 dark:text-surface-300 leading-relaxed border-t border-surface-200/60 dark:border-surface-800/60">
                            {isAm ? q.aAm : q.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Still have questions CTA */}
      <section className="py-16 bg-surface-50 dark:bg-surface-950 border-t border-surface-200 dark:border-surface-800 text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white mb-3">
            {isAm ? 'ጥያቄዎ እዚህ አልተመለሰም?' : 'Still have questions?'}
          </h2>
          <p className="text-surface-600 dark:text-surface-400 text-sm sm:text-base mb-8">
            {isAm
              ? 'የቴክኒክ ባለሙያዎቻችን በስልክ ወይም በቴሌግራም መልስ ለመስጠት ዝግጁ ናቸው።'
              : 'Our local engineering desk is happy to answer any questions about your venue configuration.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="tel:+251911000000"
              className="px-6 py-3.5 rounded-xl bg-brand-600 text-white font-bold text-sm hover:bg-brand-700 transition-colors inline-flex items-center gap-2"
            >
              <PhoneCall className="w-4 h-4" />
              <span>+251 91 100 0000</span>
            </a>
            <a
              href="https://t.me/kushinapos"
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3.5 rounded-xl bg-surface-200 dark:bg-surface-800 text-surface-900 dark:text-white font-bold text-sm hover:bg-surface-300 dark:hover:bg-surface-700 transition-colors inline-flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>@kushinapos</span>
            </a>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
