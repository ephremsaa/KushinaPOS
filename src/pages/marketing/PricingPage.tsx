import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Check, X, ShieldCheck, ArrowRight, Sparkles, HelpCircle, 
  ChevronDown, ChevronUp, PhoneCall, RefreshCw, Layers 
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import MarketingLayout from './components/MarketingLayout';
import MarketingSEO from './components/MarketingSEO';
import { PRICING_PLANS } from './data/marketingData';
import { useLeadModal } from './context/LeadModalContext';

export default function PricingPage() {
  const { lang } = useLanguage();
  const isAm = lang === 'am';
  const { openLeadModal } = useLeadModal();
  const [isAnnual, setIsAnnual] = useState<boolean>(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const pricingFaqs = [
    {
      q: 'Are there any hidden setup or implementation fees?',
      qAm: 'ድብቅ የመመዝገቢያ ወይም የገጠማ ክፍያ አለ?',
      a: 'No hidden fees whatsoever. All pricing is clearly listed in Ethiopian Birr (ETB). We provide free remote onboarding, and our Addis Ababa team offers complimentary on-site hardware setup for Growth and Pro plans.',
      aAm: 'ምንም አይነት ድብቅ ክፍያ የለም። ሁሉም ዋጋ በግልጽ በኢትዮጵያ ብር (ETB) የተቀመጠ ነው። በተጨማሪም ለአዲስ አበባ ደንበኞች በቦታው ድረስ መጥተን ያለ ተጨማሪ ክፍያ እቃዎቹን እንገጥማለን።',
    },
    {
      q: 'How does the annual billing discount work?',
      qAm: 'የአመቱ ክፍያ ቅናሽ እንዴት ይሰላል?',
      a: 'When you choose annual billing, you pay for 10 months upfront and receive a full 12 months of service—giving you 2 months completely free.',
      aAm: 'የአመት ክፍያ ሲመርጡ የ10 ወር ክፍያ ብቻ ይከፍላሉ፤ የ12 ወር ሙሉ አገልግሎት ያገኛሉ። ይህም የ2 ወር ሙሉ ነጻ አገልግሎት ይሰጥዎታል።',
    },
    {
      q: 'Which payment methods are accepted for subscriptions?',
      qAm: 'የደንበኝነት ክፍያ በምን መክፈል ይቻላል?',
      a: 'We accept Telebirr merchant payment, CBE Birr, and direct commercial bank transfers (CBE, Awash, Bank of Abyssinia, Dashen Bank). Formal VAT withholding receipts and invoices are provided.',
      aAm: 'በቴሌብር፣ በሲቢኢ ብር እንዲሁም በቀጥታ የባንክ ዝውውር (ንግድ ባንክ፣ አዋሽ፣ ዳሽን፣ አቢሲኒያ) መክፈል ይችላሉ። ህጋዊ የቫት ደረሰኝ እንሰጣለን።',
    },
    {
      q: 'Can I upgrade or downgrade my plan at any time?',
      qAm: 'በማንኛውም ጊዜ ፕላኔን መቀየር ወይም ማሳደግ እችላለሁ?',
      a: 'Yes. You can switch plans anytime directly from your dashboard or by calling your dedicated Kushina account manager. Plan upgrades take effect immediately.',
      aAm: 'አዎ። በማንኛውም ሰዓት ከስልክዎ ወይም ደውለው በማሳወቅ ፕላንዎን ከፍ ማድረግ ወይም ዝቅ ማድረግ ይችላሉ። ወዲያውኑ በስራ ላይ ይውላል።',
    },
    {
      q: 'Do I have to buy hardware from KushinaPOS?',
      qAm: 'የካሸር እቃዎችን ከኩሽና ፖስ መግዛት ግዴታ ነው?',
      a: 'No! You are completely free to use existing Android tablets (Android 9.0+), Windows PCs, iPads, and standard ESC/POS 80mm thermal printers. If you need reliable new hardware, we provide pre-tested plug-and-play bundles with 1-year local warranty.',
      aAm: 'አይደለም! በእጅዎ ያሉትን የአንድሮይድ ታብሌቶች፣ ኮምፒውተሮች ወይም ፕሪንተሮች መጠቀም ይችላሉ። አዳዲስና ጥራት ያላቸው እቃዎች ከፈለጉ ደግሞ ከ1 አመት የአገር ውስጥ ዋስትና ጋር እናቀርባለን።',
    },
    {
      q: 'Is there a long-term lock-in contract?',
      qAm: 'አስገዳጅ የረጅም ጊዜ ውል አለ?',
      a: 'Never. Monthly plans can be paused or canceled at the end of each billing cycle with zero penalties. Your restaurant sales records and recipes remain accessible for export at all times.',
      aAm: 'በፍፁም የለም። የወር ክፍያ ሲመርጡ በፈለጉት ጊዜ ያለምንም ቅጣት ማቆም ይችላሉ። የቀደመ የሽያጭ መረጃዎም በማንኛውም ጊዜ ሳይጠፋ ይቆያል።',
    },
  ];

  const comparisonRows = [
    { 
      title: 'Staff Accounts', 
      titleAm: 'የሰራተኞች ሚስጥር ቁጥር አካውንቶች', 
      starter: 'Up to 5 Accounts', 
      growth: 'Up to 15 Accounts', 
      enterprise: '50+ / Unlimited Accounts',
      isCore: true
    },
    { 
      title: 'Branches Supported', 
      titleAm: 'የቅርንጫፎች ብዛት', 
      starter: '1 Single Branch', 
      growth: '1–2 Branches', 
      enterprise: 'Multi-Branch (HQ Dashboard)',
      isCore: true
    },
    { 
      title: 'Devices / Terminals', 
      titleAm: 'የመሳሪያዎች ብዛት (ተርሚናሎች)', 
      starter: '1 Active Counter Screen', 
      growth: 'Up to 3 Screens + KDS', 
      enterprise: 'Up to 10+ Screens (Multi-Station)',
      isCore: true
    },
    { 
      title: 'Sales & Inventory Reports', 
      titleAm: 'የሽያጭና የክምችት ሪፖርቶች', 
      starter: 'Daily Z-Reports & Till Close', 
      growth: 'Live Sales, Hourly Rush & Velocity', 
      enterprise: 'Multi-Branch P&L, Audit Logs & Custom CSV',
      isCore: true
    },
    { 
      title: 'QR Menu System', 
      titleAm: 'የደንበኛ QR ኮድ ማውጫ', 
      starter: 'View-Only Digital QR', 
      growth: 'Interactive QR + Waiter Call', 
      enterprise: 'Full Table Self-Ordering & Checkout',
      isCore: true
    },
    { 
      title: 'Online Ordering & Delivery', 
      titleAm: 'የበይነመረብ (ኦንላይን) ትዕዛዝ', 
      starter: 'Add-on module', 
      growth: 'Pickup & Takeaway Web Store', 
      enterprise: 'Multi-Channel Aggregator Dispatch (Deliver Addis / beU)',
      isCore: true
    },
    { 
      title: 'Support Level & Onboarding', 
      titleAm: 'የድጋፍ እና የአገልግሎት ደረጃ', 
      starter: 'Standard Phone & Telegram', 
      growth: 'Priority Phone + Free Addis On-Site Setup', 
      enterprise: '24/7 Dedicated Account Manager + 4h On-Site Swap',
      isCore: true
    },
    { title: 'Offline-First Sales Engine', titleAm: 'ያለ ኢንተርኔት የመስራት ችሎታ', starter: true, growth: true, enterprise: true, isCore: false },
    { title: 'Thermal Receipt Printing (80mm/58mm)', titleAm: 'የደረሰኝ ህትመት (80ሚሊ እና 58ሚሊ)', starter: true, growth: true, enterprise: true, isCore: false },
    { title: 'Telebirr, CBE Birr & Cash Register', titleAm: 'የቴሌብር እና ሲቢኢ ብር ክፍያ', starter: true, growth: true, enterprise: true, isCore: false },
    { title: 'Kitchen Display System (KDS)', titleAm: 'የወጥ ቤት ስክሪን (KDS)', starter: false, growth: true, enterprise: true, isCore: false },
    { title: 'Visual Floor Map & Table Management', titleAm: 'የጠረጴዛዎች ህያው ካርታ', starter: false, growth: true, enterprise: true, isCore: false },
    { title: 'Recipe & Ingredient Inventory', titleAm: 'የጥሬ ዕቃ እና ክምችት ቁጥጥር', starter: false, growth: true, enterprise: true, isCore: false },
    { title: 'Table Reservation Bookings', titleAm: 'የቦታ ማስያዣ ስርዓት', starter: false, growth: false, enterprise: true, isCore: false },
    { title: 'Customer CRM & Loyalty Points Ledger', titleAm: 'የደንበኞች መዝገብ እና የነጥብ ማሰባሰቢያ (Loyalty)', starter: false, growth: true, enterprise: true, isCore: false },
    { title: 'Partner REST API & Signed Webhooks', titleAm: 'የአጋር ኤፒአይ (REST API) እና ዌብሁክስ', starter: false, growth: false, enterprise: true, isCore: false },
    { title: 'Multi-Branch Consolidated HQ Dashboard', titleAm: 'የተለያዩ ቅርንጫፎች ማዕከላዊ ቁጥጥር', starter: false, growth: false, enterprise: true, isCore: false },
    { title: 'Staff Audit Logs & Manager Authorizations', titleAm: 'የስራ ታሪክ እና ጥብቅ ቁጥጥር', starter: false, growth: true, enterprise: true, isCore: false },
  ];

  return (
    <MarketingLayout>
      <MarketingSEO
        title={isAm ? 'የኩሽና ፖስ የዋጋ ዝርዝር በኢትዮጵያ ብር | KushinaPOS Pricing' : 'KushinaPOS Pricing Plans in ETB | Starter, Growth & Enterprise'}
        description={isAm ? 'ምንም አይነት ድብቅ ክፍያ የሌለበት ግልጽ የዋጋ ዝርዝር በኢትዮጵያ ብር። ጀማሪ ከ 499 ብር/በወር።' : 'Transparent hospitality POS pricing in Ethiopian Birr. Starter at 499 ETB/mo, Growth at 999 ETB/mo, Enterprise at 1,999 ETB/mo. Pay annually and save up to 3,998 ETB.'}
        canonicalUrl="/pricing"
      />

      {/* Hero Header */}
      <section className="pt-12 pb-16 md:py-20 bg-gradient-to-b from-surface-100 via-white to-surface-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 border-b border-surface-200/70 dark:border-surface-800/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200/80 dark:border-brand-800/80 text-brand-700 dark:text-brand-300 text-xs font-semibold uppercase tracking-wider mb-6">
            <ShieldCheck className="w-4 h-4 text-brand-600" />
            <span>{isAm ? 'ግልጽ እና ፍትሃዊ ዋጋ' : 'Simple, Transparent ETB Pricing'}</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-surface-900 dark:text-white max-w-3xl mx-auto mb-6">
            {isAm ? 'ለስራዎ መጠን የሚመጥን ተመጣጣኝ ዋጋ' : 'Built for Ethiopian restaurants, priced in Ethiopian Birr'}
          </h1>

          <p className="text-base sm:text-xl text-surface-600 dark:text-surface-300 max-w-2xl mx-auto leading-relaxed mb-10">
            {isAm
              ? 'ምንም አይነት የዶላር ወይም የውጭ ምንዛሬ ክፍያ የለም፤ አስገዳጅ ውል ወይም ድብቅ ወጪ የለም። በየወሩ ወይም በየአመቱ በብር ይክፈሉ።'
              : 'Zero foreign currency hurdles. No hidden fees or predatory lock-ins. Pay in ETB via Telebirr, CBE Birr, or bank transfer.'}
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="inline-flex items-center p-1.5 rounded-2xl bg-surface-200/80 dark:bg-surface-800 border border-surface-300/80 dark:border-surface-700">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                !isAnnual
                  ? 'bg-white dark:bg-surface-900 text-surface-900 dark:text-white shadow-sm'
                  : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
              }`}
            >
              {isAm ? 'ወርሃዊ ክፍያ' : 'Monthly Billing'}
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                isAnnual
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                  : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
              }`}
            >
              <span>{isAm ? 'አመታዊ ክፍያ' : 'Annual Billing'}</span>
              <span className={`text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                isAnnual ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
              }`}>
                {isAm ? 'እስከ 3,998 ብር ቅናሽ (2 ወር ነጻ)' : 'Save up to 3,998 ETB (2 Mo Free)'}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 md:py-24 bg-white dark:bg-surface-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {PRICING_PLANS.map((plan) => {
              const priceDisplay = isAnnual 
                ? Math.round(plan.priceAnnual / 12).toLocaleString() 
                : plan.priceMonthly.toLocaleString();

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all ${
                    plan.isPopular
                      ? 'bg-surface-950 text-white shadow-2xl ring-2 ring-brand-500 scale-[1.02]'
                      : 'bg-surface-50 dark:bg-surface-850/60 border border-surface-200 dark:border-surface-800 text-surface-900 dark:text-white'
                  }`}
                >
                  {plan.isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-brand-500 text-white text-xs font-bold uppercase tracking-wider shadow-md">
                      {isAm ? 'በብዛት የሚመረጥ' : 'Most Popular in Addis'}
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-2xl font-display font-bold">
                          {isAm ? plan.nameAm : plan.name}
                        </h3>
                        <p className={`text-xs mt-1 ${plan.isPopular ? 'text-surface-400' : 'text-surface-500 dark:text-surface-400'}`}>
                          {isAm ? plan.badgeAm : plan.badge}
                        </p>
                      </div>
                    </div>

                    <div className="my-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl sm:text-5xl font-display font-extrabold tracking-tight">
                          {priceDisplay}
                        </span>
                        <span className={`text-sm font-semibold ${plan.isPopular ? 'text-surface-300' : 'text-surface-500'}`}>
                          ETB {isAm ? '/ በወር' : '/ month'}
                        </span>
                      </div>
                      {isAnnual && (
                        <div className="mt-2 space-y-1.5">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                            plan.isPopular 
                              ? 'bg-brand-500/30 text-brand-200 border border-brand-400/40' 
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          }`}>
                            <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>
                              {isAm
                                ? `በአመት ${(plan.priceMonthly * 12 - plan.priceAnnual).toLocaleString()} ብር ይቆጥቡ (2 ወር ነጻ)`
                                : `Save ${(plan.priceMonthly * 12 - plan.priceAnnual).toLocaleString()} ETB / year (2 months free)`}
                            </span>
                          </div>
                          <div className={`text-[11px] ${plan.isPopular ? 'text-surface-400' : 'text-surface-500 dark:text-surface-400'}`}>
                            {isAm 
                              ? `በአጠቃላይ በአመት ${plan.priceAnnual.toLocaleString()} ብር ይከፈላል`
                              : `Billed annually at ${plan.priceAnnual.toLocaleString()} ETB`}
                          </div>
                        </div>
                      )}
                    </div>

                    <p className={`text-sm mb-6 leading-relaxed ${plan.isPopular ? 'text-surface-300' : 'text-surface-600 dark:text-surface-400'}`}>
                      {isAm ? plan.descAm : plan.desc}
                    </p>

                    <div className={`pt-6 border-t ${plan.isPopular ? 'border-surface-800' : 'border-surface-200 dark:border-surface-800'} space-y-3`}>
                      <div className="text-xs font-bold uppercase tracking-wider mb-2 opacity-70">
                        {isAm ? 'የሚካተቱ አገልግሎቶች' : 'Features included'}
                      </div>
                      {plan.features.map((feat, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm">
                          {feat.included ? (
                            <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.isPopular ? 'text-brand-400' : 'text-brand-600 dark:text-brand-400'}`} />
                          ) : (
                            <X className={`w-4 h-4 shrink-0 mt-0.5 ${plan.isPopular ? 'text-surface-600' : 'text-surface-400'}`} />
                          )}
                          <span className={feat.included ? '' : 'line-through opacity-50'}>
                            {isAm ? feat.textAm : feat.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 pt-6">
                    <button
                      type="button"
                      onClick={() => openLeadModal({ interest: `Pricing: ${plan.name} Plan`, sourcePage: 'pricing-card' })}
                      className={`w-full py-3.5 rounded-xl font-bold text-center text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        plan.isPopular
                          ? 'bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/25'
                          : 'bg-brand-600 hover:bg-brand-700 text-white'
                      }`}
                    >
                      <span>{isAm ? 'ነጻ የ14 ቀን ሙከራ ጀምር' : 'Start 14-day free trial'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <div className={`text-[11px] text-center mt-2.5 ${plan.isPopular ? 'text-surface-400' : 'text-surface-500'}`}>
                      {isAm ? 'ምንም አይነት ቅድመ ክፍያ አይጠየቅም' : 'No credit card or commitment required'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feature Comparison Matrix */}
      <section className="py-16 md:py-24 bg-surface-50 dark:bg-surface-950 border-y border-surface-200/80 dark:border-surface-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-surface-900 dark:text-white mb-3">
              {isAm ? 'የፕላኖች ሙሉ ንፅፅር ሰንጠረዥ' : 'Detailed Plan Comparison'}
            </h2>
            <p className="text-surface-600 dark:text-surface-400 text-sm sm:text-base">
              {isAm 
                ? 'የእያንዳንዱን ፕላን አገልግሎት በግልጽ ይመልከቱ እና ለስራዎ ትክክለኛውን ይምረጡ።'
                : 'Side-by-side feature matrix to help you choose the right configuration.'}
            </p>
          </div>

          <div className="overflow-x-auto bg-white dark:bg-surface-900 rounded-3xl border border-surface-200 dark:border-surface-800 shadow-xs">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-800 bg-surface-100/50 dark:bg-surface-850">
                  <th className="py-5 px-6 font-display font-bold text-surface-900 dark:text-white text-base">
                    {isAm ? 'የአገልግሎት ዝርዝር' : 'Core Capabilities'}
                  </th>
                  <th className="py-5 px-6 font-display font-bold text-surface-900 dark:text-white text-center w-1/5">
                    Starter (499 ETB)
                  </th>
                  <th className="py-5 px-6 font-display font-bold text-brand-600 dark:text-brand-400 text-center w-1/5 bg-brand-50/50 dark:bg-brand-950/30">
                    Growth (999 ETB)
                  </th>
                  <th className="py-5 px-6 font-display font-bold text-surface-900 dark:text-white text-center w-1/5">
                    Enterprise (1,999 ETB)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 dark:divide-surface-800">
                {comparisonRows.map((row, idx) => (
                  <tr 
                    key={idx} 
                    className={`transition-colors ${
                      row.isCore 
                        ? 'bg-surface-50/70 dark:bg-surface-850/80 hover:bg-surface-100/70 dark:hover:bg-surface-800/80' 
                        : 'hover:bg-surface-50/50 dark:hover:bg-surface-850/50'
                    }`}
                  >
                    <td className="py-4 px-6 font-medium text-surface-900 dark:text-surface-200">
                      <div className="flex items-center gap-2">
                        {row.isCore && (
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
                        )}
                        <span>{isAm ? row.titleAm : row.title}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center text-surface-600 dark:text-surface-400">
                      {typeof row.starter === 'boolean' ? (
                        row.starter ? (
                          <Check className="w-5 h-5 text-brand-600 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-surface-400 mx-auto opacity-40" />
                        )
                      ) : (
                        <span className="font-semibold">{row.starter}</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center text-surface-900 dark:text-white bg-brand-50/30 dark:bg-brand-950/20 font-semibold">
                      {typeof row.growth === 'boolean' ? (
                        row.growth ? (
                          <Check className="w-5 h-5 text-brand-600 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-surface-400 mx-auto opacity-40" />
                        )
                      ) : (
                        <span>{row.growth}</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center text-surface-600 dark:text-surface-400">
                      {typeof row.enterprise === 'boolean' ? (
                        row.enterprise ? (
                          <Check className="w-5 h-5 text-brand-600 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-surface-400 mx-auto opacity-40" />
                        )
                      ) : (
                        <span className="font-semibold">{row.enterprise}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing FAQs */}
      <section className="py-16 md:py-24 bg-white dark:bg-surface-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-surface-900 dark:text-white mb-3">
              {isAm ? 'ስለ ክፍያ እና ዋጋ ተደጋግመው የሚጠየቁ ጥያቄዎች' : 'Pricing & Subscription Questions'}
            </h2>
            <p className="text-surface-600 dark:text-surface-400 text-sm sm:text-base">
              {isAm ? 'ግልጽ የሆኑ መልሶች ለእያንዳንዱ ጥያቄ' : 'Honest, straightforward answers with zero fine-print surprises.'}
            </p>
          </div>

          <div className="space-y-4">
            {pricingFaqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-850/60 overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full py-5 px-6 text-left flex items-center justify-between gap-4 font-bold text-surface-900 dark:text-white cursor-pointer hover:text-brand-600 transition-colors"
                  >
                    <span className="text-base sm:text-lg">{isAm ? faq.qAm : faq.q}</span>
                    <span className="p-1 rounded-lg bg-surface-200/60 dark:bg-surface-700 text-surface-600 dark:text-surface-300 shrink-0">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 pt-1 text-sm sm:text-base text-surface-600 dark:text-surface-300 leading-relaxed border-t border-surface-200/60 dark:border-surface-800/60">
                      {isAm ? faq.aAm : faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-12 text-center p-6 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-left">
              <div className="font-bold text-surface-900 dark:text-white">
                {isAm ? 'ለየት ያለ ጥያቄ አለዎት?' : 'Have a custom inquiry or multiple branches?'}
              </div>
              <div className="text-xs sm:text-sm text-surface-600 dark:text-surface-400">
                {isAm ? 'የእኛን የቴክኒክ ባለሙያ በስልክ ወይም ቴሌግራም ያነጋግሩ ወይም ዋጋ ይጠይቁ።' : 'Call our Addis Ababa advisory desk directly or request a tailored enterprise quotation.'}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => openLeadModal({ interest: 'Enterprise Multi-Branch Custom Quote', sourcePage: 'pricing-enterprise-quote' })}
                className="px-5 py-2.5 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors whitespace-nowrap flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isAm ? 'ዋጋ ይጠይቁ' : 'Get a quote'}</span>
              </button>
              <button
                type="button"
                onClick={() => openLeadModal({ interest: 'Enterprise Callback Request', sourcePage: 'pricing-callback' })}
                className="px-5 py-2.5 rounded-xl bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-700 text-surface-800 dark:text-surface-200 font-semibold text-sm hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors whitespace-nowrap flex items-center gap-2 cursor-pointer"
              >
                <PhoneCall className="w-4 h-4" />
                <span>{isAm ? 'የስልክ ጥሪ ይጠይቁ' : 'Request a callback'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
