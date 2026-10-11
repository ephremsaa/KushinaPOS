import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { MarketingLayout } from './components/MarketingLayout';
import { MarketingSEO } from './components/MarketingSEO';
import { DemoLeadForm } from './components/DemoLeadForm';
import { useLeadModal } from './context/LeadModalContext';
import {
  SOLUTIONS_DATA,
  PAYMENT_METHODS,
  KEROD_SUCCESS_STORY,
  HOME_FAQS,
  FIVE_PACKAGE_BENEFITS,
  THREE_CLOUD_BENEFITS,
  PRICING_PLANS,
} from './data/marketingData';
import {
  ChefHat, ArrowRight, CheckCircle2, Wifi, WifiOff,
  Sparkles, Monitor, Smartphone, Building2, ShoppingCart,
  Layers, TrendingUp, BarChart3, QrCode, Banknote, CreditCard,
  PhoneCall, ShieldCheck, Clock, Check, ChevronDown, ChevronUp,
  Play, Pause, Volume2, VolumeX, Coffee, UtensilsCrossed, Award
} from 'lucide-react';

export default function HomePage() {
  const { lang } = useLanguage();
  const isAm = lang === 'am';
  const { openLeadModal } = useLeadModal();

  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  return (
    <MarketingLayout>
      <MarketingSEO
        title="KushinaPOS — Ethiopian Restaurant Operating System"
        titleAm="ኩሽና ፖስ — ለኢትዮጵያ ሬስቶራንቶች የተሰራ ዘመናዊ ኦፕሬቲንግ ሲስተም"
        description="The modern, offline-first restaurant management POS built for Ethiopia. Tables, kitchen display KDS, Telebirr QR, and recipe inventory starting at 499 ETB."
        descriptionAm="በኢንተርኔት መቋረጥ የማይቆም፣ ቴሌብር እና ሲቢኢ ብር ክፍያዎችን የሚያስተናግድ፤ የወጥ ቤት ስክሪንና የጠረጴዛ መቆጣጠሪያ ያለው ዘመናዊ የሬስቶራንት ሲስተም።"
        path="/"
      />

      {/* ── 1. Hero Section with Clear, Lighter Background Video (Silent, Balanced for Mobile & Desktop) ── */}
      <section className="relative min-h-[75vh] sm:min-h-[82vh] flex items-center justify-center overflow-hidden bg-slate-900 text-white border-b border-surface-800">
        
        {/* ── Background Video Layer (Light, Crisp, Ambient, Silent, Autoplay, Loop) ── */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <video
            src="/kushina-video.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="w-full h-full object-cover object-center opacity-100 filter brightness-105 contrast-105"
          />
          {/* Light cinematic gradient: subtle darkening at edges for readability while keeping video light & visible */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/15 to-slate-950/65" />
        </div>

        {/* ── Foreground Content: Crisp, Focused, Mobile-Optimized ── */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-20 md:py-28 text-center flex flex-col items-center">
          
          {/* Status Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 sm:px-4 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold bg-black/40 backdrop-blur-md border border-white/25 text-white shadow-md mb-4 sm:mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{isAm ? 'ለኢትዮጵያ ሬስቶራንቶች የተሰራ ዘመናዊ ፖስ' : 'Ethiopian Restaurant Operating System'}</span>
          </div>

          {/* Punchy Headline (Fluid text sizing for phone view) */}
          <h1 className="font-display font-black text-3xl sm:text-5xl md:text-6xl lg:text-7xl text-white tracking-tight leading-[1.15] drop-shadow-[0_2px_14px_rgba(0,0,0,0.85)]">
            {isAm ? (
              <>
                ቀልጣፋ መስተንግዶ። <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-amber-300 to-emerald-400">
                  ዘመናዊ ሽያጭ።
                </span>
              </>
            ) : (
              <>
                Faster Orders. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-amber-300 to-emerald-400">
                  Smarter Kitchen.
                </span>
              </>
            )}
          </h1>

          {/* Concise Subhead */}
          <p className="mt-3 sm:mt-5 text-sm sm:text-lg md:text-xl text-slate-100 max-w-xl mx-auto font-medium drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] leading-snug sm:leading-relaxed">
            {isAm
              ? 'በኢንተርኔት መቋረጥ የማይቆም ፖስ፣ ፈጣን ቴሌብር እና የወጥ ቤት ስክሪን።'
              : 'Offline-first POS, instant Telebirr QR, and real-time kitchen displays.'}
          </p>

          {/* Clean Action Buttons (Compact on phone, spacious on desktop) */}
          <div className="mt-6 sm:mt-9 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full sm:w-auto max-w-xs sm:max-w-none">
            <button
              type="button"
              onClick={() => openLeadModal({ interest: 'Full POS + Kitchen Display (KDS)', sourcePage: 'home_hero' })}
              className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-brand-600 via-brand-500 to-emerald-600 hover:from-brand-500 hover:to-emerald-500 text-white font-extrabold text-sm sm:text-base transition-all shadow-[0_6px_25px_rgba(249,115,22,0.4)] hover:shadow-[0_10px_35px_rgba(249,115,22,0.6)] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-brand-200" />
              <span>{isAm ? 'የነጻ ማሳያ ቀጠሮ ይያዙ' : 'Book a Free Demo'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <Link
              to="/pricing"
              className="w-full sm:w-auto px-5 py-3 sm:px-7 sm:py-3.5 rounded-xl sm:rounded-2xl bg-black/40 hover:bg-black/60 border border-white/25 text-white font-bold text-sm sm:text-base transition-all backdrop-blur-md shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isAm ? 'ዋጋዎችን ይመልከቱ' : 'Explore Plans'}</span>
              <ArrowRight className="w-4 h-4 text-slate-300" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 2. Trust Strip (Real Numbers & Real Customer) ── */}
      <section className="py-8 bg-surface-950 text-white border-b border-surface-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
            
            {/* Real Customer Spotlight */}
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-brand-500/20 border border-brand-500/40 text-brand-400 flex items-center justify-center flex-shrink-0">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <p className="font-display font-extrabold text-sm sm:text-base text-white">
                  {isAm ? 'በኬሮድ ሬስቶራንት የተሞከረ እና የተመሰከረለት' : 'Built & Battle-Tested with Kerod Restaurant'}
                </p>
                <p className="text-xs text-slate-400">
                  {isAm ? 'ቦሌ፣ አዲስ አበባ · 180 ወንበሮች ያሉት ትልቅ መስተንግዶ' : 'Bole Sub-City, Addis Ababa · 180-Seat High-Volume Dining'}
                </p>
              </div>
            </div>

            {/* Real Feature Pillars (Zero Invented Stats) */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs font-semibold text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-400" />
                <span>{isAm ? 'ዲጂታል የወጥ ቤት ስክሪን KDS' : 'Digital KDS Kitchen System'}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-400" />
                <span>{isAm ? 'ቀጥታ የቴሌብር እና ሲቢኢ ብር QR' : 'Direct Telebirr & CBE Birr QR'}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-400" />
                <span>{isAm ? 'ከመስመር ውጭ (SQLite) ቋት' : 'Local Offline SQLite Engine'}</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 3. Three Solution Cards ── */}
      <section className="py-20 sm:py-28 bg-white border-b border-surface-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mx-auto text-center mb-16 space-y-3">
            <span className="text-xs font-black uppercase tracking-wider text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
              {isAm ? 'ለስራዎ የተዘጋጁ መፍትሄዎች' : 'Tailored For Your Venue'}
            </span>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-surface-950 tracking-tight">
              {isAm ? 'ለማንኛውም አይነት የመስተንግዶ ስራ የተመቻቸ' : 'Every Food Service Workflow, Simplified'}
            </h2>
            <p className="text-surface-600 text-sm sm:text-base leading-relaxed">
              {isAm
                ? 'ከባህላዊ ሬስቶራንት ጀምሮ እስከ ፈጣን ካፌዎች እና ባለብዙ ቅርንጫፍ ሆቴሎች ድረስ የሚፈልጉትን በትክክል ያሟላል።'
                : 'Select your operational format to see how KushinaPOS streamlines your floor, bar, and kitchen.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Card 1: Restaurants */}
            <div className="p-8 rounded-3xl bg-surface-50/70 border border-surface-200 hover:border-brand-300 transition-all duration-300 hover:shadow-xl flex flex-col justify-between group">
              <div className="space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <UtensilsCrossed className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-100/60 px-2.5 py-0.5 rounded-full">
                    {SOLUTIONS_DATA.restaurants.badge}
                  </span>
                  <h3 className="font-display font-extrabold text-xl text-surface-950 mt-2">
                    {isAm ? SOLUTIONS_DATA.restaurants.nameAm : SOLUTIONS_DATA.restaurants.name}
                  </h3>
                  <p className="text-xs text-surface-600 mt-2 leading-relaxed">
                    {isAm ? SOLUTIONS_DATA.restaurants.overviewAm : SOLUTIONS_DATA.restaurants.overview}
                  </p>
                </div>

                <ul className="space-y-2 pt-2 border-t border-surface-200/80 text-xs text-surface-700">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
                    <span>{isAm ? 'የቀለም ቅንብር ያለው የወጥ ቤት ስክሪን KDS' : 'Color-coded kitchen prep display (KDS)'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
                    <span>{isAm ? 'የጠረጴዛዎች ህያው ካርታ እና ክፍፍል' : 'Visual interactive table map & seat split'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
                    <span>{isAm ? 'የስጋና ቅመማ ቅመም ክምችት ቁጥጥር' : 'Meat, butter & injera ingredient deductions'}</span>
                  </li>
                </ul>
              </div>

              <div className="pt-6 mt-6 border-t border-surface-200">
                <Link
                  to="/solutions/restaurants"
                  className="font-bold text-xs text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 group-hover:gap-2 transition-all"
                >
                  <span>{isAm ? 'ስለ ሬስቶራንት አሰራር የበለጠ ይመልከቱ' : 'Explore Restaurant Solution'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Card 2: Cafes and Bakeries */}
            <div className="p-8 rounded-3xl bg-surface-50/70 border border-surface-200 hover:border-brand-300 transition-all duration-300 hover:shadow-xl flex flex-col justify-between group">
              <div className="space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Coffee className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-orange-700 bg-orange-100/60 px-2.5 py-0.5 rounded-full">
                    {SOLUTIONS_DATA.cafes.badge}
                  </span>
                  <h3 className="font-display font-extrabold text-xl text-surface-950 mt-2">
                    {isAm ? SOLUTIONS_DATA.cafes.nameAm : SOLUTIONS_DATA.cafes.name}
                  </h3>
                  <p className="text-xs text-surface-600 mt-2 leading-relaxed">
                    {isAm ? SOLUTIONS_DATA.cafes.overviewAm : SOLUTIONS_DATA.cafes.overview}
                  </p>
                </div>

                <ul className="space-y-2 pt-2 border-t border-surface-200/80 text-xs text-surface-700">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
                    <span>{isAm ? 'ፈጣን የ2 ንክኪ ማኪያቶና ኬክ ሽያጭ' : '2-tap quick item checkout grid'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
                    <span>{isAm ? 'ለባሪስታ ወዲያውኑ የሚያትም ፕሪንተር' : 'Instant thermal printing for barista counter'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
                    <span>{isAm ? 'የልደት ኬክ ቅድመ ክፍያ ምዝገባ' : 'Birthday cake advance deposit schedule'}</span>
                  </li>
                </ul>
              </div>

              <div className="pt-6 mt-6 border-t border-surface-200">
                <Link
                  to="/solutions/cafes"
                  className="font-bold text-xs text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 group-hover:gap-2 transition-all"
                >
                  <span>{isAm ? 'ስለ ካፌ አሰራር የበለጠ ይመልከቱ' : 'Explore Cafe Solution'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Card 3: Multi-Branch / Enterprise */}
            <div className="p-8 rounded-3xl bg-surface-50/70 border border-surface-200 hover:border-brand-300 transition-all duration-300 hover:shadow-xl flex flex-col justify-between group">
              <div className="space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Building2 className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/60 px-2.5 py-0.5 rounded-full">
                    {SOLUTIONS_DATA.hotels.badge}
                  </span>
                  <h3 className="font-display font-extrabold text-xl text-surface-950 mt-2">
                    {isAm ? 'ባለብዙ ቅርንጫፍ እና ሆቴሎች' : 'Multi-Branch & Resorts'}
                  </h3>
                  <p className="text-xs text-surface-600 mt-2 leading-relaxed">
                    {isAm
                      ? 'የተለያዩ ቅርንጫፎችን የሽያጭ እና የክምችት ሁኔታ በአንድ ማዕከላዊ የባለቤት ስልክ ሪፖርት ይቆጣጠሩ።'
                      : 'Aggregate sales, staff PIN access, and centralized menu pricing across all locations on one dashboard.'}
                  </p>
                </div>

                <ul className="space-y-2 pt-2 border-t border-surface-200/80 text-xs text-surface-700">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
                    <span>{isAm ? 'የሁሉንም ቅርንጫፎች ገቢ በአንድ ላይ ማየት' : 'Consolidated HQ revenue reporting'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
                    <span>{isAm ? 'የማናጀር ሚስጥር ቁጥር ጥብቅ ቁጥጥር' : 'Strict manager authorization PIN audit logs'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
                    <span>{isAm ? 'የክፍል ውስጥ እና የፑል ባር መስተንግዶ' : 'Room service & pool bar outlet routing'}</span>
                  </li>
                </ul>
              </div>

              <div className="pt-6 mt-6 border-t border-surface-200">
                <Link
                  to="/solutions/hotels"
                  className="font-bold text-xs text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 group-hover:gap-2 transition-all"
                >
                  <span>{isAm ? 'ስለ ባለብዙ ቅርንጫፍ ይመልከቱ' : 'Explore Multi-Branch Solution'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 4. Everything in One Package (5 Benefits + Real Price) ── */}
      <section className="py-20 sm:py-28 bg-slate-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left: 5 Package Benefits */}
            <div className="lg:col-span-7 space-y-6">
              <span className="text-xs font-black uppercase tracking-wider text-brand-300 bg-brand-500/20 px-3 py-1 rounded-full border border-brand-500/30">
                {isAm ? 'የተሟላ ጥቅል በአንድ ላይ' : 'Everything In One Package'}
              </span>
              
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
                {isAm ? 'የተሟላ የሬስቶራንት ሲስተም፤ ያለተበታተነ ወጪ' : 'One Single System. Five Major Operational Upgrades.'}
              </h2>

              <p className="text-slate-300 text-sm leading-relaxed max-w-xl">
                {isAm
                  ? 'የተለያዩ ሶፍትዌሮችን ለየብቻ ሳይገዙ፤ ሽያጭ፣ ወጥ ቤት፣ ክምችት እና ክፍያ በአንድ ላይ ተሟልተው ይቀርባሉ።'
                  : 'No buying separate apps for billing, inventory, and kitchen displays. KushinaPOS unites every operational touchpoint in a single unified system.'}
              </p>

              <div className="space-y-4 pt-2">
                {FIVE_PACKAGE_BENEFITS.map((b, i) => (
                  <div key={i} className="flex items-start gap-4 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/30 text-brand-400 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                      0{i + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">
                        {isAm ? b.titleAm : b.title}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        {isAm ? b.descAm : b.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Price Card (499 ETB / mo) */}
            <div className="lg:col-span-5">
              <div className="p-8 sm:p-10 rounded-3xl sm:rounded-[2.5rem] bg-slate-950 border-2 border-brand-500/40 shadow-2xl text-center space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-brand-500 via-amber-400 to-emerald-500" />
                
                <span className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  {isAm ? 'ግልጽ እና ተመጣጣኝ ዋጋ' : 'Transparent Ethiopian Pricing'}
                </span>

                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    {isAm ? 'መነሻ ዋጋ በወር' : 'Starts At Just'}
                  </p>
                  <div className="flex items-baseline justify-center gap-1.5 mt-2">
                    <span className="text-5xl sm:text-6xl font-display font-black text-white tracking-tight">499</span>
                    <span className="text-brand-400 font-bold text-lg">ETB / mo</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    {isAm ? 'ምንም አይነት የዶላር ወይም የውጭ ምንዛሬ ክፍያ የለም' : 'No foreign currency cards needed. Billed 100% in Ethiopian Birr.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-left text-xs space-y-2 text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
                    <span>Includes 5 staff PIN logins</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
                    <span>Free on-site installation in Addis Ababa</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
                    <span>14 days completely free trial to start</span>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <Link
                    to="/pricing"
                    className="w-full py-4 px-6 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-sm transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <span>{isAm ? 'ሁሉንም ፕላኖች ይመልከቱ' : 'View Full Pricing & Plans'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <p className="text-[11px] text-slate-500">
                    Pay via Telebirr, CBE Bank Transfer, or Cash proof
                  </p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── 5. Three Cloud Benefits ── */}
      <section className="py-20 sm:py-28 bg-white border-b border-surface-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mx-auto text-center mb-16 space-y-3">
            <span className="text-xs font-black uppercase tracking-wider text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
              {isAm ? 'ዘመናዊ የክላውድ ምቾት' : 'Cloud Convenience Everywhere'}
            </span>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-surface-950 tracking-tight">
              {isAm ? 'ሬስቶራንትዎን ከእጅዎ ስልክ ላይ ይምሩ' : 'Run Your Restaurant From Your Smartphone'}
            </h2>
            <p className="text-surface-600 text-sm sm:text-base leading-relaxed">
              {isAm
                ? 'በሬስቶራንቱ ውስጥ መገኘት ሳይጠበቅብዎት፤ ሽያጭ፣ የሰራተኛ መገኘት እና የዋጋ ለውጦችን በሰከንዶች ውስጥ ያስተካክሉ።'
                : 'Freedom for restaurant owners. Access real-time numbers, table turns, and updates from any location.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {THREE_CLOUD_BENEFITS.map((c, i) => (
              <div key={i} className="p-8 rounded-3xl bg-surface-50/70 border border-surface-200 hover:border-brand-300 transition-all duration-300 hover:shadow-xl space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-600 flex items-center justify-center">
                  {i === 0 && <BarChart3 className="w-6 h-6" />}
                  {i === 1 && <Smartphone className="w-6 h-6" />}
                  {i === 2 && <QrCode className="w-6 h-6" />}
                </div>
                <h3 className="font-display font-extrabold text-xl text-surface-950">
                  {isAm ? c.titleAm : c.title}
                </h3>
                <p className="text-xs text-surface-600 leading-relaxed">
                  {isAm ? c.descAm : c.desc}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── 6. Payments Block (Ethiopian Methods) ── */}
      <section className="py-20 sm:py-28 bg-surface-50 border-b border-surface-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mx-auto text-center mb-16 space-y-3">
            <span className="text-xs font-black uppercase tracking-wider text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
              {isAm ? 'የአገር ውስጥ ክፍያዎች' : 'Local Payment Reality'}
            </span>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-surface-950 tracking-tight">
              {isAm ? 'በኢትዮጵያ የሚሰሩ እውነተኛ የክፍያ መንገዶች' : 'Support Every Payment Method Used in Ethiopia'}
            </h2>
            <p className="text-surface-600 text-sm sm:text-base leading-relaxed">
              {isAm
                ? 'ደንበኞችዎ በቴሌብር፣ በሲቢኢ ብር፣ በጥሬ ገንዘብ ወይም በባንክ ዝውውር መክፈል ቢፈልጉ፤ ሁሉም በሲስተሙ ተዘጋጅቷል።'
                : 'Zero awkward billing delays. Generate dynamic QR codes, capture bank transaction reference numbers, and split bills seamlessly.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PAYMENT_METHODS.slice(0, 4).map((pay) => (
              <div key={pay.id} className="p-6 rounded-3xl bg-white border border-surface-200 hover:border-brand-400 transition-all hover:shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-surface-100 text-surface-600 px-2.5 py-0.5 rounded-full">
                    {pay.provider}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <h3 className="font-display font-extrabold text-lg text-surface-950">
                  {isAm ? pay.nameAm : pay.name}
                </h3>
                <p className="text-xs text-surface-600 leading-relaxed">
                  {isAm ? pay.descAm : pay.desc}
                </p>
                <div className="pt-2 text-[11px] font-bold text-brand-600 border-t border-surface-100">
                  {isAm ? pay.badgeAm : pay.badge}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              to="/payments"
              className="inline-flex items-center gap-2 text-xs font-bold text-brand-600 hover:text-brand-700 underline underline-offset-4"
            >
              <span>{isAm ? 'ስለ ክፍያ አሰራር ዝርዝር መረጃ ይመልከቱ' : 'Read more about Ethiopian payment workflows'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

        </div>
      </section>

      {/* ── 7. Offline-First Block ── */}
      <section className="py-20 sm:py-28 bg-surface-950 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <WifiOff className="w-3.5 h-3.5" />
                <span>{isAm ? 'ከመስመር ውጭ (Offline) አሰራር' : '100% Offline-First Architecture'}</span>
              </div>

              <h2 className="font-display font-extrabold text-3xl sm:text-5xl text-white tracking-tight leading-tight">
                {isAm ? (
                  <>መብራትና ኢንተርኔት ቢጠፋም <span className="text-brand-400">ሽያጭ አይቆምም</span></>
                ) : (
                  <>Internet or Power Drops? <span className="text-brand-400">Keep Selling.</span></>
                )}
              </h2>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                {isAm
                  ? 'ኢትዮ ቴሌኮም ኔትወርክ ሲያቋርጥ ወይም የዋይፋይ ራውተር ሲጠፋ፤ ካሸሮች መሸጥ፣ ደረሰኝ ማተም እና ካሽ ቦክስ መክፈት ይችላሉ። ኔትወርክ እንደተመለሰ መረጃው በራሱ ወደ ክላውድ ይተላለፋል።'
                  : 'Cloud-only systems crash when Ethiopian telecom connections flicker. KushinaPOS stores transactions in a local SQLite database mirror right on the counter tablet, syncing seamlessly once internet reconnects.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs text-left">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <p className="font-bold text-white mb-1">Local Thermal Printing</p>
                  <p className="text-slate-400 text-[11px]">Direct USB & Bluetooth receipts print with zero cloud dependency.</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <p className="font-bold text-white mb-1">Auto Cloud Reconciliation</p>
                  <p className="text-slate-400 text-[11px]">Silently buffers orders and pushes to server the second Wi-Fi revives.</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
                  <span className="font-bold text-white">Ethio Telecom Status Simulator</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500/20 text-red-400">
                    Internet Disconnected
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Cashier Station 01 (Tablet)</span>
                    <span className="text-emerald-400 font-bold">● Active & Selling</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Receipt Thermal Printer</span>
                    <span className="text-emerald-400 font-bold">● Printing Offline</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Local Buffered Transactions</span>
                    <span className="text-brand-300 font-mono font-bold">24 Orders Queued</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 text-center italic">
                  "No customer will ever be told 'our system is down' during dinner rush."
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 8. Support Block (Amharic Onboarding & Training) ── */}
      <section className="py-20 sm:py-28 bg-white border-b border-surface-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-black uppercase tracking-wider text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
                {isAm ? 'የአገር ውስጥ ድጋፍ' : 'Local Hands-On Support'}
              </span>

              <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-surface-950 tracking-tight">
                {isAm ? 'በአማርኛ ቋንቋ ስልጠና እና በቦታው ገጠማ' : 'Amharic Training & On-Site Setup in Addis Ababa'}
              </h2>

              <p className="text-surface-600 text-sm sm:text-base leading-relaxed">
                {isAm
                  ? 'ቴክኖሎጂውን የማያውቁ አስተናጋጆችና ካሸሮች እንኳን በ30 ደቂቃ ውስጥ በቀላሉ እንዲለምዱት እናደርጋለን። በአካል መጥተን እቃዎችን እንገጥማለን፣ እናሰለጥናለን፤ በስልክና በቴሌግራም ሁልጊዜ ከጎንዎ ነን።'
                  : 'We do not send you a software download link and walk away. Our Addis Ababa operations team visits your restaurant in person, configures printers and cash drawers, and trains waiters in Amharic until everyone is confident.'}
              </p>

              <div className="space-y-3 pt-2 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold flex-shrink-0">
                    1
                  </div>
                  <span className="font-semibold text-surface-800">
                    {isAm ? 'በቦታው መጥቶ ፕሪንተርና ታብሌት መግጠም (አዲስ አበባ)' : 'In-person hardware installation at your venue'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold flex-shrink-0">
                    2
                  </div>
                  <span className="font-semibold text-surface-800">
                    {isAm ? 'ለካሸሮች እና አስተናጋጆች የአማርኛ ስልጠና' : 'Waiter & kitchen staff training in Amharic'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold flex-shrink-0">
                    3
                  </div>
                  <span className="font-semibold text-surface-800">
                    {isAm ? 'የቀጥታ የስልክ እና ቴሌግራም ፈጣን ድጋፍ' : 'Dedicated Telegram & direct phone support line'}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  to="/support"
                  className="inline-flex items-center gap-2 font-bold text-xs text-brand-600 hover:text-brand-700 underline underline-offset-4"
                >
                  <span>{isAm ? 'ስለ ድጋፍ አገልግሎታችን የበለጠ ያንብቡ' : 'Learn more about onboarding and support'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="p-8 rounded-3xl bg-surface-50 border border-surface-200 shadow-xl space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center">
                    <PhoneCall className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-base text-surface-900">
                      {isAm ? 'የቀጥታ እርዳታ ይፈልጋሉ?' : 'Need Instant Assistance?'}
                    </h4>
                    <p className="text-xs text-surface-500">Addis Ababa Support Desk</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-white border border-surface-200/80 flex items-center justify-between">
                    <span className="text-surface-500">Direct Phone:</span>
                    <a href="tel:+251911234567" className="font-mono font-bold text-surface-900 hover:text-brand-600">
                      +251 911 234 567
                    </a>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white border border-surface-200/80 flex items-center justify-between">
                    <span className="text-surface-500">Telegram Channel:</span>
                    <a href="https://t.me/kushinapos" target="_blank" rel="noopener noreferrer" className="font-bold text-sky-600 hover:underline">
                      @kushinapos
                    </a>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white border border-surface-200/80 flex items-center justify-between">
                    <span className="text-surface-500">Office Location:</span>
                    <span className="font-bold text-surface-900">Bole Medhanialem, Addis Ababa</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => openLeadModal({ interest: 'Support / Callback Request', sourcePage: 'home_support_desk' })}
                    className="w-full py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>{isAm ? 'የስልክ ጥሪ ይጠይቁ' : 'Request a callback'}</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 8.5 Transparent ETB Pricing Spotlight ── */}
      <section className="py-20 sm:py-24 bg-surface-50 border-b border-surface-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-50 text-brand-700 border border-brand-200 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              <span>{isAm ? 'ግልጽ የኢትዮጵያ ብር ዋጋ' : '100% In Ethiopian Birr'}</span>
            </div>
            <h2 className="font-display font-black text-3xl sm:text-4xl text-surface-950 mb-3">
              {isAm ? (
                <>ከ <span className="text-brand-600 font-mono">499 ብር</span> በወር ጀምሮ — ምንም ድብቅ ክፍያ የለም</>
              ) : (
                <>From <span className="text-brand-600 font-mono">499 ETB / month</span> — Zero Foreign Currency Hurdles</>
              )}
            </h2>
            <p className="text-surface-600 text-sm sm:text-base">
              {isAm 
                ? 'ምንም አይነት የዶላር ወይም የውጭ ምንዛሬ ችግር የለም፤ በአመት ሲከፍሉ የ2 ወር ነጻ አገልግሎት ያገኛሉ።'
                : 'No USD fees, no commission on your sales, and no lock-in contracts. Pay locally in ETB via Telebirr or CBE Birr.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PRICING_PLANS.map((plan) => (
              <div 
                key={plan.id}
                className={`rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all ${
                  plan.isPopular 
                    ? 'bg-surface-950 text-white shadow-xl ring-2 ring-brand-500 scale-[1.02]' 
                    : 'bg-white border border-surface-200/90 text-surface-900 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-display font-black text-xl">{isAm ? plan.nameAm : plan.name}</h3>
                    {plan.isPopular && (
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-brand-500 text-white">
                        {isAm ? 'በጣም ተመራጭ' : 'Most Popular'}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mb-4 ${plan.isPopular ? 'text-surface-400' : 'text-surface-500'}`}>
                    {isAm ? plan.badgeAm : plan.badge}
                  </p>
                  <div className="mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-display font-extrabold font-mono">
                        {plan.priceMonthly.toLocaleString()}
                      </span>
                      <span className={`text-xs font-bold ${plan.isPopular ? 'text-surface-300' : 'text-surface-500'}`}>
                        ETB {isAm ? '/ በወር' : '/ mo'}
                      </span>
                    </div>
                    <div className={`text-[11px] mt-1 font-semibold ${plan.isPopular ? 'text-brand-300' : 'text-emerald-600'}`}>
                      {isAm ? `አመታዊ: ${plan.priceAnnual.toLocaleString()} ብር (2 ወር ነጻ)` : `Annual: ${plan.priceAnnual.toLocaleString()} ETB (2 mo free)`}
                    </div>
                  </div>
                  <p className={`text-xs leading-relaxed mb-6 ${plan.isPopular ? 'text-surface-300' : 'text-surface-600'}`}>
                    {isAm ? plan.descAm : plan.desc}
                  </p>
                </div>

                <div className="space-y-2 pt-4 border-t border-surface-200/50 dark:border-surface-800">
                  <button
                    type="button"
                    onClick={() => openLeadModal({ interest: `Pricing: ${plan.name} Plan`, sourcePage: 'home_pricing_spotlight' })}
                    className={`w-full py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      plan.isPopular
                        ? 'bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-brand-500/25'
                        : 'bg-surface-900 hover:bg-black text-white'
                    }`}
                  >
                    <span>{isAm ? 'የ14 ቀን ሙከራ ጀምር' : 'Start 14-day free trial'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 font-bold text-sm text-brand-600 hover:text-brand-700 underline underline-offset-4"
            >
              <span>{isAm ? 'የፕላኖች ሙሉ ንፅፅር እና ዝርዝር ይመልከቱ' : 'See full plan comparison matrix & ETB savings'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 9. Success Stories (Kerod Restaurant Spotlight) ── */}
      <section className="py-20 sm:py-28 bg-surface-50 border-b border-surface-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="p-8 sm:p-12 lg:p-16 rounded-3xl sm:rounded-[3rem] bg-surface-950 text-white border-2 border-brand-500/30 shadow-2xl relative overflow-hidden">
            <div className="max-w-3xl space-y-6">
              
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/30">
                <Award className="w-3.5 h-3.5" />
                <span>Real Customer Spotlight · Kerod Restaurant</span>
              </div>

              <blockquote className="font-display font-bold text-xl sm:text-2xl lg:text-3xl text-white leading-relaxed">
                "{isAm ? KEROD_SUCCESS_STORY.quoteAm : KEROD_SUCCESS_STORY.quote}"
              </blockquote>

              <div className="flex items-center gap-3 pt-2">
                <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white font-black flex items-center justify-center text-lg">
                  TA
                </div>
                <div>
                  <p className="font-bold text-sm text-white">{KEROD_SUCCESS_STORY.quoteAuthor}</p>
                  <p className="text-xs text-brand-300">
                    {isAm ? KEROD_SUCCESS_STORY.quoteAuthorTitleAm : KEROD_SUCCESS_STORY.quoteAuthorTitle}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-surface-800">
                {KEROD_SUCCESS_STORY.results.map((res, i) => (
                  <div key={i} className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
                    <p className="font-display font-black text-2xl text-brand-400">{res.value}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{isAm ? res.labelAm : res.label}</p>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Link
                  to="/success-stories"
                  className="font-bold text-xs text-brand-300 hover:text-brand-200 inline-flex items-center gap-1 underline underline-offset-4"
                >
                  <span>{isAm ? 'ሙሉውን የኬሮድ ታሪክ ያንብቡ' : 'Read the complete Kerod Restaurant case study'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ── 10. FAQ (6 Questions) & Final Call to Action with Lead Form ── */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            
            {/* Left 6 FAQs */}
            <div className="lg:col-span-6 space-y-6">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
                  {isAm ? 'ተደጋጋሚ ጥያቄዎች' : 'Common Questions'}
                </span>
                <h2 className="font-display font-extrabold text-3xl text-surface-950 tracking-tight mt-3">
                  {isAm ? 'ስለ ኩሽና ፖስ ማወቅ የሚፈልጉት ነገር' : 'Everything You Need to Know'}
                </h2>
                <p className="text-xs text-surface-500 mt-1">
                  {isAm ? 'ግልጽ መልሶች፤ ያለ ምንም ማጋነን ወይም ድብቅ ክፍያ።' : 'Straightforward answers. No hidden gotchas.'}
                </p>
              </div>

              <div className="space-y-3">
                {HOME_FAQS.map((faq, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-surface-200 overflow-hidden bg-surface-50/60 transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                      className="w-full p-4 text-left font-bold text-xs sm:text-sm text-surface-900 flex items-center justify-between gap-3 hover:text-brand-600 transition-colors cursor-pointer"
                    >
                      <span>{isAm ? faq.qAm : faq.q}</span>
                      {openFaqIndex === idx ? (
                        <ChevronUp className="w-4 h-4 text-brand-600 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-surface-400 flex-shrink-0" />
                      )}
                    </button>
                    {openFaqIndex === idx && (
                      <div className="px-4 pb-4 pt-1 text-xs text-surface-600 leading-relaxed border-t border-surface-100 bg-white">
                        {isAm ? faq.aAm : faq.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Link
                  to="/faq"
                  className="font-bold text-xs text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 underline underline-offset-4"
                >
                  <span>{isAm ? 'ተጨማሪ 10 ጥያቄዎችንና መልሶችን ይመልከቱ' : 'View full categorized FAQ database'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Right: Lead Capture Form */}
            <div className="lg:col-span-6">
              <DemoLeadForm sourcePage="home_cta" />
            </div>

          </div>

        </div>
      </section>

    </MarketingLayout>
  );
}
