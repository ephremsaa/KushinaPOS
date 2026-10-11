import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Quote, MapPin, CheckCircle2, ArrowRight, TrendingUp, 
  Clock, ShieldCheck, UtensilsCrossed, Sparkles, Building2
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import MarketingLayout from './components/MarketingLayout';
import MarketingSEO from './components/MarketingSEO';
import { KEROD_SUCCESS_STORY } from './data/marketingData';
import { useLeadModal } from './context/LeadModalContext';

export default function SuccessStoriesPage() {
  const { lang } = useLanguage();
  const isAm = lang === 'am';
  const { openLeadModal } = useLeadModal();
  const kerod = KEROD_SUCCESS_STORY;

  return (
    <MarketingLayout>
      <MarketingSEO
        title={isAm ? 'የደንበኞቻችን ስኬት፡ የኬሮድ ሬስቶራንት ምስክርነት | KushinaPOS' : 'Customer Stories: How Kerod Restaurant Transformed Operations | KushinaPOS'}
        description={isAm ? 'የኬሮድ ሬስቶራንት ኩሽና ፖስን በመጠቀም የወረቀት ትዕዛዝን እንዴት እንዳስቀረ እና የጠረጴዛ ዝውውሩን በ22 ደቂቃ እንዳፈጠነ ይመልከቱ።' : 'Read the real story of Kerod Restaurant in Bole, Addis Ababa: 22-minute faster table turnaround, zero lost kitchen tickets, and 10-minute nightly till balancing.'}
        canonicalUrl="/success-stories"
      />

      {/* Hero Header */}
      <section className="pt-12 pb-16 md:py-20 bg-gradient-to-b from-surface-100 via-white to-surface-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 border-b border-surface-200/70 dark:border-surface-800/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200/80 dark:border-brand-800/80 text-brand-700 dark:text-brand-300 text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles className="w-4 h-4 text-brand-600" />
            <span>{isAm ? 'እውነተኛ የደንበኞች ምስክርነት' : 'Real Customer Impact • Zero Fabrications'}</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-surface-900 dark:text-white max-w-4xl mx-auto mb-6">
            {isAm 
              ? 'የኢትዮጵያ ሬስቶራንቶች ኩሽና ፖስን ተጠቅመው እንዴት እያደጉ እንደሆነ ይመልከቱ' 
              : 'How leading Addis Ababa restaurants operate at peak velocity'}
          </h1>

          <p className="text-base sm:text-xl text-surface-600 dark:text-surface-300 max-w-3xl mx-auto leading-relaxed mb-8">
            {isAm
              ? 'ምንም አይነት የተፈበረኩ አርማዎች ወይም የውሸት ስታቲስቲክስ አንጠቀምም። እያንዳንዱ ታሪክ በፈቃድ የታተመ እውነተኛ የስራ ውጤት ነው።'
              : 'We do not publish invented testimonials or fake company logos. Every case study reflects verifiable operational metrics with explicit owner permission.'}
          </p>
        </div>
      </section>

      {/* Kerod Restaurant In-Depth Case Study */}
      <section className="py-16 md:py-24 bg-white dark:bg-surface-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="rounded-3xl bg-surface-50 dark:bg-surface-850/60 border border-surface-200 dark:border-surface-800 p-8 sm:p-12 lg:p-16 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Case Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-200 dark:border-surface-800 pb-8 mb-10">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 block mb-1">
                  {isAm ? 'የደንበኛ ታሪክ #1' : 'Featured Case Study #1'}
                </span>
                <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-surface-900 dark:text-white">
                  {isAm ? kerod.restaurantNameAm : kerod.restaurantName}
                </h2>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-surface-500 mt-2">
                  <MapPin className="w-4 h-4 text-brand-600" />
                  <span>{isAm ? kerod.locationAm : kerod.location}</span>
                  <span>•</span>
                  <span>{isAm ? kerod.cuisineAm : kerod.cuisine}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-right">
                <div className="text-xs uppercase font-semibold text-surface-400">
                  {isAm ? 'የመቀመጫ ብዛት' : 'Seating Capacity'}
                </div>
                <div className="text-lg font-bold text-surface-900 dark:text-white">
                  {isAm ? kerod.seatedCapacityAm : kerod.seatedCapacity}
                </div>
              </div>
            </div>

            {/* Quote Block */}
            <div className="relative mb-12">
              <Quote className="w-12 h-12 text-brand-500/20 absolute -top-4 -left-4" />
              <blockquote className="relative z-10 text-lg sm:text-2xl font-serif italic text-surface-800 dark:text-surface-200 leading-relaxed pl-6 border-l-4 border-brand-500">
                "{isAm ? kerod.quoteAm : kerod.quote}"
              </blockquote>
              <div className="mt-6 pl-6">
                <div className="font-bold text-base text-surface-900 dark:text-white">
                  {kerod.quoteAuthor}
                </div>
                <div className="text-xs sm:text-sm text-surface-500">
                  {isAm ? kerod.quoteAuthorTitleAm : kerod.quoteAuthorTitle}
                </div>
              </div>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 my-12">
              {kerod.results.map((res, idx) => (
                <div key={idx} className="p-6 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-xs">
                  <div className="font-display text-3xl sm:text-4xl font-extrabold text-brand-600 dark:text-brand-400 mb-2">
                    {res.value}
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-surface-600 dark:text-surface-400 leading-snug">
                    {isAm ? res.labelAm : res.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Key takeaway */}
            <div className="p-6 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300 mb-2">
                {isAm ? 'ዋናው ትምህርት' : 'Key Operational Takeaway'}
              </h4>
              <p className="text-sm sm:text-base text-surface-800 dark:text-surface-200 leading-relaxed">
                {isAm ? kerod.keyTakeawayAm : kerod.keyTakeaway}
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Partner Invitation Banner */}
      <section className="py-16 md:py-20 bg-surface-50 dark:bg-surface-950 border-t border-surface-200 dark:border-surface-800 text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white mb-3">
            {isAm ? 'የእርስዎ ሬስቶራንት የሚቀጥለው ስኬታማ አጋር እንዲሆን ይፈልጋሉ?' : 'Want your hospitality brand featured next?'}
          </h2>
          <p className="text-surface-600 dark:text-surface-400 text-sm sm:text-base mb-8">
            {isAm
              ? 'ኩሽና ፖስን ተጠቅመው በሬስቶራንትዎ ውስጥ የታየውን እድገት እና ለውጥ ከአዲስ አበባ ማህበረሰብ ጋር በጋራ እናጋራለን።'
              : 'Join forward-thinking restaurants transforming service across Bole, Kazanchis, Piassa, and CMC. Experience the difference in 14 days.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => openLeadModal({ interest: 'Success Story Inquirer - On-Site Demo', sourcePage: 'success-stories' })}
              className="px-8 py-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
            >
              {isAm ? 'የነጻ ማሳያ ይመዝገቡ' : 'Request Free On-Site Demo'}
            </button>
            <Link
              to="/contact"
              className="px-8 py-4 rounded-xl bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-white font-bold text-sm hover:bg-surface-50 dark:hover:bg-surface-700 transition-all"
            >
              {isAm ? 'ያነጋግሩን' : 'Get in Touch'}
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
