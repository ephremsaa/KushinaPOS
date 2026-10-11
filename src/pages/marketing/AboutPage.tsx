import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, Heart, ShieldCheck, MapPin, Sparkles, 
  ArrowRight, Users, Coffee, UtensilsCrossed, CheckCircle2 
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import MarketingLayout from './components/MarketingLayout';
import MarketingSEO from './components/MarketingSEO';

export default function AboutPage() {
  const { lang } = useLanguage();
  const isAm = lang === 'am';

  const values = [
    {
      title: 'Built in Addis Ababa for Ethiopia',
      titleAm: 'በአዲስ አበባ የተሰራ ለአገራችን',
      desc: 'We build directly for the daily reality of Ethiopian hospitality—intermittent power, Ethio Telecom drops, Amharic receipts, and Telebirr money flows.',
      descAm: 'የኢትዮጵያ ሬስቶራንቶችን እውነተኛ የስራ ሁኔታ (የመብራትና ኢንተርኔት መቆራረጥ፣ የአማርኛ ደረሰኝ እና የቴሌብር ክፍያ) ከግምት ውስጥ ያስገባ።',
      icon: <MapPin className="w-6 h-6 text-brand-600" />,
    },
    {
      title: 'Zero Foreign Currency Barriers',
      titleAm: 'ከዶላር ወይም የውጭ ምንዛሬ ጭንቀት ነጻ',
      desc: 'Why should an Ethiopian restaurant need scarce US Dollars to run a till? All our plans are transparently priced and settled in Ethiopian Birr (ETB).',
      descAm: 'የኢትዮጵያ ሬስቶራንት ለካሸር ሶፍትዌር የውጭ ምንዛሬ ማደን የለበትም። ሁሉም ክፍያችን በኢትዮጵያ ብር ብቻ ነው።',
      icon: <ShieldCheck className="w-6 h-6 text-brand-600" />,
    },
    {
      title: 'No Fake Promises or Manufactured Metrics',
      titleAm: 'ከውሸት እና ከተፈበረኩ ቁጥሮች የጸዳ',
      desc: 'We only showcase restaurants that genuinely use our platform like Kerod Restaurant. Honest software built on technical excellence.',
      descAm: 'እውነተኛ የቴክኖሎጂ ጥራት እና ታማኝነት። የውሸት ምስክርነቶችን ወይም የተፈበረኩ ቁጥሮችን በፍጹም አናሳትምም።',
      icon: <Heart className="w-6 h-6 text-brand-600" />,
    },
  ];

  return (
    <MarketingLayout>
      <MarketingSEO
        title={isAm ? 'ስለ ኩሽና ፖስ፡ ታሪካችን እና አላማችን | About KushinaPOS' : 'About KushinaPOS: Transforming Ethiopian Hospitality Technology'}
        description={isAm ? 'ኩሽና ፖስ በአዲስ አበባ ለኢትዮጵያ ሬስቶራንቶች፣ ካፌዎችና ሆቴሎች የተሰራ አስተማማኝ አገር በቀል የቴክኖሎጂ ሲስተም ነው።' : 'KushinaPOS is built from the ground up in Addis Ababa, Ethiopia to deliver world-class hospitality technology without foreign currency barriers.'}
        canonicalUrl="/about"
      />

      {/* Hero Header */}
      <section className="pt-12 pb-16 md:py-20 bg-gradient-to-b from-surface-100 via-white to-surface-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 border-b border-surface-200/70 dark:border-surface-800/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200/80 dark:border-brand-800/80 text-brand-700 dark:text-brand-300 text-xs font-semibold uppercase tracking-wider mb-6">
            <Building2 className="w-4 h-4 text-brand-600" />
            <span>{isAm ? 'የኩባንያችን ታሪክ' : 'Our Mission in Ethiopia'}</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-surface-900 dark:text-white max-w-4xl mx-auto mb-6">
            {isAm 
              ? 'የኢትዮጵያን የመስተንግዶ ዘርፍ በዘመናዊ አገር በቀል ቴክኖሎጂ ማብቃት' 
              : 'Empowering Ethiopian hospitality with world-class local technology'}
          </h1>

          <p className="text-base sm:text-xl text-surface-600 dark:text-surface-300 max-w-3xl mx-auto leading-relaxed mb-8">
            {isAm
              ? 'ኩሽና ፖስ የተመሰረተው የኢትዮጵያ ሬስቶራንቶችና ካፌዎች ውድ የውጭ ምንዛሬ ሳያስፈልጋቸው የአለም ደረጃ አገልግሎት እንዲሰጡ ለማስቻል ነው።'
              : 'Born out of the frustration of watching Addis Ababa restaurants struggle with overpriced foreign software that fails during internet cuts and rejects Amharic characters.'}
          </p>
        </div>
      </section>

      {/* Origin Story */}
      <section className="py-16 md:py-24 bg-white dark:bg-surface-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-base sm:text-lg text-surface-700 dark:text-surface-300 leading-relaxed">
          <h2 className="font-display text-2xl sm:text-4xl font-bold text-surface-900 dark:text-white">
            {isAm ? 'ኩሽና ፖስ ለምን ተጀመረ?' : 'Why We Built KushinaPOS'}
          </h2>

          <p>
            {isAm
              ? 'በአዲስ አበባ ውስጥ በሚገኙ በርካታ ሬስቶራንቶችና ካፌዎች ስንጎበኝ አንድ የሚያሳዝን እውነታ ተመለከትን፡ አስተናጋጆች በወረቀት ላይ የተጻፈ ትዕዛዝ ይዘው ወደ ወጥ ቤት ይጮሃሉ፤ ወረቀቶች በዘይትና በሙቀት ተበላሽተው ይጠፋሉ፤ በምሳ ሰዓት ደግሞ ደንበኞች በካሸር ጠረጴዛ ላይ ለክፍያ ረጅም ወረፋ ይጠብቃሉ።'
              : 'Visiting restaurants across Bole, Kazanchis, and Sarbet, we observed the same heartbreaking scene: hurried waiters screaming handwritten tickets through greasy kitchen windows, tickets getting smeared with butter and lost, and long queues forming as cashiers struggled with manual bill splitting and fake payment screenshots.'}
          </p>

          <p>
            {isAm
              ? 'ብዙ የሬስቶራንት ባለቤቶች የውጭ አገር ሶፍትዌሮችን ለመግዛት ሞክረዋል—ነገር ግን በየወሩ ከፍተኛ ዶላር ይጠይቃሉ፣ የአማርኛ ፊደላትን አያትቱም፣ ኢንተርኔት ሲቋረጥ ስራ ያቆማሉ፣ የቴሌብር ክፍያን ደግሞ አያውቁም።'
              : 'Overseas software companies demanded scarce US dollars every month, broke down the moment Ethio Telecom connectivity dipped, couldn’t render Ge’ez (Fidel) characters on thermal paper, and had zero comprehension of Telebirr or CBE Birr workflows.'}
          </p>

          <p className="font-semibold text-surface-900 dark:text-white border-l-4 border-brand-500 pl-4 py-1">
            {isAm
              ? 'ስለዚህ ኩሽና ፖስን ከስሩ ገንብተን አዘጋጀን፡ ሙሉ በሙሉ በአማርኛ የሚሰራ፣ ያለ ኢንተርኔት ያለማቋረጥ የሚሸጥ፣ ቴሌብርን የሚቀበል እና በኢትዮጵያ ብር ብቻ የሚከፈልበት።'
              : 'So we built KushinaPOS right here in Addis Ababa: native offline resilience, full Amharic Fidel support, instant Telebirr QR flows, and 100% ETB transparent pricing.'}
          </p>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-16 md:py-24 bg-surface-50 dark:bg-surface-950 border-t border-surface-200 dark:border-surface-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-surface-900 dark:text-white mb-4">
              {isAm ? 'የምንመራባቸው መሰረታዊ እሴቶች' : 'Principles That Guide Every Feature'}
            </h2>
            <p className="text-surface-600 dark:text-surface-400 text-sm sm:text-base">
              {isAm ? 'ለደንበኞቻችን ያለን ጽኑ ቃል ኪዳን' : 'Commitments to our restaurant and cafe partners across Ethiopia.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {values.map((val, idx) => (
              <div
                key={idx}
                className="p-8 rounded-3xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-xs"
              >
                <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/80 flex items-center justify-center mb-6">
                  {val.icon}
                </div>
                <h3 className="font-display text-lg font-bold text-surface-900 dark:text-white mb-3">
                  {isAm ? val.titleAm : val.title}
                </h3>
                <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                  {isAm ? val.descAm : val.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Addis Ababa Team CTA */}
      <section className="py-16 bg-white dark:bg-surface-900 border-t border-surface-200 dark:border-surface-800 text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white mb-4">
            {isAm ? 'ቢሯችን መጥተው ወይም በስልክ ያግኙን' : 'Visit Our Engineering Lab in Addis Ababa'}
          </h2>
          <p className="text-surface-600 dark:text-surface-400 text-sm sm:text-base mb-8">
            {isAm 
              ? 'ቡና እየጠጣን ስለ ሬስቶራንትዎ እናወራ። የካሸር ታብሌቶችንና ፕሪንተሮችን በህያው እንፈትሽ።'
              : 'Join us for Ethiopian coffee and test our dual-screen POS, kitchen monitors, and thermal printers firsthand.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/contact"
              className="px-8 py-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-md transition-all"
            >
              {isAm ? 'አድራሻችንን ይመልከቱ' : 'Contact & Directions'}
            </Link>
            <Link
              to="/demo"
              className="px-8 py-4 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-white font-bold text-sm hover:bg-surface-200 dark:hover:bg-surface-700 transition-all"
            >
              {isAm ? 'ነጻ ማሳያ ይመዝገቡ' : 'Request On-Site Demo'}
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
