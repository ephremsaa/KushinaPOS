import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { 
  UtensilsCrossed, Coffee, Wine, Cake, Zap, Building2, 
  CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, ShieldCheck, 
  Monitor, Sparkles, Layers, PhoneCall 
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import MarketingLayout from './components/MarketingLayout';
import MarketingSEO from './components/MarketingSEO';
import { SOLUTIONS_DATA } from './data/marketingData';
import DemoLeadForm from './components/DemoLeadForm';
import { useLeadModal } from './context/LeadModalContext';

const ICON_MAP: Record<string, React.ReactNode> = {
  UtensilsCrossed: <UtensilsCrossed className="w-8 h-8 text-brand-600 dark:text-brand-400" />,
  Coffee: <Coffee className="w-8 h-8 text-amber-600 dark:text-amber-400" />,
  Wine: <Wine className="w-8 h-8 text-purple-600 dark:text-purple-400" />,
  Cake: <Cake className="w-8 h-8 text-pink-600 dark:text-pink-400" />,
  Zap: <Zap className="w-8 h-8 text-orange-600 dark:text-orange-400" />,
  Building2: <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />,
};

export default function SolutionDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { lang } = useLanguage();
  const isAm = lang === 'am';
  const { openLeadModal } = useLeadModal();

  if (!slug || !SOLUTIONS_DATA[slug]) {
    return <Navigate to="/" replace />;
  }

  const solution = SOLUTIONS_DATA[slug];

  return (
    <MarketingLayout>
      <MarketingSEO
        title={isAm ? `${solution.nameAm} | ኩሽና ፖስ` : `${solution.name} POS System | KushinaPOS Ethiopia`}
        description={isAm ? solution.heroSubheadlineAm : solution.heroSubheadline}
        canonicalUrl={`/solutions/${solution.slug}`}
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:py-24 bg-gradient-to-b from-surface-100 via-white to-surface-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 border-b border-surface-200/70 dark:border-surface-800/70">
        <div className="absolute inset-0 bg-[radial-gradient(#2F7D32_1px,transparent_1px)] [background-size:24px_24px] opacity-10 dark:opacity-20 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            {/* Back link */}
            <Link
              to="/#solutions"
              className="inline-flex items-center gap-2 text-sm font-medium text-surface-600 dark:text-surface-400 hover:text-brand-600 dark:hover:text-brand-400 mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{isAm ? 'ወደ መፍትሄዎች ተመለስ' : 'All Hospitality Solutions'}</span>
            </Link>

            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200/80 dark:border-brand-800/80 text-brand-700 dark:text-brand-300 text-xs font-semibold uppercase tracking-wider mb-6">
              <span className="p-1 rounded-md bg-white dark:bg-surface-800 shadow-xs">
                {ICON_MAP[solution.iconName] || <UtensilsCrossed className="w-4 h-4 text-brand-600" />}
              </span>
              <span>{isAm ? solution.badgeAm : solution.badge}</span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-surface-900 dark:text-white leading-[1.15] mb-6">
              {isAm ? solution.heroHeadlineAm : solution.heroHeadline}
            </h1>

            <p className="text-lg sm:text-xl text-surface-600 dark:text-surface-300 leading-relaxed mb-8">
              {isAm ? solution.heroSubheadlineAm : solution.heroSubheadline}
            </p>

            {/* Impact highlight pill */}
            <div className="inline-flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-sm mb-8">
              <div className="text-3xl font-display font-extrabold text-brand-600 dark:text-brand-400">
                {solution.impactStat.value}
              </div>
              <div className="text-xs sm:text-sm font-medium text-surface-600 dark:text-surface-400 leading-snug">
                {isAm ? solution.impactStat.labelAm : solution.impactStat.label}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => openLeadModal({ interest: `${solution.name} Solution`, defaultBusiness: `${solution.name} Venue`, sourcePage: `solution-${solution.slug}` })}
                className="px-6 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-lg shadow-brand-600/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>{isAm ? 'ነጻ ማሳያ ይመዝገቡ' : 'Book a tailored demo'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <Link
                to="/pricing"
                className="px-6 py-3.5 rounded-xl bg-surface-200/80 dark:bg-surface-800 hover:bg-surface-300/80 dark:hover:bg-surface-700 text-surface-800 dark:text-surface-200 font-semibold transition-all"
              >
                {isAm ? 'የዋጋ ዝርዝር ይመልከቱ' : 'View Ethiopian Pricing'}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points vs Kushina Solution */}
      <section className="py-16 md:py-24 bg-white dark:bg-surface-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-surface-900 dark:text-white mb-4">
              {isAm ? 'በየቀኑ የሚያጋጥሙ ችግሮች እና መፍትሄዎቻቸው' : 'Common bottlenecks solved forever'}
            </h2>
            <p className="text-surface-600 dark:text-surface-400 text-base sm:text-lg">
              {isAm ? solution.overviewAm : solution.overview}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {solution.painPoints.map((point, idx) => (
              <div
                key={idx}
                className="p-6 sm:p-8 rounded-2xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700 flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-5">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-2">
                    {isAm ? point.titleAm : point.title}
                  </h3>
                  <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                    {isAm ? point.descAm : point.desc}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-surface-200 dark:border-surface-700 text-xs font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{isAm ? 'ኩሽና ፖስ በዲጂታል ይፈታዋል' : 'Resolved by KushinaPOS'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tailored Features for this vertical */}
      <section className="py-16 md:py-24 bg-surface-50 dark:bg-surface-950 border-y border-surface-200/80 dark:border-surface-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-2 block">
              {isAm ? 'ለዚህ ዘርፍ የተዘጋጁ ልዩ ገጽታዎች' : 'Vertical Capabilities'}
            </span>
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-surface-900 dark:text-white">
              {isAm ? `ለ${solution.nameAm} ተስማሚ የሆኑ መሳሪያዎች` : `Built specific to how ${solution.name.toLowerCase()} operate`}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {solution.keyFeatures.map((feat, idx) => (
              <div
                key={idx}
                className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 shadow-xs hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-5 font-display font-bold text-lg">
                  {idx + 1}
                </div>
                <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-3">
                  {isAm ? feat.titleAm : feat.title}
                </h3>
                <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                  {isAm ? feat.descAm : feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recommended Hardware & Plan */}
      <section className="py-16 md:py-24 bg-white dark:bg-surface-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-brand-900 via-surface-900 to-surface-950 text-white relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-brand-500/10 blur-3xl pointer-events-none" />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 text-xs font-semibold uppercase tracking-wider mb-4">
                  {isAm ? 'የተመከረ ውቅር' : 'Recommended configuration'}
                </span>
                <h3 className="font-display text-2xl sm:text-3xl font-bold mb-4">
                  {isAm ? 'ይህን ስራ ለመጀመር የሚያስፈልጉዎት እቃዎች' : 'What you need to get running'}
                </h3>
                <p className="text-surface-300 text-sm sm:text-base leading-relaxed mb-6">
                  {isAm 
                    ? 'አላስፈላጊ ወጪ ሳያወጡ ለስራዎ ትክክለኛ የሆኑትን እቃዎች እና ፕላን ይምረጡ። በቦታው ድረስ መጥተን እንገጥማለን።'
                    : 'Avoid unnecessary equipment. We recommend the exact bundle and subscription calibrated for your daily ticket volume.'}
                </p>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Monitor className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs text-surface-400 uppercase tracking-wider font-semibold">
                        {isAm ? 'የተመከረ የእቃዎች ስብስብ' : 'Hardware bundle'}
                      </div>
                      <div className="text-base font-bold text-white">
                        {isAm ? solution.recommendedBundleAm : solution.recommendedBundle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Layers className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs text-surface-400 uppercase tracking-wider font-semibold">
                        {isAm ? 'የተመከረ የሶፍትዌር ፕላን' : 'Subscription plan'}
                      </div>
                      <div className="text-base font-bold text-white">
                        {isAm ? solution.recommendedPlanAm : solution.recommendedPlan}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-4">
                  <Link
                    to="/hardware"
                    className="px-5 py-2.5 rounded-xl bg-white hover:bg-surface-100 text-surface-900 font-semibold text-sm transition-colors inline-flex items-center gap-2"
                  >
                    <span>{isAm ? 'የእቃዎች ዝርዝር' : 'Explore Hardware'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/pricing"
                    className="px-5 py-2.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-white font-semibold text-sm transition-colors"
                  >
                    {isAm ? 'የዋጋ ፕላኖች' : 'Compare Plans'}
                  </Link>
                </div>
              </div>

              {/* Quick lead capture box */}
              <div id="demo-form" className="bg-white dark:bg-surface-900 text-surface-900 dark:text-white p-6 sm:p-8 rounded-2xl shadow-xl border border-surface-200 dark:border-surface-800">
                <h4 className="font-display text-lg sm:text-xl font-bold mb-2">
                  {isAm ? `የ${solution.nameAm} ነጻ ማሳያ ይዘዙ` : `Request a ${solution.name} Demo`}
                </h4>
                <p className="text-xs sm:text-sm text-surface-600 dark:text-surface-400 mb-6">
                  {isAm 
                    ? 'ባለሙያችን አዲስ አበባ ውስጥ ባሉበት ቦታ መጥቶ ሲስተሙን በነጻ ያሳያችኋል።'
                    : 'Our local deployment specialist will demonstrate how KushinaPOS handles your peak order rush.'}
                </p>
                <DemoLeadForm 
                  preselectedVenue={solution.name} 
                  sourcePage={`solution-${solution.slug}`} 
                  defaultInterest={`${solution.name} Solution`} 
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
