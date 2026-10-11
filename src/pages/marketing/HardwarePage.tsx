import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Tablet, Printer, Banknote, ShieldCheck, Wrench, CheckCircle2, 
  ArrowRight, PhoneCall, Sparkles, Monitor, Wifi, Zap, Cpu,
  BatteryCharging, Globe, Smartphone, Check, HelpCircle, HardDrive, Shield
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import MarketingLayout from './components/MarketingLayout';
import MarketingSEO from './components/MarketingSEO';
import { HARDWARE_BUNDLES } from './data/marketingData';
import { useLeadModal } from './context/LeadModalContext';

export default function HardwarePage() {
  const { lang } = useLanguage();
  const isAm = lang === 'am';
  const { openLeadModal } = useLeadModal();

  // Compatibility data lists
  const testedPrinters = [
    {
      brand: 'Epson',
      models: 'TM-T20III, TM-T88VI, TM-m30, TM-T82',
      connectivity: 'USB, LAN Ethernet, Bluetooth',
      connectivityAm: 'USB፣ የኔትወርክ ገመድ (LAN)፣ ብሉቱዝ',
      notes: 'Industry benchmark. Ultra-fast auto-cutter and direct Amharic character rendering support.',
      notesAm: 'የአለም አቀፍ ደረጃ ያለው፤ ፈጣን አውቶ-ቆራጭ እና የአማርኛ ፊደላት ድጋፍ ያለው።',
      status: '100% Certified',
      statusAm: 'የተረጋገጠ',
    },
    {
      brand: 'Xprinter',
      models: 'XP-N160II, XP-C260M, XP-Q200, XP-T80A, XP-58IIH',
      connectivity: 'USB, LAN Ethernet, Wi-Fi',
      connectivityAm: 'USB፣ የኔትወርክ ገመድ (LAN)፣ ዋይፋይ',
      notes: 'Most widely available and cost-effective receipt printer across Merkato and Bole markets.',
      notesAm: 'በመላው ኢትዮጵያ በስፋት የሚገኝ፣ ዋጋው ተመጣጣኝና ረጅም ጊዜ የሚሰራ አስተማማኝ ፕሪንተር።',
      status: '100% Certified',
      statusAm: 'የተረጋገጠ',
    },
    {
      brand: 'Sunmi',
      models: 'Sunmi V2s, V2 Pro, D2s, T2 Mini, T2',
      connectivity: 'Built-in High-Speed Thermal, USB, Wi-Fi',
      connectivityAm: 'የተገጠመለት የራሱ ፈጣን ፕሪንተር፣ USB፣ ዋይፋይ',
      notes: 'Integrated Android smart handhelds and desktop all-in-one cashier devices.',
      notesAm: 'ፕሪንተሩ አብሮት የተገጠመለት ዘመናዊ የእጅና የካሸር አንድሮይድ መሳሪያ።',
      status: '100% Certified',
      statusAm: 'የተረጋገጠ',
    },
    {
      brand: 'Rongta & Generic ESC/POS',
      models: 'RP326, RP80, RP820, ZJ-8250, any 80mm/58mm standard',
      connectivity: 'USB, LAN, Bluetooth, Serial COM',
      connectivityAm: 'USB፣ LAN፣ ብሉቱዝ',
      notes: 'Universal ESC/POS compatibility. Automatic cash drawer RJ11 12V/24V pulse kick supported.',
      notesAm: 'ማንኛውንም መደበኛ የESC/POS ፕሪንተርና በራሱ የሚከፈት የገንዘብ ሳጥን በቀጥታ ያዛል።',
      status: '100% Certified',
      statusAm: 'የተረጋገጠ',
    },
  ];

  const testedDevices = [
    {
      category: 'Android Tablets & Phones',
      categoryAm: 'አንድሮይድ ታብሌቶችና ስልኮች',
      models: 'Samsung Galaxy Tab (A7, A8, A9, Active), Lenovo Tab (M10, P11), Tecno, Infinix, Xiaomi',
      reqs: 'Android 9.0 or higher · 2GB+ RAM',
      reqsAm: 'አንድሮይድ 9.0 ወይም ከዚያ በላይ · 2GB+ ራም',
      role: 'Counter Cashier Terminal, Kitchen KDS, or Waiter Mobile Ordering',
      roleAm: 'ለካሸር ተርሚናል፣ ለወጥ ቤት ስክሪን ወይም ለአስተናጋጆች እጅ ስልክ',
    },
    {
      category: 'Apple iPads & iPhones',
      categoryAm: 'አፕል አይፓድ እና አይፎን',
      models: 'iPad 9th/10th Gen, iPad Air, iPad Mini, iPad Pro, iPhone 11 and newer',
      reqs: 'iOS / iPadOS 14.0 or higher · Safari / Chrome',
      reqsAm: 'iOS 14.0 ወይም ከዚያ በላይ · ሳፋሪ ወይም ክሮም',
      role: 'Premium Front Counter POS, Customer-Facing Display, Tableside Ordering',
      roleAm: 'ለዋና የካሸር ጠረጴዛ ወይም ለአስተናጋጆች ትዕዛዝ መመዝገቢያ',
    },
    {
      category: 'Windows Touch Terminals & PCs',
      categoryAm: 'ዊንዶውስ የንክኪ ተርሚናሎችና ፒሲ',
      models: '15.6" All-in-One Touchscreens (Intel J1900, Core i3/i5), Laptops, POS Desktops',
      reqs: 'Windows 10 / 11 · 4GB+ RAM · Google Chrome or Edge',
      reqsAm: 'ዊንዶውስ 10 ወይም 11 · 4GB+ ራም · ጎግል ክሮም',
      role: 'Heavy-traffic bar and restaurant cash counters with dual screen setups',
      roleAm: 'ከፍተኛ የደንበኛ መጨናነቅ ላለባቸው ባርና ሬስቶራንት ካሸሮች',
    },
  ];

  return (
    <MarketingLayout>
      <MarketingSEO
        title={isAm ? 'የሬስቶራንት እና የካፌ ካሸር እቃዎች ስብስብ | KushinaPOS Hardware' : 'Hospitality POS Hardware Bundles in Addis Ababa | KushinaPOS'}
        description={isAm ? 'ታብሌት፣ 80ሚሊ ፈጣን ደረሰኝ ፕሪንተር እና ጠንካራ የብረት ካሽ ቦክስ ከ1 አመት ሙሉ የአገር ውስጥ ዋስትና ጋር።' : 'Tested restaurant POS hardware in Ethiopia: Android touchscreens, auto-cutter 80mm thermal printers, heavy-duty cash drawers, and kitchen display mounts.'}
        canonicalUrl="/hardware"
      />

      {/* Hero Header */}
      <section className="pt-12 pb-16 md:py-20 bg-gradient-to-b from-surface-100 via-white to-surface-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 border-b border-surface-200/70 dark:border-surface-800/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200/80 dark:border-brand-800/80 text-brand-700 dark:text-brand-300 text-xs font-semibold uppercase tracking-wider mb-6">
            <Wrench className="w-4 h-4 text-brand-600" />
            <span>{isAm ? 'የተፈተኑ ጥራት ያላቸው እቃዎች' : 'Tested Commercial Grade Hardware'}</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-surface-900 dark:text-white max-w-4xl mx-auto mb-6">
            {isAm 
              ? 'ታብሌት፣ ፈጣን ፕሪንተር እና ካሽ ቦክስ ከ1 አመት ዋስትና ጋር' 
              : 'Reliable restaurant hardware built for heat, oil, and continuous rushes'}
          </h1>

          <p className="text-base sm:text-xl text-surface-600 dark:text-surface-300 max-w-3xl mx-auto leading-relaxed mb-8">
            {isAm
              ? 'በአዲስ አበባ ውስጥ በራሳችን ቴክኒሻኖች መጥተን እንገጥማለን፤ እናሰለጥናለን። እቃ ቢበላሽ ወዲያውኑ በአዲስ እንቀይራለን።'
              : 'Every bundle is pre-configured and tested in our Addis Ababa lab. Backed by 1-year local replacement warranty and complimentary on-site installation.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => openLeadModal({ interest: 'Hardware: Complete Bundle', sourcePage: 'hardware-hero' })}
              className="px-6 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-lg shadow-brand-600/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAm ? 'የእቃዎችን ማሳያ ይመልከቱ' : 'Book a hardware demo'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#bundles"
              className="px-6 py-3.5 rounded-xl bg-surface-200/80 dark:bg-surface-800 hover:bg-surface-300/80 dark:hover:bg-surface-700 text-surface-800 dark:text-surface-200 font-semibold transition-all"
            >
              {isAm ? 'የስብስቦች ዝርዝር' : 'View Bundles'}
            </a>
            <a
              href="#compatibility"
              className="px-6 py-3.5 rounded-xl bg-surface-100 dark:bg-surface-850 hover:bg-surface-200 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300 font-semibold transition-all"
            >
              {isAm ? 'የእቃዎች ተስማሚነት ዝርዝር' : 'Device Compatibility'}
            </a>
          </div>
        </div>
      </section>

      {/* 3 Hardware Bundles with Photos & Pre-selected CTAs */}
      <section id="bundles" className="py-16 md:py-24 bg-white dark:bg-surface-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-surface-900 dark:text-white mb-3">
              {isAm ? 'የተሟሉ የካሸር እና የወጥ ቤት እቃዎች ስብስቦች' : 'Tested Turnkey Hardware Bundles'}
            </h2>
            <p className="text-surface-600 dark:text-surface-400 text-sm sm:text-base">
              {isAm
                ? 'ከሳጥን ወጥተው ወዲያውኑ ስራ የሚጀምሩ፤ ከ1 አመት የአገር ውስጥ ዋስትና እና ነጻ ገጠማ ጋር።'
                : 'Plug-and-play packages with pre-installed KushinaPOS software and 1-year replacement warranty.'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {HARDWARE_BUNDLES.map((bundle) => (
              <div
                key={bundle.id}
                className="rounded-3xl p-6 sm:p-7 bg-surface-50 dark:bg-surface-850/60 border border-surface-200 dark:border-surface-800 flex flex-col justify-between hover:shadow-xl transition-all group"
              >
                <div>
                  {/* Bundle Product Photography */}
                  <div className="relative w-full h-56 rounded-2xl overflow-hidden mb-6 bg-surface-200 dark:bg-surface-800 border border-surface-200/80 dark:border-surface-700/80">
                    <img
                      src={bundle.image}
                      alt={bundle.name}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="px-3 py-1 rounded-full bg-surface-950/85 backdrop-blur-md text-white text-[11px] font-extrabold uppercase tracking-wider border border-white/10 shadow-sm">
                        {isAm ? bundle.badgeAm : bundle.badge}
                      </span>
                    </div>
                    <div className="absolute bottom-3 right-3">
                      <span className="px-3.5 py-1.5 rounded-xl bg-brand-600 text-white font-mono font-black text-sm shadow-md">
                        {bundle.price}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-display text-2xl font-bold text-surface-900 dark:text-white mb-2">
                    {isAm ? bundle.nameAm : bundle.name}
                  </h3>

                  <div className="text-3xl font-display font-black text-brand-600 dark:text-brand-400 mb-3 font-mono">
                    {bundle.price}
                  </div>

                  <p className="text-sm text-surface-600 dark:text-surface-400 mb-5 leading-relaxed">
                    {isAm ? bundle.descriptionAm : bundle.description}
                  </p>

                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 mb-6">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{isAm ? bundle.warrantyAm : bundle.warranty}</span>
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-surface-200/70 dark:border-surface-800/70">
                    <div className="text-xs font-bold uppercase tracking-wider text-surface-500 mb-2">
                      {isAm ? 'በስብስቡ ውስጥ የሚካተቱ እቃዎች' : 'Package Components'}
                    </div>
                    {bundle.includes.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-surface-800 dark:text-surface-200">
                        <CheckCircle2 className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
                        <span>{isAm ? item.nameAm : item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-surface-200 dark:border-surface-800">
                  <button
                    type="button"
                    onClick={() => openLeadModal({ 
                      interest: `Hardware: ${bundle.name} Bundle (${bundle.price})`, 
                      sourcePage: 'hardware_bundle_card' 
                    })}
                    className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-center text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-brand-600/20 active:scale-98"
                  >
                    <span>{isAm ? 'ይህን ስብስብ እዘዝ / ዋጋ ይጠይቁ' : `Order ${bundle.name} Bundle`}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <div className="text-center text-[11px] text-surface-500 mt-2.5">
                    {isAm ? 'አዲስ አበባ ውስጥ በነጻ እንገጥማለን እና እናሰለጥናለን' : 'Free on-site delivery & waiter training in Addis Ababa'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bring Your Own Device (BYOD) Section */}
      <section className="py-16 md:py-24 bg-surface-50 dark:bg-surface-950 border-t border-surface-200 dark:border-surface-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold uppercase tracking-wider">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isAm ? 'ምንም አይነት አስገዳጅ የእቃ ግዢ የለም' : 'Bring Your Own Device (BYOD) · Zero Lock-In'}</span>
              </div>

              <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-surface-900 dark:text-white leading-tight">
                {isAm 
                  ? 'የሶፍትዌሩ ፈቃድ በእጅዎ ባሉ ታብሌቶች፣ ስልኮች እና ኮምፒውተሮች ላይ ይሰራል' 
                  : 'The software runs on the tablet or phone you already have.'}
              </h2>

              <p className="text-sm sm:text-base text-surface-600 dark:text-surface-400 leading-relaxed">
                {isAm
                  ? 'ኩሽና ፖስ ማንኛውንም መደበኛ የጉግል ክሮም ወይም ሳፋሪ ብሮውዘር በመጠቀም ይሰራል፤ ወይም እንደ ተንቀሳቃሽ መተግበሪያ በቀጥታ ይጫናል። አዲስ እቃ መግዛት ሳይጠበቅብዎት በእጅዎ ያሉትን አንድሮይድ ታብሌቶች፣ አይፓዶች፣ የሰራተኞች ስልኮች እና የድሮ ደረሰኝ ፕሪንተሮች መጠቀም ይችላሉ። የቴክኒክ ባለሙያችን ነባር እቃዎችዎን በነጻ ያገናኛል።'
                  : 'Never feel pressured into expensive proprietary hardware contracts. KushinaPOS runs smoothly as a modern web app on any Android tablet, Apple iPad, Windows PC, or smartphone. If you already have thermal printers or cash drawers from a past system, our team will configure them for you at zero additional cost.'}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                <div className="p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-800 border border-surface-200/60 dark:border-surface-700/60 text-center">
                  <Smartphone className="w-5 h-5 text-brand-600 mx-auto mb-1.5" />
                  <div className="text-xs font-bold text-surface-900 dark:text-white">Android / iOS</div>
                  <div className="text-[11px] text-surface-500">{isAm ? 'የአስተናጋጆች ስልክ' : 'Waiter Smartphones'}</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-800 border border-surface-200/60 dark:border-surface-700/60 text-center">
                  <Tablet className="w-5 h-5 text-brand-600 mx-auto mb-1.5" />
                  <div className="text-xs font-bold text-surface-900 dark:text-white">Android & iPad</div>
                  <div className="text-[11px] text-surface-500">{isAm ? 'የካሸር ታብሌቶች' : 'Counter Tablets'}</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-800 border border-surface-200/60 dark:border-surface-700/60 text-center">
                  <Monitor className="w-5 h-5 text-brand-600 mx-auto mb-1.5" />
                  <div className="text-xs font-bold text-surface-900 dark:text-white">Windows 10/11</div>
                  <div className="text-[11px] text-surface-500">{isAm ? 'ኮምፒውተር / ላፕቶፕ' : 'Existing Laptops & PCs'}</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-800 border border-surface-200/60 dark:border-surface-700/60 text-center">
                  <Printer className="w-5 h-5 text-brand-600 mx-auto mb-1.5" />
                  <div className="text-xs font-bold text-surface-900 dark:text-white">ESC/POS 80mm</div>
                  <div className="text-[11px] text-surface-500">{isAm ? 'ነባር ፕሪንተሮች' : 'Existing Printers'}</div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 bg-brand-50 dark:bg-brand-950/40 p-6 sm:p-7 rounded-3xl border border-brand-200 dark:border-brand-800 text-center space-y-4">
              <h3 className="font-display font-bold text-surface-900 dark:text-white text-lg">
                {isAm ? 'የእቃዎችዎን ተስማሚነት በነጻ ያረጋግጡ' : 'Check Your Hardware Compatibility'}
              </h3>
              <p className="text-xs text-surface-600 dark:text-surface-400 leading-relaxed">
                {isAm 
                  ? 'የፕሪንተርዎን ወይም የታብሌትዎን ሞዴል ይንገሩን፤ በደቂቃዎች ውስጥ ከኩሽና ፖስ ጋር እንደሚሰራ እናረጋግጣለን።'
                  : 'Send a quick photo or model number of your current receipt printer and cash drawer to our Addis Ababa technical desk.'}
              </p>
              <div className="flex flex-col gap-2.5 pt-2">
                <a
                  href="https://t.me/kushinapos"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 rounded-xl bg-brand-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-brand-700 transition-colors inline-block shadow-sm"
                >
                  {isAm ? 'በቴሌግራም ፎቶ ይላኩልን (@kushinapos)' : 'Send photo via Telegram (@kushinapos)'}
                </a>
                <button
                  type="button"
                  onClick={() => openLeadModal({ interest: 'Bring Your Own Device (BYOD) Compatibility', sourcePage: 'hardware-byod-check' })}
                  className="w-full py-2.5 rounded-xl bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-700 text-surface-800 dark:text-surface-200 font-bold text-xs uppercase tracking-wider hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>{isAm ? 'የስልክ ጥሪ ይጠይቁ' : 'Request a callback'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Tested Compatibility List (Printers & Tablets) */}
      <section id="compatibility" className="py-16 md:py-24 bg-white dark:bg-surface-900 border-t border-surface-200/80 dark:border-surface-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-50 text-brand-700 border border-brand-200 mb-4">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
              <span>{isAm ? 'በተግባር የተፈተኑ መሳሪያዎች' : 'Tested & Certified Compatibility List'}</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-surface-900 dark:text-white mb-3">
              {isAm ? 'የተፈተኑ የደረሰኝ ፕሪንተሮች እና ስክሪኖች' : 'Tested Receipt Printers, Tablets & Terminals'}
            </h2>
            <p className="text-surface-600 dark:text-surface-400 text-sm sm:text-base">
              {isAm 
                ? 'በአዲስ አበባ ገበያ በብዛት የሚገኙና ከኩሽና ፖስ ጋር 100% ያለችግር የሚሰሩ መሳሪያዎች ዝርዝር።'
                : 'Directly verified by our engineering team for high-speed printing, auto-cutting, and zero driver headaches.'}
            </p>
          </div>

          <div className="space-y-12">
            {/* 1. Tested Printers Table */}
            <div>
              <h3 className="font-display font-bold text-xl text-surface-900 dark:text-white mb-4 flex items-center gap-2">
                <Printer className="w-5 h-5 text-brand-600" />
                <span>{isAm ? 'የተረጋገጡ የደረሰኝ ፕሪንተሮች (80ሚሊ እና 58ሚሊ)' : 'Tested Thermal Receipt Printers (80mm & 58mm)'}</span>
              </h3>
              
              <div className="overflow-x-auto rounded-2xl border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-850/60">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 dark:border-surface-800 bg-surface-100/60 dark:bg-surface-800 font-display font-bold text-surface-900 dark:text-white">
                      <th className="py-4 px-6">{isAm ? 'አምራች ድርጅት' : 'Brand'}</th>
                      <th className="py-4 px-6">{isAm ? 'የተፈተኑ ሞዴሎች' : 'Tested Models'}</th>
                      <th className="py-4 px-6">{isAm ? 'የግንኙነት አይነት' : 'Connectivity'}</th>
                      <th className="py-4 px-6">{isAm ? 'ማስታወሻ' : 'Performance Notes'}</th>
                      <th className="py-4 px-6 text-center">{isAm ? 'ሁኔታ' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-200 dark:divide-surface-800 text-surface-700 dark:text-surface-300">
                    {testedPrinters.map((printer, i) => (
                      <tr key={i} className="hover:bg-white dark:hover:bg-surface-800 transition-colors">
                        <td className="py-4 px-6 font-bold text-surface-900 dark:text-white whitespace-nowrap">
                          {printer.brand}
                        </td>
                        <td className="py-4 px-6 font-mono font-medium text-surface-800 dark:text-surface-200">
                          {printer.models}
                        </td>
                        <td className="py-4 px-6">
                          {isAm ? printer.connectivityAm : printer.connectivity}
                        </td>
                        <td className="py-4 px-6 text-xs leading-relaxed text-surface-600 dark:text-surface-400">
                          {isAm ? printer.notesAm : printer.notes}
                        </td>
                        <td className="py-4 px-6 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                            <Check className="w-3 h-3 text-emerald-600" />
                            {isAm ? printer.statusAm : printer.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Tested Tablets & Devices */}
            <div>
              <h3 className="font-display font-bold text-xl text-surface-900 dark:text-white mb-4 flex items-center gap-2">
                <Tablet className="w-5 h-5 text-brand-600" />
                <span>{isAm ? 'የተረጋገጡ ታብሌቶች፣ ስልኮች እና የንክኪ ስክሪኖች' : 'Tested Tablets, Phones & Touchscreen Terminals'}</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {testedDevices.map((dev, i) => (
                  <div 
                    key={i} 
                    className="p-6 rounded-2xl bg-surface-50 dark:bg-surface-850/60 border border-surface-200 dark:border-surface-800 flex flex-col justify-between"
                  >
                    <div>
                      <h4 className="font-display font-bold text-base text-surface-900 dark:text-white mb-2">
                        {isAm ? dev.categoryAm : dev.category}
                      </h4>
                      <p className="text-xs text-surface-600 dark:text-surface-400 mb-4 leading-relaxed">
                        <strong className="text-surface-800 dark:text-surface-200">Models:</strong> {dev.models}
                      </p>
                      <div className="p-2.5 rounded-xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-surface-700/60 text-xs mb-3 font-mono text-brand-700 dark:text-brand-300">
                        {isAm ? dev.reqsAm : dev.reqs}
                      </div>
                    </div>
                    <div className="pt-3 border-t border-surface-200/60 dark:border-surface-800 text-xs text-surface-500">
                      <span className="font-bold text-surface-700 dark:text-surface-300">{isAm ? 'ተስማሚ ሚና: ' : 'Best for: '}</span>
                      {isAm ? dev.roleAm : dev.role}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Internet & Power Setup Requirements */}
      <section className="py-16 md:py-24 bg-surface-50 dark:bg-surface-950 border-t border-surface-200/80 dark:border-surface-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-50 text-brand-700 border border-brand-200 mb-4">
              <Zap className="w-3.5 h-3.5 text-brand-600" />
              <span>{isAm ? 'የኔትወርክ እና የሃይል አቅርቦት' : 'Infrastructure Guidelines'}</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-surface-900 dark:text-white mb-3">
              {isAm ? 'የኢንተርኔት እና የመብራት ዝግጅት መመሪያ' : 'Internet & Power Setup Requirements'}
            </h2>
            <p className="text-surface-600 dark:text-surface-400 text-sm sm:text-base">
              {isAm 
                ? 'በኢትዮጵያ ውስጥ መብራት ወይም ኢንተርኔት ሲቋረጥ ስራዎ በምንም መልኩ እንዳይቆም የተደረገ አሰራር።'
                : 'Engineered for Ethiopian infrastructure realities: blackouts, load shedding, and telecom outages.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Internet Setup Card */}
            <div className="p-8 rounded-3xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-600 flex items-center justify-center">
                  <Wifi className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-xl text-surface-900 dark:text-white">
                    {isAm ? 'የኢንተርኔት እና የኔትወርክ ዝግጅት' : 'Internet & Local Network Setup'}
                  </h3>
                  <p className="text-xs text-surface-500">{isAm ? '100% ከመስመር ውጭ ይሰራል' : 'Runs 100% Offline Locally'}</p>
                </div>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-surface-600 dark:text-surface-300 leading-relaxed">
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-850/60 border border-surface-200/60 dark:border-surface-700/60">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-surface-900 dark:text-white block mb-0.5">
                      {isAm ? 'የውስጥ አካባቢያዊ ዋይፋይ (Local Wi-Fi Router):' : 'Local Wi-Fi Network (Zero Internet Needed):'}
                    </strong>
                    {isAm 
                      ? 'የካሸር ታብሌቶች፣ የወጥ ቤት ስክሪን KDS እና ፕሪንተሮች የሚግባቡት በሬስቶራንቱ ውስጥ ባለው ዋይፋይ ራውተር ነው። የኢትዮ ቴሌኮም ወይም የሳፋሪኮም ኢንተርኔት ሙሉ በሙሉ ቢቋረጥም ትዕዛዝ መስጠትና ደረሰኝ ማተም በጭራሽ አይቆምም።'
                      : 'Orders, waiter tablets, kitchen screens, and thermal printers communicate directly across your restaurant Wi-Fi router. If Ethio Telecom or Safaricom fiber cuts out, your frontline operations continue 100% uninterrupted.'}
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-850/60 border border-surface-200/60 dark:border-surface-700/60">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-surface-900 dark:text-white block mb-0.5">
                      {isAm ? 'እጅግ አነስተኛ የዳታ ፍጆታ (< 5 MB በቀን):' : 'Ultra-Low Bandwidth (< 5 MB / day):'}
                    </strong>
                    {isAm 
                      ? 'የክላውድ መረጃ ዝውውሩ እጅግ ቀላል በመሆኑ በመደበኛ 3G/4G የሞባይል ዳታ ሆትስፖት ያለምንም እክል ይሰራል፤ ከፍተኛ ወጪ አይጠይቅም።'
                      : 'Cloud synchronization transmits lightweight JSON data. A modest 3G/4G phone hotspot or basic broadband package is more than enough to sync live sales to your phone.'}
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-850/60 border border-surface-200/60 dark:border-surface-700/60">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-surface-900 dark:text-white block mb-0.5">
                      {isAm ? 'ኔትወርክ ሲመለስ በራሱ ማስተላለፍ (Auto-Sync):' : 'Conflict-Free Silent Cloud Sync:'}
                    </strong>
                    {isAm 
                      ? 'ኔትወርኩ በተመለሰበት ቅጽበት ከመስመር ውጭ የተመዘገቡት ሽያጮችና ደረሰኞች ያለምንም ውዥንብር በራሳቸው ወደ ማዕከላዊ ክላውድ ይተላለፋሉ።'
                      : 'When internet connectivity restores, all offline sales, time cards, and stock adjustments silently synchronize to the cloud in sequential order.'}
                  </div>
                </div>
              </div>
            </div>

            {/* Power & Load Shedding Setup Card */}
            <div className="p-8 rounded-3xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 flex items-center justify-center">
                  <BatteryCharging className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-xl text-surface-900 dark:text-white">
                    {isAm ? 'የመብራት እና የባትሪ አቅርቦት (Power Setup)' : 'Power & Blackout Resilience Setup'}
                  </h3>
                  <p className="text-xs text-surface-500">{isAm ? 'ለመብራት መቆራረጥ የተዘጋጀ' : 'Engineered for Load Shedding'}</p>
                </div>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-surface-600 dark:text-surface-300 leading-relaxed">
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-850/60 border border-surface-200/60 dark:border-surface-700/60">
                  <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-surface-900 dark:text-white block mb-0.5">
                      {isAm ? 'መደበኛ 220V የኤሌክትሪክ ሶኬት:' : 'Standard 220V AC Grid Power:'}
                    </strong>
                    {isAm 
                      ? 'ሁሉም እቃዎች በኢትዮጵያ መደበኛ 220V/50Hz የኤሌክትሪክ መስመርና ባለ ሁለት ፒን ሶኬት (Type C/F) ይሰራሉ።'
                      : 'Tablets, thermal printers, and cash drawers plug into ordinary Ethiopian 220V AC wall outlets with universal Type C and F plug adapters.'}
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-850/60 border border-surface-200/60 dark:border-surface-700/60">
                  <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-surface-900 dark:text-white block mb-0.5">
                      {isAm ? 'ከ6 እስከ 10 ሰዓት የውስጥ ባትሪ ቆይታ:' : '6 to 10 Hours Internal Tablet Battery:'}
                    </strong>
                    {isAm 
                      ? 'ታብሌቶችና ስልኮች የራሳቸው ጠንካራ ባትሪ ስላላቸው መብራት በጠፋበት ሰዓት ጄኔሬተር እስኪነሳ ወይም ቀኑን ሙሉ ያለማቋረጥ ስራቸውን ይቀጥላሉ።'
                      : 'Touchscreen tablets and waiter smartphones maintain 6–10 hours of active charge on internal lithium batteries, powering through power interruptions.'}
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-850/60 border border-surface-200/60 dark:border-surface-700/60">
                  <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-surface-900 dark:text-white block mb-0.5">
                      {isAm ? 'የሚመከር ሚኒ-ዩፒኤስ (Mini-UPS) ለፕሪንተር እና ራውተር:' : 'Recommended Mini-UPS for 4–6h Blackout Coverage:'}
                    </strong>
                    {isAm 
                      ? 'በአዲስ አበባ ገበያ በ3,500 ብር የሚገኝ አነስተኛ ሚኒ-ዩፒኤስ (12V/24V) በመጠቀም የዋይፋይ ራውተርዎን እና የደረሰኝ ፕሪንተሩን መብራት ቢጠፋም ለ4-6 ሰዓት ያለማቋረጥ ማንቀሳቀስ ይችላሉ።'
                      : 'We recommend adding an affordable 12V/24V mini-UPS battery backup (~3,500 ETB in Addis Ababa) to keep your Wi-Fi router and 80mm thermal receipt printer live through power cuts.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final Hardware Consultation Banner */}
      <section className="py-16 bg-white dark:bg-surface-900 border-t border-surface-200/80 dark:border-surface-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-brand-600 via-brand-700 to-emerald-700 text-white shadow-xl text-center space-y-6">
            <h2 className="font-display font-bold text-2xl sm:text-4xl">
              {isAm ? 'ለሬስቶራንትዎ ትክክለኛውን የእቃዎች ስብስብ አብረን እንምረጥ' : 'Ready to configure the ideal hardware setup for your restaurant?'}
            </h2>
            <p className="text-brand-100 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
              {isAm 
                ? 'የእኛ የአዲስ አበባ ቴክኒክ ቡድን ወደ ሬስቶራንትዎ መጥቶ ቦታውን ይመለከታል፤ ያሉዎትን እቃዎች ፈትሾ ትክክለኛውን ምክር ይሰጥዎታል።'
                : 'Our Addis Ababa technicians visit your dining hall in person, audit your counter space and Wi-Fi coverage, and assemble a guaranteed quote.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => openLeadModal({ interest: 'Full Hardware Consultation & Quote', sourcePage: 'hardware_bottom_cta' })}
                className="px-7 py-3.5 rounded-2xl bg-white text-surface-900 font-extrabold text-sm hover:bg-surface-100 transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-brand-600" />
                <span>{isAm ? 'የነጻ የቦታው ዳሰሳ ቀጠሮ ይያዙ' : 'Book Free On-Site Inspection'}</span>
              </button>
              <a
                href="tel:+251911234567"
                className="px-6 py-3.5 rounded-2xl bg-surface-900/40 hover:bg-surface-900/60 border border-white/20 text-white font-bold text-sm transition-all flex items-center gap-2"
              >
                <PhoneCall className="w-4 h-4" />
                <span>{isAm ? '+251 911 234 567 ደውለው ያነጋግሩን' : 'Call Support: +251 911 234 567'}</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
