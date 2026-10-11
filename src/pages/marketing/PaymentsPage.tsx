import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Smartphone, Building2, Banknote, CreditCard, ShieldCheck, 
  CheckCircle2, ArrowRight, Zap, QrCode, AlertTriangle, FileSpreadsheet
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import MarketingLayout from './components/MarketingLayout';
import MarketingSEO from './components/MarketingSEO';
import { PAYMENT_METHODS } from './data/marketingData';
import { useLeadModal } from './context/LeadModalContext';

export default function PaymentsPage() {
  const { lang } = useLanguage();
  const isAm = lang === 'am';
  const { openLeadModal } = useLeadModal();

  const iconMap: Record<string, React.ReactNode> = {
    Smartphone: <Smartphone className="w-6 h-6 text-brand-600 dark:text-brand-400" />,
    Building2: <Building2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />,
    Banknote: <Banknote className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />,
    CreditCard: <CreditCard className="w-6 h-6 text-blue-600 dark:text-blue-400" />,
    Zap: <Zap className="w-6 h-6 text-amber-600 dark:text-amber-400" />,
  };

  return (
    <MarketingLayout>
      <MarketingSEO
        title={isAm ? 'የክፍያ ዘዴዎች (ቴሌብር፣ ሲቢኢ ብር፣ ጥሬ ገንዘብ) | KushinaPOS' : 'Ethiopian Payment Integration: Telebirr, CBE Birr, Cash & Banks | KushinaPOS'}
        description={isAm ? 'የቴሌብር QR ኮድ፣ የሲቢኢ ብር ክፍያ፣ ጥሬ ገንዘብ እና ቀጥታ የባንክ ዝውውርን ያለስህተት የሚያስተናግድና ማጭበርበርን የሚከላከል ሲስተም።' : 'Native Ethiopian payment acceptance: Telebirr dynamic QR, CBE Birr instant pay, smart cash drawer calculations, and verified bank transfers.'}
        canonicalUrl="/payments"
      />

      {/* Hero Header */}
      <section className="pt-12 pb-16 md:py-20 bg-gradient-to-b from-surface-100 via-white to-surface-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 border-b border-surface-200/70 dark:border-surface-800/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200/80 dark:border-brand-800/80 text-brand-700 dark:text-brand-300 text-xs font-semibold uppercase tracking-wider mb-6">
            <ShieldCheck className="w-4 h-4 text-brand-600" />
            <span>{isAm ? 'እውነተኛ የኢትዮጵያ የክፍያ አማራጮች' : 'Real Ethiopian Payment Ecosystem'}</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-surface-900 dark:text-white max-w-4xl mx-auto mb-6">
            {isAm 
              ? 'ቴሌብር፣ ሲቢኢ ብር እና ጥሬ ገንዘብ ያለስህተትና ማጭበርበር' 
              : 'Accept every local payment with zero reconciliation headache'}
          </h1>

          <p className="text-base sm:text-xl text-surface-600 dark:text-surface-300 max-w-3xl mx-auto leading-relaxed mb-8">
            {isAm
              ? 'የውሸት የክፍያ ስክሪንሾት ማጭበርበርን ያስቁሙ። በቴሌብር፣ ሲቢኢ ብር፣ ጥሬ ገንዘብ እና በባንክ ዝውውር የሚገቡ ክፍያዎች በሰከንዶች ውስጥ ይረጋገጣሉ።'
              : 'Stop counterfeit transaction screenshot scams forever. KushinaPOS verifies real payment reference codes and generates exact-amount dynamic QR codes.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => openLeadModal({ interest: 'Telebirr & CBE Payment Integration', sourcePage: 'payments-hero' })}
              className="px-6 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-lg shadow-brand-600/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>{isAm ? 'የክፍያ ማሳያ ይመልከቱ' : 'See live payment demo'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <Link
              to="/pricing"
              className="px-6 py-3.5 rounded-xl bg-surface-200/80 dark:bg-surface-800 hover:bg-surface-300/80 dark:hover:bg-surface-700 text-surface-800 dark:text-surface-200 font-semibold transition-all"
            >
              {isAm ? 'የዋጋ ዝርዝር' : 'Pricing Plans'}
            </Link>
          </div>
        </div>
      </section>

      {/* Payment Methods Grid */}
      <section className="py-16 md:py-24 bg-white dark:bg-surface-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {PAYMENT_METHODS.map((method) => (
              <div
                key={method.id}
                className="rounded-3xl p-8 bg-surface-50 dark:bg-surface-850/60 border border-surface-200 dark:border-surface-800 flex flex-col justify-between hover:shadow-lg transition-all"
              >
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-3 rounded-2xl bg-white dark:bg-surface-800 shadow-xs border border-surface-200/60 dark:border-surface-700">
                      {iconMap[method.icon] || <Smartphone className="w-6 h-6 text-brand-600" />}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
                      {isAm ? method.badgeAm : method.badge}
                    </span>
                  </div>

                  <h3 className="font-display text-xl font-bold text-surface-900 dark:text-white mb-1">
                    {isAm ? method.nameAm : method.name}
                  </h3>
                  <div className="text-xs text-surface-500 mb-4 font-medium">
                    {method.provider} • {isAm ? method.typeAm : method.type}
                  </div>

                  <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                    {isAm ? method.descAm : method.desc}
                  </p>
                </div>

                <div className="mt-8 pt-4 border-t border-surface-200 dark:border-surface-800 flex items-center justify-between text-xs font-semibold">
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isAm ? 'በሲስተሙ ሙሉ በሙሉ ይሰራል' : 'Native POS Integration'}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Anti-Fraud Protection Deep-Dive */}
      <section className="py-16 md:py-24 bg-surface-50 dark:bg-surface-950 border-t border-surface-200 dark:border-surface-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-surface-900 to-surface-950 text-white border border-surface-800 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-800/80 text-red-300 text-xs font-semibold uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span>{isAm ? 'የውሸት ደረሰኝ ማጭበርበርን መከላከል' : 'Fraud Prevention Engine'}</span>
              </div>

              <h2 className="font-display text-2xl sm:text-4xl font-bold">
                {isAm 
                  ? 'የተሰራጩ የፎቶሾፕ ደረሰኞችን እና የድሮ ስክሪንሾቶችን እንዴት እንደሚያስቀር' 
                  : 'How Kushina stops fake payment screenshot scams'}
              </h2>

              <p className="text-sm sm:text-base text-surface-300 leading-relaxed">
                {isAm
                  ? 'ብዙ ሬስቶራንቶች ደንበኞች የድሮ የቴሌብር ክፍያ ስክሪንሾት በማሳየት ምግብ በልተው ሲሄዱ ከፍተኛ ኪሳራ ያጋጥማቸዋል። ኩሽና ፖስ እያንዳንዱን የክፍያ ቁጥር (Reference Code) በሲስተሙ ውስጥ ያጣራል፤ ተመሳሳይ ቁጥር ለሁለተኛ ጊዜ እንዳይገባ ይከለክላል።'
                  : 'Unethical diners frequently show old saved Telebirr screenshots or edited images to hurried waiters during peak hours. KushinaPOS enforces cryptographic unique reference deduplication—the same transaction ID cannot be recorded twice across any terminal.'}
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3 text-sm text-surface-200">
                  <CheckCircle2 className="w-5 h-5 text-brand-400 shrink-0" />
                  <span>{isAm ? 'ተመሳሳይ የማረጋገጫ ቁጥር በድጋሚ አይቀበልም' : 'Duplicate Reference Number Lockout'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-surface-200">
                  <CheckCircle2 className="w-5 h-5 text-brand-400 shrink-0" />
                  <span>{isAm ? 'የትክክለኛውን ሂሳብ መጠን የያዘ QR ኮድ ያወጣል' : 'Exact Bill Amount Encoded in Dynamic QR'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-surface-200">
                  <CheckCircle2 className="w-5 h-5 text-brand-400 shrink-0" />
                  <span>{isAm ? 'የቀን ማጠቃለያ የባንክ እና የቴሌብር ዝርዝር ሪፖርት' : 'Auditable Z-Report Breakdown for Bank Reconciliation'}</span>
                </div>
              </div>
            </div>

            {/* Visual simulation card */}
            <div className="bg-surface-900 p-6 sm:p-8 rounded-2xl border border-surface-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between text-xs text-surface-400 border-b border-surface-800 pb-3">
                <span className="font-mono">TELEBIRR_VERIFY_CHECK</span>
                <span className="text-emerald-400 font-bold">VERIFIED</span>
              </div>

              <div className="p-4 rounded-xl bg-surface-950 border border-emerald-500/40 text-center space-y-2">
                <div className="text-xs text-surface-400">Order #142 • Bill Amount: 1,450.00 ETB</div>
                <div className="text-lg font-mono font-bold text-white tracking-wider">REF: TB241011983021</div>
                <div className="text-xs text-emerald-400 font-semibold flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Telebirr Push Confirmed • Cash Drawer Unlocked</span>
                </div>
              </div>

              <div className="text-xs text-surface-400 leading-relaxed text-center">
                {isAm 
                  ? 'ካሸሮች በስልካቸው ረጅም መልእክት ማየት ሳያስፈልጋቸው በሲስተሙ ስክሪን ላይ ክፍያው መረጋገጡን ያያሉ።'
                  : 'Waiters and cashiers no longer crowd around a single personal phone to verify incoming SMS texts.'}
              </div>
            </div>

          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
