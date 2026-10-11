import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, ArrowLeft, EyeOff } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import MarketingLayout from './components/MarketingLayout';
import MarketingSEO from './components/MarketingSEO';

export default function PrivacyPage() {
  const { lang } = useLanguage();
  const isAm = lang === 'am';

  return (
    <MarketingLayout>
      <MarketingSEO
        title={isAm ? 'የግላዊነት ፖሊሲ እና የመረጃ ጥበቃ | KushinaPOS Privacy Policy' : 'Privacy Policy & Data Protection | KushinaPOS Ethiopia'}
        description={isAm ? 'ኩሽና ፖስ የሬስቶራንትዎን እና የደንበኞችዎን መረጃ እንዴት እንደሚጠብቅ የተዘጋጀ ፖሊሲ።' : 'Learn how KushinaPOS protects restaurant transactions, staff credentials, and customer information with zero third-party data selling.'}
        canonicalUrl="/privacy"
      />

      <section className="py-16 md:py-24 bg-white dark:bg-surface-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-surface-600 dark:text-surface-400 hover:text-brand-600 dark:hover:text-brand-400 mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isAm ? 'ወደ ዋናው ገጽ ተመለስ' : 'Back to Home'}</span>
          </Link>

          <div className="border-b border-surface-200 dark:border-surface-800 pb-8 mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 text-xs font-semibold uppercase tracking-wider mb-4">
              <Lock className="w-4 h-4 text-brand-600" />
              <span>{isAm ? 'የመረጃ ጥበቃ' : 'Privacy & Security'}</span>
            </div>
            <h1 className="font-display text-3xl sm:text-5xl font-bold text-surface-900 dark:text-white mb-3">
              {isAm ? 'የግላዊነት ፖሊሲ' : 'Privacy Policy'}
            </h1>
            <p className="text-sm text-surface-500">
              {isAm ? 'የመጨረሻ ማሻሻያ፡ ጥቅምት 2026' : 'Last Updated: October 2026 • Addis Ababa, Ethiopia'}
            </p>
          </div>

          <div className="prose prose-surface dark:prose-invert max-w-none space-y-8 text-surface-700 dark:text-surface-300 text-sm sm:text-base leading-relaxed">
            <div>
              <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-3">
                {isAm ? '1. የምንሰበስባቸው መረጃዎች' : '1. Information We Collect'}
              </h2>
              <p>
                {isAm
                  ? 'የምንሰበስበው ሲስተሙን በአግባቡ ለማስኬድ የሚያስፈልጉ መረጃዎችን ብቻ ነው፡ የሬስቶራንትዎን ስም፣ የአስተዳዳሪውን ስልክ ቁጥር፣ የምግብ ዝርዝሮችን እና የሽያጭ ደረሰኞችን። ምንም አይነት የባንክ ሚስጥር ቁጥር አንጠይቅም ወይም አናስቀምጥም።'
                  : 'We collect only essential operational data required to deliver point-of-sale functionality: venue business name, manager contact telephone, menu catalogs, table configurations, and order receipts. We do not store sensitive bank PINs or Telebirr customer passwords.'}
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-3">
                {isAm ? '2. ኩኪዎች እና የስታቲስቲክስ መረጃዎች (Cookies & Analytics)' : '2. Cookie Usage & Analytics'}
              </h2>
              <p>
                {isAm
                  ? 'በድረ-ገጻችን ላይ መሰረታዊ የቋንቋ ምርጫዎችን (አማርኛ ወይም እንግሊዝኛ) ለማስታወስ ኩኪዎችን እንጠቀማለን። የትንታኔ (Analytics) ኩኪዎች የሚሰሩት እርስዎ በግልጽ "እስማማለሁ" ብለው ሲመርጡ ብቻ ነው።'
                  : 'We use necessary cookies solely to retain user preferences such as your language selection (Amharic or English) and session authentication. Optional telemetry or performance analytics are activated only after you provide explicit consent via the cookie banner.'}
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-3">
                {isAm ? '3. መረጃን ለሶስተኛ ወገን አለማስተላለፍ' : '3. Zero Data Brokerage or Selling'}
              </h2>
              <p>
                {isAm
                  ? 'የሬስቶራንትዎን ገቢ፣ የምግብ አሰራር ሚስጥር ወይም የደንበኞችዎን ስልክ ለሶስተኛ ወገን፣ ለማስታወቂያ ሰሪዎች ወይም ለተፎካካሪ ድርጅቶች በፍጹም አናስተላልፍም ወይም አንሸጥም።'
                  : 'We maintain a strict zero-sale data policy. Your recipe quantities, profit margins, pricing strategy, and guest customer contact information will never be monetized, shared, or brokered to advertising agencies or industry competitors.'}
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-3">
                {isAm ? '4. የመረጃ ደህንነት እና ሚስጥራዊነት' : '4. Storage Security & Encryption'}
              </h2>
              <p>
                {isAm
                  ? 'ሁሉም መረጃዎች በጠንካራ የኢንክሪፕሽን (Encryption) ዘዴ የተጠበቁ ናቸው። የሰራተኞች ሚስጥር ቁጥሮች (PIN) በክሪፕቶግራፊ ተደብቀው ስለሚቀመጡ ማንም ሰው ሊያያቸው አይችልም።'
                  : 'All transactions transmitted between local restaurant terminals and cloud synchronization endpoints utilize industry-standard TLS encryption. Staff authentication PINs are cryptographically hashed and cannot be inspected in plaintext.'}
              </p>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
