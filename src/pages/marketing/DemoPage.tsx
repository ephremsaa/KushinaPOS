import React from 'react';
import { 
  Sparkles, CheckCircle2, ShieldCheck, MapPin, 
  Clock, ArrowRight, Laptop, Monitor, Printer 
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import MarketingLayout from './components/MarketingLayout';
import MarketingSEO from './components/MarketingSEO';
import DemoLeadForm from './components/DemoLeadForm';

export default function DemoPage() {
  const { lang } = useLanguage();
  const isAm = lang === 'am';

  const demoSteps = [
    {
      step: '01',
      title: 'We come to your venue in Addis Ababa',
      titleAm: 'በአዲስ አበባ ውስጥ ባሉበት ቦታ እንመጣለን',
      desc: 'Our deployment engineer brings an actual touch tablet, 80mm thermal receipt printer, and test kitchen display directly to your dining room.',
      descAm: 'የቴክኒክ ባለሙያችን እውነተኛ የንክኪ ታብሌት፣ ፕሪንተር እና የወጥ ቤት ስክሪን ይዞ ወደ ሬስቶራንትዎ ይመጣል።',
    },
    {
      step: '02',
      title: 'Simulate your peak rush in 20 minutes',
      titleAm: 'በ20 ደቂቃ ውስጥ የሬስቶራንትዎን ስራ እንሞክራለን',
      desc: 'We enter your actual menu dishes (tibs, wat, drinks), send orders to the kitchen screen, split bills across Telebirr and cash, and print sample receipts.',
      descAm: 'የእርስዎን እውነተኛ የምግብ ዝርዝር አስገብተን ትዕዛዝ ወደ ወጥ ቤት እንልካለን፤ የቴሌብር እና ጥሬ ገንዘብ ክፍያን እንፈትሻለን።',
    },
    {
      step: '03',
      title: 'Let your cashiers & waiters test it',
      titleAm: 'ካሸሮች እና አስተናጋጆች በራሳቸው እጅ ይሞክሩታል',
      desc: 'Your staff test the Amharic touch interface themselves. You will see how effortless it is for them to ring up orders without confusion.',
      descAm: 'ሰራተኞችዎ የአማርኛውን የንክኪ ገጽታ በራሳቸው እጅ ሞክረው ምን ያህል ቀላል እንደሆነ ያረጋግጣሉ።',
    },
    {
      step: '04',
      title: 'Zero cost, zero obligation',
      titleAm: 'ምንም አይነት ክፍያ ወይም ግዴታ የለም',
      desc: 'If you decide not to proceed, we pack up our test kit. You pay nothing. No hidden consultation fees or pressure.',
      descAm: 'ካልተመቸዎት እቃችንን ይዘን እንሄዳለን፤ ምንም አይነት ሳንቲም አይከፍሉም ወይም ግዴታ ውስጥ አይገቡም።',
    },
  ];

  return (
    <MarketingLayout>
      <MarketingSEO
        title={isAm ? 'ነጻ የሬስቶራንት ሲስተም ማሳያ ቀጠሮ | Book Free Demo' : 'Book a Free On-Site POS Demo in Addis Ababa | KushinaPOS'}
        description={isAm ? 'አዲስ አበባ ውስጥ ባሉበት ቦታ መጥተን ታብሌቱንና ፕሪንተሩን በነጻ እናሳያችኋለን። ምንም ክፍያ የለውም።' : 'Experience KushinaPOS live at your restaurant or cafe. We bring test tablets and thermal printers directly to your venue in Addis Ababa. 100% free with zero obligation.'}
        canonicalUrl="/demo"
      />

      {/* Hero Header */}
      <section className="pt-12 pb-16 md:py-20 bg-gradient-to-b from-surface-100 via-white to-surface-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 border-b border-surface-200/70 dark:border-surface-800/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200/80 dark:border-brand-800/80 text-brand-700 dark:text-brand-300 text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles className="w-4 h-4 text-brand-600" />
            <span>{isAm ? 'ነጻ በቦታው የሚደረግ ማሳያ' : '100% Free On-Site Walkthrough'}</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-surface-900 dark:text-white max-w-4xl mx-auto mb-6">
            {isAm 
              ? 'ኩሽና ፖስ በሬስቶራንትዎ ውስጥ እንዴት እንደሚሰራ በነጻ ይመልከቱ' 
              : 'See KushinaPOS in action right inside your restaurant'}
          </h1>

          <p className="text-base sm:text-xl text-surface-600 dark:text-surface-300 max-w-3xl mx-auto leading-relaxed">
            {isAm
              ? 'ታብሌት እና ፕሪንተር ይዘን ወደ ሬስቶራንትዎ እንመጣለን። ሰራተኞችዎ ሲስተሙን በራሳቸው እጅ እንዲሞክሩት ያድርጉ።'
              : 'No generic zoom slides. We bring production hardware to your dining floor in Addis Ababa so your staff can feel the speed.'}
          </p>
        </div>
      </section>

      {/* Main Form & Walkthrough Layout */}
      <section className="py-16 md:py-24 bg-white dark:bg-surface-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            
            {/* Left: 4 Steps */}
            <div className="lg:col-span-7 space-y-8">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 block mb-2">
                  {isAm ? 'የማሳያው ሂደት' : 'How It Works'}
                </span>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white">
                  {isAm ? 'በቀጠሮው ወቅት ምን ይከናወናል?' : 'What happens during your walkthrough'}
                </h2>
              </div>

              <div className="space-y-6">
                {demoSteps.map((step, idx) => (
                  <div key={idx} className="p-6 rounded-2xl bg-surface-50 dark:bg-surface-850/60 border border-surface-200 dark:border-surface-800 flex items-start gap-5">
                    <span className="text-2xl font-display font-extrabold text-brand-600 dark:text-brand-400 shrink-0">
                      {step.step}
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-surface-900 dark:text-white mb-1.5">
                        {isAm ? step.titleAm : step.title}
                      </h3>
                      <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                        {isAm ? step.descAm : step.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-5 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 flex items-center gap-3 text-sm text-surface-800 dark:text-surface-200">
                <ShieldCheck className="w-6 h-6 text-brand-600 shrink-0" />
                <span>
                  {isAm 
                    ? 'አዲስ አበባ ውስጥ ለሚገኙ ማንኛውም ሬስቶራንቶች፣ ካፌዎች፣ ባሮችና ሆቴሎች አገልግሎቱ ክፍት ነው።'
                    : 'Available across all sub-cities in Addis Ababa: Bole, Kazanchis, Piassa, Sarbet, CMC, Lebu, and Summit.'}
                </span>
              </div>
            </div>

            {/* Right: Lead Capture Form Box */}
            <div className="lg:col-span-5 bg-surface-50 dark:bg-surface-850/60 p-8 sm:p-10 rounded-3xl border border-surface-200 dark:border-surface-800 shadow-xl sticky top-28">
              <h3 className="font-display text-2xl font-bold text-surface-900 dark:text-white mb-2">
                {isAm ? 'የነጻ ማሳያ ቀጠሮ ይያዙ' : 'Schedule Your Demo'}
              </h3>
              <p className="text-xs sm:text-sm text-surface-600 dark:text-surface-400 mb-6">
                {isAm
                  ? 'መረጃዎን ይሙሉ፤ በ2 ሰዓት ውስጥ ለቀጠሮ ማረጋገጫ እንደውላለን።'
                  : 'Fill in your venue details and we will call within 2 hours to confirm your preferred day and time.'}
              </p>
              <DemoLeadForm />
            </div>

          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
