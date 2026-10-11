import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Headphones, PhoneCall, Send, MessageSquare, MapPin, 
  BookOpen, Users, Video, ShieldCheck, ArrowRight, Clock, CheckCircle2 
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import MarketingLayout from './components/MarketingLayout';
import MarketingSEO from './components/MarketingSEO';

export default function SupportPage() {
  const { lang } = useLanguage();
  const isAm = lang === 'am';

  const channels = [
    {
      title: 'Telegram Dedicated Channel',
      titleAm: 'የቴሌግራም የቀጥታ ድጋፍ',
      desc: 'Instant replies from our Addis Ababa support engineers. Send voice notes, photos of printer issues, and get live troubleshooting.',
      descAm: 'የቴክኒክ ባለሙያዎቻችን በሰከንዶች ውስጥ ምላሽ ይሰጣሉ። የፕሪንተር ችግር ሲያጋጥም ፎቶ ወይም ድምጽ ልከው ፈጣን መፍትሄ ያገኛሉ።',
      contact: '@kushinapos',
      link: 'https://t.me/kushinapos',
      icon: <Send className="w-6 h-6 text-sky-500" />,
      badge: 'Fastest Response',
      badgeAm: 'ፈጣን ምላሽ',
    },
    {
      title: 'Direct Phone Hotline',
      titleAm: 'የስልክ ጥሪ መስመር',
      desc: 'Speak directly in Amharic with an engineer who understands restaurant rush pressures and till hardware emergencies.',
      descAm: 'በምሳ ወይም በእራት ሰዓት አጣዳፊ የካሽ ወይም የፕሪንተር ችግር ሲያጋጥም በቀጥታ ስልክ ደውለው በአማርኛ ይነጋገሩ።',
      contact: '+251 91 100 0000',
      link: 'tel:+251911000000',
      icon: <PhoneCall className="w-6 h-6 text-emerald-500" />,
      badge: '7 Days a Week',
      badgeAm: 'በሳምንት 7 ቀናት',
    },
    {
      title: 'WhatsApp Business Support',
      titleAm: 'የዋትስአፕ ንግድ ድጋፍ',
      desc: 'Connect with our operations desk for invoice questions, subscription renewals, or multi-branch hardware inquiries.',
      descAm: 'ለደረሰኝ ጥያቄዎች፣ የደንበኝነት ክፍያ ማደሻ ወይም ተጨማሪ እቃዎች ለማዘዝ በዋትስአፕ ያነጋግሩን።',
      contact: '+251 91 100 0000',
      link: 'https://wa.me/251911000000',
      icon: <MessageSquare className="w-6 h-6 text-green-500" />,
      badge: 'Business Desk',
      badgeAm: 'የስራ መስመር',
    },
    {
      title: 'On-Site Restaurant Dispatch',
      titleAm: 'በቦታው ድረስ የሚመጣ ቴክኒሻን',
      desc: 'Physical field support across Addis Ababa sub-cities (Bole, Kazanchis, Piassa, Sarbet, CMC, Lebu) with hardware swap units.',
      descAm: 'አዲስ አበባ ውስጥ (ቦሌ፣ ካዛንቺስ፣ ፒያሳ፣ ሳርቤት፣ ሲኤምሲ፣ ለቡ) እቃ ቢበላሽ በቦታው ድረስ መጥተን በአዲስ እንቀይራለን።',
      contact: 'Addis Ababa Field Service',
      link: '/contact',
      icon: <MapPin className="w-6 h-6 text-red-500" />,
      badge: 'Local Technicians',
      badgeAm: 'የአገር ውስጥ ባለሙያዎች',
    },
  ];

  const trainingModules = [
    {
      title: 'Cashier Till Training (15 mins)',
      titleAm: 'የካሸር ስልጠና (15 ደቂቃ)',
      desc: 'Opening shifts, 2-tap food entry, Telebirr & CBE Birr checkouts, and blind cash closing.',
      descAm: 'ፈረቃ መክፈት፣ ፈጣን ሽያጭ፣ የቴሌብርና ሲቢኢ ብር ክፍያ መቀበል እና የካሽ ማጠቃለያ።',
      icon: <Users className="w-5 h-5 text-brand-600" />,
    },
    {
      title: 'Kitchen Chef KDS Navigation (10 mins)',
      titleAm: 'የወጥ ቤት ባለሙያዎች ስልጠና (10 ደቂቃ)',
      desc: 'Reading color timers, splitting grill vs stew tickets, and bumping orders when served.',
      descAm: 'የሰዓት ቀለሞችን መረዳት፣ ጥብስ እና ወጥ ለይቶ ማብሰል እና ሲያልቅ በጣት መንካት።',
      icon: <Video className="w-5 h-5 text-brand-600" />,
    },
    {
      title: 'Manager Menu & Pricing Edits (20 mins)',
      titleAm: 'የማናጀር ስልጠና (20 ደቂቃ)',
      desc: 'Adding seasonal fasting dishes, 86 out-of-stock items, reviewing void audit logs, and Z-reports.',
      descAm: 'የጾም ምግብ መጨመር፣ ያለቀ እቃ ማንሳት፣ የተሰረዙ ሂሳቦችን መቆጣጠር እና የቀን ሪፖርት።',
      icon: <BookOpen className="w-5 h-5 text-brand-600" />,
    },
  ];

  return (
    <MarketingLayout>
      <MarketingSEO
        title={isAm ? 'የእርዳታ ማዕከል እና የቴክኒክ ድጋፍ | KushinaPOS Support' : 'Hospitality Support: Telegram, Phone & On-Site Training | KushinaPOS'}
        description={isAm ? 'በአማርኛ ቋንቋ የሚሰጥ የቴክኒክ ድጋፍ፣ የሰራተኞች ስልጠና፣ የቴሌግራም እና የስልክ መስመር። አዲስ አበባ ውስጥ በቦታው ደርሰን እንረዳለን።' : 'Get immediate restaurant POS support in Addis Ababa: Telegram @kushinapos, phone +251 91 100 0000, hands-on Amharic staff training, and on-site hardware dispatch.'}
        canonicalUrl="/support"
      />

      {/* Hero Header */}
      <section className="pt-12 pb-16 md:py-20 bg-gradient-to-b from-surface-100 via-white to-surface-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 border-b border-surface-200/70 dark:border-surface-800/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200/80 dark:border-brand-800/80 text-brand-700 dark:text-brand-300 text-xs font-semibold uppercase tracking-wider mb-6">
            <Headphones className="w-4 h-4 text-brand-600" />
            <span>{isAm ? 'የ24/7 የቴክኒክ እና የስራ ድጋፍ' : 'Local Support That Never Sleeps'}</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-surface-900 dark:text-white max-w-4xl mx-auto mb-6">
            {isAm 
              ? 'በአማርኛ የሚሰጥ ፈጣን የቴክኒክ ድጋፍ እና የሰራተኞች ስልጠና' 
              : 'Addis Ababa support engineers ready when your dining room is packed'}
          </h1>

          <p className="text-base sm:text-xl text-surface-600 dark:text-surface-300 max-w-3xl mx-auto leading-relaxed mb-8">
            {isAm
              ? 'በምሳ ወይም በእራት ሰዓት ድጋፍ ሲፈልጉ የትም አንሄድም። በቴሌግራም፣ በስልክ ወይም በቦታው ድረስ በመምጣት ችግሩን በደቂቃዎች ውስጥ እንፈታለን።'
              : 'No waiting 48 hours for overseas email tickets. When your receipt printer drops or a cashier forgets their PIN, our local team resolves it in minutes.'}
          </p>
        </div>
      </section>

      {/* 4 Support Channels */}
      <section className="py-16 md:py-24 bg-white dark:bg-surface-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {channels.map((ch, idx) => (
              <div
                key={idx}
                className="rounded-3xl p-8 bg-surface-50 dark:bg-surface-850/60 border border-surface-200 dark:border-surface-800 flex flex-col justify-between hover:border-brand-500/50 transition-all"
              >
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-3 rounded-2xl bg-white dark:bg-surface-800 shadow-xs border border-surface-200/60 dark:border-surface-700">
                      {ch.icon}
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
                      {isAm ? ch.badgeAm : ch.badge}
                    </span>
                  </div>

                  <h3 className="font-display text-lg font-bold text-surface-900 dark:text-white mb-2">
                    {isAm ? ch.titleAm : ch.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-surface-600 dark:text-surface-400 leading-relaxed mb-6">
                    {isAm ? ch.descAm : ch.desc}
                  </p>
                </div>

                <div className="pt-4 border-t border-surface-200 dark:border-surface-800">
                  <a
                    href={ch.link}
                    target={ch.link.startsWith('http') ? '_blank' : '_self'}
                    rel="noreferrer"
                    className="w-full py-3 rounded-xl bg-white dark:bg-surface-800 hover:bg-brand-600 hover:text-white border border-surface-200 dark:border-surface-700 font-bold text-xs text-center text-surface-900 dark:text-white transition-all block"
                  >
                    {ch.contact}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Staff Training & Onboarding in Amharic */}
      <section className="py-16 md:py-24 bg-surface-50 dark:bg-surface-950 border-t border-surface-200 dark:border-surface-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-2 block">
              {isAm ? 'የሰራተኞች ስልጠና' : 'Hands-On Onboarding'}
            </span>
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-surface-900 dark:text-white mb-4">
              {isAm 
                ? 'ሰራተኞችዎ በ30 ደቂቃ ውስጥ ሲስተሙን ሙሉ በሙሉ ይለምዱታል' 
                : 'Staff proficient in 30 minutes, 100% in Amharic'}
            </h2>
            <p className="text-surface-600 dark:text-surface-400 text-sm sm:text-base leading-relaxed">
              {isAm
                ? 'ካሸሮች፣ አስተናጋጆች እና የወጥ ቤት ባለሙያዎች በራሳቸው ቋንቋ በቀላሉ እንዲጠቀሙ የተዘጋጀ ተግባራዊ ስልጠና እንሰጣለን።'
                : 'We understand the high turnover reality of restaurant staff. KushinaPOS is so intuitive that a new waiter or cashier operates confidently within half an hour.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {trainingModules.map((mod, idx) => (
              <div
                key={idx}
                className="p-8 rounded-3xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-xs"
              >
                <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/80 flex items-center justify-center mb-6">
                  {mod.icon}
                </div>
                <h3 className="font-display text-lg font-bold text-surface-900 dark:text-white mb-3">
                  {isAm ? mod.titleAm : mod.title}
                </h3>
                <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                  {isAm ? mod.descAm : mod.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
