import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Monitor, LayoutGrid, CalendarDays, QrCode, Layers, 
  BarChart3, Users, WifiOff, CheckCircle2, ArrowRight, 
  Sparkles, ShieldCheck, Clock, Smartphone, Receipt, ChevronRight
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import MarketingLayout from './components/MarketingLayout';
import MarketingSEO from './components/MarketingSEO';
import { useLeadModal } from './context/LeadModalContext';

interface FeaturePillar {
  id: string;
  name: string;
  nameAm: string;
  headline: string;
  headlineAm: string;
  badge: string;
  badgeAm: string;
  icon: React.ReactNode;
  summary: string;
  summaryAm: string;
  bullets: { title: string; titleAm: string; desc: string; descAm: string }[];
  technicalPill: string;
  technicalPillAm: string;
}

export default function FeaturesPage() {
  const { lang } = useLanguage();
  const isAm = lang === 'am';
  const { openLeadModal } = useLeadModal();
  const [activeTab, setActiveTab] = useState<string>('kds');

  const pillars: FeaturePillar[] = [
    {
      id: 'kds',
      name: 'Kitchen Display (KDS)',
      nameAm: 'የወጥ ቤት ስክሪን (KDS)',
      headline: 'Digitize orders and eliminate grease-stained lost tickets',
      headlineAm: 'ትዕዛዞችን በዲጂታል ስክሪን በመላክ የወረቀት መጥፋትን ያስቀሩ',
      badge: 'Zero Ticket Loss',
      badgeAm: 'ትዕዛዝ አይጠፋም',
      icon: <Monitor className="w-5 h-5" />,
      summary: 'Replace loud shouting and handwritten tickets with a color-coded touch screen. Stations for grill, stew, beverage, and expo see exactly what to make and when.',
      summaryAm: 'ጩኸትንና በእጅ የሚጻፉ ወረቀቶችን በቀለም በተለየ የወጥ ቤት ስክሪን ይተኩ። የጥብስ፣ የወጥ እና የመጠጥ ክፍሎች የየራሳቸውን ትዕዛዝ በግልጽ ይመለከታሉ።',
      bullets: [
        {
          title: 'Color-Coded Aging Timers',
          titleAm: 'የቀለም ቅንብር ያላቸው የሰዓት ቆጣሪዎች',
          desc: 'Green (under 5m), Yellow (5-12m), and Red flashing (over 15m) so kitchen chiefs catch delayed tickets before customers complain.',
          descAm: 'አረንጓዴ (ከ5 ደቂቃ በታች)፣ ቢጫ (5-12 ደቂቃ) እና ቀይ የሚያበራ (ከ15 ደቂቃ በላይ) በማሳየት መዘግየትን ይከላከላል።',
        },
        {
          title: 'Multi-Station Routing',
          titleAm: 'ትዕዛዝን ለየክፍሉ መከፋፈል',
          desc: 'One ticket splits automatically: Tibs goes to the meat grill, salad to the cold prep station, and wine to the bar counter.',
          descAm: 'አንድ ትዕዛዝ በራሱ ይከፈላል፤ ጥብስ ለስጋ መጥበሻ፣ ሰላጣ ለቀዝቃዛ ምግብ፣ ወይን ደግሞ ለባር ይላካል።',
        },
        {
          title: 'Audible Kitchen Chime Alert',
          titleAm: 'ከፍተኛ ድምጽ ያለው የወጥ ቤት ደወል',
          desc: 'Distinct acoustic alerts pierce through kitchen exhaust fans whenever a new order or item modification arrives.',
          descAm: 'አዲስ ትዕዛዝ ወይም ለውጥ ሲመጣ የወጥ ቤቱን ድምጽ ሰብሮ የሚሰማ የማንቂያ ድምጽ ያሰማል።',
        },
      ],
      technicalPill: 'ESC/POS LAN Printer & WebSocket Kitchen Sync',
      technicalPillAm: 'በኔትወርክ እና በገመድ አልባ ቀጥታ የሚገናኝ',
    },
    {
      id: 'tables',
      name: 'Tables & Floor Map',
      nameAm: 'የጠረጴዛዎች ህያው ካርታ',
      headline: 'Interactive visual dining rooms with live table occupancy',
      headlineAm: 'የጠረጴዛዎችን ሁኔታ በህያው ካርታ መቆጣጠር',
      badge: 'Visual Seating',
      badgeAm: 'ግልጽ የመቀመጫ ካርታ',
      icon: <LayoutGrid className="w-5 h-5" />,
      summary: 'Replicate your physical dining floor layout accurately. Hostesses seat guests with one tap, and floor managers instantly see dining durations.',
      summaryAm: 'የሬስቶራንትዎን እውነተኛ የመቀመጫ አቀማመጥ በስክሪኑ ላይ ይመልከቱ። የትኞቹ ጠረጴዛዎች በደንበኛ እንደተያዙ በቀለም ለይተው ያውቃሉ።',
      bullets: [
        {
          title: 'Custom Floor Plan Builder',
          titleAm: 'የጠረጴዛ አቀማመጥ ንድፍ',
          desc: 'Design Main Dining, Outdoor Veranda, and VIP Balconies with round, square, or long banquet tables.',
          descAm: 'ዋናውን አዳራሽ፣ በረንዳውን እና የቪአይፒ ክፍሎችን በእውነተኛ ቅርጻቸው መደልደል።',
        },
        {
          title: 'Color Occupancy Status',
          titleAm: 'የጠረጴዛ ሁኔታ በቀለም',
          desc: 'Gray (Available), Green (Seated & Ordering), Amber (Meal Served), Blue (Bill Printed & Waiting for Payment).',
          descAm: 'ግራጫ (ክፍት)፣ አረንጓዴ (ተቀምጠዋል)፣ ቢጫ (ምግብ ደርሷል)፣ ሰማያዊ (ደረሰኝ ወጥቷል፤ ክፍያ ይጠብቃል)።',
        },
        {
          title: 'Seamless Table Transfers & Merging',
          titleAm: 'ጠረጴዛ መቀየር እና ማጣመር',
          desc: 'Move a party from patio to VIP or combine Table 4 and 5 for a large family banquet with zero ticket recalculation errors.',
          descAm: 'ደንበኛ ቦታ ሲቀይር ወይም ሁለት ጠረጴዛዎችን ሲያጣምር ሂሳቡን ያለምንም ስህተት በቀላሉ ማዛወር።',
        },
      ],
      technicalPill: 'SVG Vector Floor Grid & Live State Sync',
      technicalPillAm: 'ቀልጣፋ የቬክተር ካርታ እና የቀጥታ ሁኔታ ማሳያ',
    },
    {
      id: 'reservations',
      name: 'Reservations & Guests',
      nameAm: 'የቦታ ማስያዣ ስርዓት',
      headline: 'VIP party bookings without double-booking mistakes',
      headlineAm: 'የቪአይፒ እና የቡድን ቦታ ማስያዣ ያለስህተት መመዝገብ',
      badge: 'Smart Guestbook',
      badgeAm: 'የእንግዶች መዝገብ',
      icon: <CalendarDays className="w-5 h-5" />,
      summary: 'Schedule Friday night table bookings, VIP wedding dinners, and corporate lunch meetings with automated SMS confirmation.',
      summaryAm: 'የምሽት ቀጠሮዎችን፣ የሰርግ ድግሶችን እና የድርጅት ምሳዎችን በቀላሉ ይመዝግቡ፤ ለደንበኛው የስልክ ማረጋገጫ ይላኩ።',
      bullets: [
        {
          title: 'Double-Booking Conflict Prevention',
          titleAm: 'ተደራራቢ ቀጠሮዎችን መከላከል',
          desc: 'The engine flags overlapping booking time windows and capacity constraints before you confirm the reservation.',
          descAm: 'ተመሳሳይ ጠረጴዛ ለሁለት ደንበኞች እንዳይሰጥ አስቀድሞ በማስጠንቀቅ ስህተትን ያስቀራል።',
        },
        {
          title: 'Guest Preferences & Dietary Notes',
          titleAm: 'የእንግዶች ምርጫ እና ማስታወሻ',
          desc: 'Save VIP preferences such as window seats, fasting menu requirements, or birthday celebrations.',
          descAm: 'የእንግዳውን ተወዳጅ መቀመጫ፣ የጾም ምግብ ፍላጎት ወይም የልደት በዓል ማስታወሻ አስቀምጦ ማስተናገድ።',
        },
        {
          title: 'No-Show Tracking',
          titleAm: 'የቀሩ ደንበኞች ምዝገባ',
          desc: 'Automatically release held tables 20 minutes past reservation time to prevent revenue loss during peak weekends.',
          descAm: 'ደንበኛ በሰዓቱ ካልደረሰ የተያዘውን ጠረጴዛ ከ20 ደቂቃ በኋላ ለሌላ ሰው በማስተላለፍ ኪሳራን ማዳን።',
        },
      ],
      technicalPill: 'Automatic Conflict Resolver & SMS Notification Hook',
      technicalPillAm: 'የቀጠሮ ግጭት መከላከያ እና የSMS ማረጋገጫ',
    },
    {
      id: 'qrmenu',
      name: 'QR Menu & Online Ordering',
      nameAm: 'የደንበኛ QR ኮድ ማውጫ',
      headline: 'Contactless digital menus with vivid dish photos in Fidel',
      headlineAm: 'በአማርኛ እና እንግሊዝኛ ቋንቋ የሚያምር የQR ኮድ ዲጂታል ማውጫ',
      badge: 'Bilingual Mobile Menu',
      badgeAm: 'ባለሁለት ቋንቋ የሞባይል ማውጫ',
      icon: <QrCode className="w-5 h-5" />,
      summary: 'Diners scan a stylish wooden table sticker to view your full menu in English and Amharic with photos, spice indicators, and fast waiter paging.',
      summaryAm: 'ደንበኞች ጠረጴዛቸው ላይ ያለውን QR ኮድ በስልካቸው ስካን በማድረግ የምግብ ፎቶዎችን፣ ዋጋን እና ማብራሪያን በአማርኛ ማየት ይችላሉ።',
      bullets: [
        {
          title: 'Zero App Download Required',
          titleAm: 'ምንም አይነት አፕሊኬሽን ማውረድ ሳያስፈልግ',
          desc: 'Works in Safari, Chrome, and any Ethiopian mobile browser instantly in under 1 second.',
          descAm: 'በማንኛውም ስማርት ስልክ ላይ በሰከንድ ውስጥ ወዲያውኑ የሚከፈት ፈጣን ድረ-ገጽ።',
        },
        {
          title: 'Live 86 Out-of-Stock Toggles',
          titleAm: 'ያለቀ ምግብን ወዲያውኑ ማንሳት',
          desc: 'When special kitfo runs out, cashier marks it out-of-stock and it disappears from customer phones immediately.',
          descAm: 'የቀኑ ልዩ ክትፎ ሲያልቅ ካሸሩ ሲስተሙ ላይ ያጠፋዋል፤ ከደንበኞች ስልክ ላይም በቅጽበት ይነሳል።',
        },
        {
          title: 'Digital Waiter Call Button',
          titleAm: 'አስተናጋጅ መጥሪያ አዝራር',
          desc: 'Guests tap "Call Waiter" or "Request Bill" from their phone, alerting staff POS and terminal screens without waving hands.',
          descAm: 'ደንበኞች እጃቸውን ሳያወዛውዙ ከስልካቸው "አስተናጋጅ ጥራ" ወይም "ሂሳብ እፈልጋለሁ" የሚለውን በመንካት ያሳውቃሉ።',
        },
      ],
      technicalPill: 'PWA Mobile Web & Real-Time Sync',
      technicalPillAm: 'ቀላል የሞባይል ድረ-ገጽ እና የቀጥታ ማመሳሰያ',
    },
    {
      id: 'inventory',
      name: 'Inventory & Recipe Costing',
      nameAm: 'የምግብ ጥሬ እቃና የክምችት ቁጥጥር',
      headline: 'Recipe-level depletion stopping restaurant stock leakage',
      headlineAm: 'የስጋ፣ የቅቤ እና የቅመማ ቅመም መጠንን በግራም እና ሚሊሊትር መቆጣጠር',
      badge: 'Stop Ingredient Theft',
      badgeAm: 'ስርቆትና ብክነትን ያስቁሙ',
      icon: <Layers className="w-5 h-5" />,
      summary: 'Map each dish to exact ingredients. Ringing up 1 Dereq Tibs automatically reduces 350g tenderloin meat, 50g onions, and 20g spiced butter from the storeroom.',
      summaryAm: 'እያንዳንዱን ምግብ ከጥሬ እቃው ጋር ያገናኙ። አንድ ድርቅ ጥብስ ሲሸጥ 350 ግራም ስጋ፣ 50 ግራም ሽንኩርት እና 20 ግራም ቅቤ ከስቶር በራሱ ይቀንሳል።',
      bullets: [
        {
          title: 'Unit Conversion (kg, g, liters, bottles)',
          titleAm: 'የመለኪያ መለወጫ (ኪሎ፣ ግራም፣ ሊትር፣ ጠርሙስ)',
          desc: 'Buy in bulk 50kg bags or 24-bottle crates, deplete automatically in single grams or 330ml bottles upon sale.',
          descAm: 'በጆንያ ወይም በካርቶን ገዝተው በግራም ወይም በጠርሙስ ሽያጭ ልክ በራሱ ማስተካከል።',
        },
        {
          title: 'Low Stock WhatsApp / Telegram Alerts',
          titleAm: 'የእቃ ማለቂያ የስልክ ማስጠንቀቂያ',
          desc: 'Automated warnings to management when coffee beans, cooking oil, or beer crates drop beneath safe thresholds.',
          descAm: 'ቡና፣ ዘይት ወይም ቢራ ሊያልቅ ሲል ለማናጀሩ ፈጣን የስልክ መልእክት መላክ።',
        },
        {
          title: 'Physical Audit vs Expected Variances',
          titleAm: 'የስቶር ቆጠራ እና የልዩነት ንፅፅር',
          desc: 'Compare monthly physical count against POS sales to identify kitchen waste or storeroom theft immediately.',
          descAm: 'በእጅ የተቆጠረውን እቃ ከሲስተሙ ሽያጭ ጋር በማነጻጸር የጠፋውንና የባከነውን በብር መጠን ማወቅ።',
        },
      ],
      technicalPill: 'BOM (Bill of Materials) Recipe Engine',
      technicalPillAm: 'ትክክለኛ የጥሬ ዕቃዎች አጠቃቀም አስሊ',
    },
    {
      id: 'reports',
      name: 'Cloud Reports & Analytics',
      nameAm: 'የቀጥታ ሽያጭ ሪፖርት ከስልክዎ',
      headline: 'Real-time sales, tax breakdowns, and margins on your phone',
      headlineAm: 'የቀኑን ገቢ፣ ትርፍ እና የታክስ መረጃ ከስልክዎ በህያው መመልከት',
      badge: 'Remote Management',
      badgeAm: 'ከየትኛውም ቦታ ሆነው ይቆጣጠሩ',
      icon: <BarChart3 className="w-5 h-5" />,
      summary: 'Step away from the restaurant with 100% peace of mind. Check live revenue, staff attendance, and voided tickets from anywhere in Ethiopia or abroad.',
      summaryAm: 'ከሬስቶራንቱ ውጪ ሆነውም ሙሉ በሙሉ ይቆጣጠሩ። የቀኑን ሽያጭ፣ የሰራተኞችን የስራ ሰዓት እና የተሰረዙ ሂሳቦችን ከስልክዎ ይመልከቱ።',
      bullets: [
        {
          title: 'Hourly Sales & Peak Rush Curves',
          titleAm: 'የሰዓት ሽያጭ እና የስራ መጨናነቅ ግራፍ',
          desc: 'Identify your busiest lunch and dinner hours to schedule staff shifts accurately and cut labor costs.',
          descAm: 'የምሳና የእራት ሰዓት የስራ መጨናነቅን በማወቅ የሰራተኞችን ፈረቃ በትክክል ማስተካከል ያስችላል።',
        },
        {
          title: 'Top 10 High-Margin Star Dishes',
          titleAm: 'ከፍተኛ ትርፍ የሚያስገኙ ተወዳጅ ምግቦች',
          desc: 'Filter what actually brings profit vs dishes that tie up expensive perishable ingredients.',
          descAm: 'ብዙ ትርፍ የሚያስገኙትን እና የካፒታል ኪሳራ የሚያስከትሉትን ምግቦች ለይቶ ማወቅ።',
        },
        {
          title: 'Z-Report Daily Reconciliation',
          titleAm: 'የቀን ማጠቃለያ የዜድ-ሪፖርት',
          desc: 'Generate complete end-of-day balances segmented by Cash, Telebirr, CBE Birr, and Bank Transfer with one tap.',
          descAm: 'የቀኑን አጠቃላይ ገቢ በጥሬ ብር፣ በቴሌብር እና በባንክ ለይቶ በአንድ ንክኪ ማጠቃለል።',
        },
      ],
      technicalPill: 'Sub-Second Cloud Aggregation Engine',
      technicalPillAm: 'ፈጣን የደመና መረጃ አሰባሳቢ',
    },
    {
      id: 'roles',
      name: 'Staff PINs & Shift Roles',
      nameAm: 'የሰራተኞች ሚስጥር ቁጥርና ፈረቃ',
      headline: 'Stop cashier till theft with role-based permissions and audit logs',
      headlineAm: 'ያልተፈቀደ የሂሳብ መሰረዝን እና ስርቆትን በደህንነት ቁጥጥር ያስቁሙ',
      badge: 'Anti-Theft Security',
      badgeAm: 'ስርቆትን የሚከላከል ደህንነት',
      icon: <Users className="w-5 h-5" />,
      summary: 'Assign distinct 4-digit PINs for Waiters, Cashiers, Chefs, and Managers. Sensitive actions like voiding printed receipts require authenticated manager approval.',
      summaryAm: 'ለአስተናጋጅ፣ ለካሸር እና ለማናጀር የተለየ ባለ 4 ድጅት ሚስጥር ቁጥር መስጠት። ደረሰኝ መሰረዝ ወይም ቅናሽ ማድረግ ያለማናጀር ፈቃድ አይቻልም።',
      bullets: [
        {
          title: 'Blind Till Shift Closing',
          titleAm: 'ምስጢራዊ የፈረቃ ማጠቃለያ',
          desc: 'Cashiers count and enter physical notes in drawer before seeing system totals, preventing till skimming.',
          descAm: 'ካሸሩ በእጁ ያለውን ገንዘብ ሳያይ ቆጥሮ እንዲያስገባ በማድረግ የገንዘብ ጉድለትን በግልጽ ማወቅ።',
        },
        {
          title: 'Strict Void & Discount Audit Logs',
          titleAm: 'የተሰረዙ ሂሳቦች እና የቅናሽ መዝገብ',
          desc: 'Every canceled beer, transferred table, or bill discount captures staff name, time, and mandatory reason note.',
          descAm: 'ማንኛውም የተሰረዘ ምግብ ወይም ቅናሽ የሰራተኛውን ስም፣ ሰዓቱን እና ምክንያቱን መዝግቦ ያስቀምጣል።',
        },
        {
          title: 'Individual Waiter Sales & Tip Reports',
          titleAm: 'የእያንዳንዱ አስተናጋጅ የሽያጭ ሪፖርት',
          desc: 'Reward high-performing waiters and track tip distributions fairly with individual staff sales totals.',
          descAm: 'የእያንዳንዱን አስተናጋጅ የቀን ሽያጭ በመለካት ጎበዞችን ለማበረታታትና ጉርሻ ለመከፋፈል ምቹ ነው።',
        },
      ],
      technicalPill: 'Cryptographic PIN Hashing & Immutable Audit Trail',
      technicalPillAm: 'ጠንካራ የሚስጥር ቁጥር ጥበቃ እና የማይጠፋ የስራ ታሪክ',
    },
    {
      id: 'offline',
      name: 'Offline-First Engine',
      nameAm: 'ያለ ኢንተርኔት የመስራት ችሎታ',
      headline: 'Continuous selling during internet drops and power cuts',
      headlineAm: 'ኢንተርኔት ቢቋረጥም እንኳን ያለማቋረጥ የሚሸጥና የሚያትም',
      badge: 'Ethio Telecom Proof',
      badgeAm: 'ኔትወርክ ባይኖርም ይሰራል',
      icon: <WifiOff className="w-5 h-5" />,
      summary: 'Never stop serving customers because Ethio Telecom fiber cut out. KushinaPOS stores all orders locally on the tablet and syncs back seamlessly once reconnected.',
      summaryAm: 'የኢንተርኔት መቆራረጥ ስራዎን እንዳያስተጓጉል ኩሽና ፖስ በውስጡ የራሱ መረጃ ቋት አለው። ኔትወርክ ሲቋረጥም ይሸጣል፤ ሲመለስ ራሱ ወደ ክላውድ ይልካል።',
      bullets: [
        {
          title: 'Zero Latency Local Hardware Printing',
          titleAm: 'ያለ ኢንተርኔት ደረሰኝ ማተም',
          desc: 'Receipts print instantly to USB, Network LAN, and Bluetooth printers even if internet connectivity is completely dead.',
          descAm: 'ኢንተርኔት ሙሉ በሙሉ በሌለበት ጊዜም ደረሰኞች በቅጽበት በፕሪንተር ይታተማሉ፤ ካሽ ቦክስ ይከፈታል።',
        },
        {
          title: 'Automatic Silent Background Sync',
          titleAm: 'ኔትወርክ ሲመለስ በራሱ ማመሳከር',
          desc: 'No manual buttons to press. When internet returns, queued orders upload silently with automatic conflict resolution.',
          descAm: 'ምንም አይነት አዝራር መጫን ሳያስፈልግ ኔትወርክ እንደተመለሰ የቆዩት ትዕዛዞች በራሳቸው ወደ ክላውድ ይተላለፋሉ።',
        },
        {
          title: 'Battery Backup Compatible',
          titleAm: 'ከአነስተኛ ዩፒኤስ (UPS) ጋር የሚሰራ',
          desc: 'Combined with a standard mini-UPS or battery tablet, your restaurant operates smoothly through grid blackouts.',
          descAm: 'በአነስተኛ ባትሪ ወይም ዩፒኤስ በመታገዝ መብራት በሚጠፋበት ጊዜም ስራዎ ሳይቋረጥ ይቀጥላል።',
        },
      ],
      technicalPill: 'Local IndexedDB/SQLite Mirror with Sync Queue',
      technicalPillAm: 'የከመስመር ውጭ የውስጥ ቋት እና አውቶማቲክ ማስተላለፊያ',
    },
  ];

  const currentPillar = pillars.find(p => p.id === activeTab) || pillars[0];

  return (
    <MarketingLayout>
      <MarketingSEO
        title={isAm ? 'የኩሽና ፖስ ሙሉ ገጽታዎች እና አገልግሎቶች | KushinaPOS' : 'Hospitality POS Features: KDS, Tables, Inventory, Offline | KushinaPOS'}
        description={isAm ? 'የወጥ ቤት ስክሪን፣ የጠረጴዛዎች ካርታ፣ የጥሬ ዕቃ ቁጥጥር፣ የቴሌብር ክፍያ እና ያለ ኢንተርኔት የመስራት አቅም በአንድ ላይ።' : 'Explore the full KushinaPOS feature set: Kitchen Display System (KDS), interactive floor plans, recipe costing, staff PINs, and offline mode.'}
        canonicalUrl="/features"
      />

      {/* Hero Section */}
      <section className="pt-12 pb-16 md:py-20 bg-gradient-to-b from-surface-100 via-white to-surface-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 border-b border-surface-200/70 dark:border-surface-800/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200/80 dark:border-brand-800/80 text-brand-700 dark:text-brand-300 text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles className="w-4 h-4 text-brand-600" />
            <span>{isAm ? 'የተሟላ የሬስቶራንት ሲስተም' : 'The Complete Restaurant Operating System'}</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-surface-900 dark:text-white max-w-4xl mx-auto mb-6">
            {isAm 
              ? 'ለኢትዮጵያ ሬስቶራንቶች እና ካፌዎች የተዘጋጁ ዘመናዊ መገልገያዎች' 
              : 'Every tool required to run high-volume food & beverage service'}
          </h1>

          <p className="text-base sm:text-xl text-surface-600 dark:text-surface-300 max-w-3xl mx-auto leading-relaxed mb-8">
            {isAm
              ? 'ከወጥ ቤት ስክሪን እስከ ጠረጴዛ ካርታ፣ ከጥሬ ዕቃ ቁጥጥር እስከ ቴሌብር ክፍያ፤ ያለ ኢንተርኔትም ያለማቋረጥ የሚሰራ።'
              : 'From color-coded kitchen displays and interactive dining floor maps to recipe-level ingredient costing and seamless offline resilience.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => openLeadModal({ interest: 'Features Walkthrough', sourcePage: 'features-hero' })}
              className="px-6 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-lg shadow-brand-600/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>{isAm ? 'ነጻ ማሳያ ይመዝገቡ' : 'Schedule a live demo'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <Link
              to="/pricing"
              className="px-6 py-3.5 rounded-xl bg-surface-200/80 dark:bg-surface-800 hover:bg-surface-300/80 dark:hover:bg-surface-700 text-surface-800 dark:text-surface-200 font-semibold transition-all"
            >
              {isAm ? 'የዋጋ ዝርዝር' : 'See Pricing in ETB'}
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Pillar Interactive Showcase */}
      <section className="py-12 md:py-20 bg-white dark:bg-surface-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Pillar Navigation Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none mb-12 border-b border-surface-200 dark:border-surface-800">
            {pillars.map((pillar) => {
              const active = pillar.id === activeTab;
              return (
                <button
                  key={pillar.id}
                  onClick={() => setActiveTab(pillar.id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700'
                  }`}
                >
                  <span className={active ? 'text-white' : 'text-brand-600 dark:text-brand-400'}>
                    {pillar.icon}
                  </span>
                  <span>{isAm ? pillar.nameAm : pillar.name}</span>
                </button>
              );
            })}
          </div>

          {/* Active Pillar Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Details */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200/80 dark:border-brand-800/80 text-brand-700 dark:text-brand-300 text-xs font-semibold uppercase tracking-wider">
                <span>{isAm ? currentPillar.badgeAm : currentPillar.badge}</span>
              </div>

              <h2 className="font-display text-2xl sm:text-4xl font-bold text-surface-900 dark:text-white leading-tight">
                {isAm ? currentPillar.headlineAm : currentPillar.headline}
              </h2>

              <p className="text-base sm:text-lg text-surface-600 dark:text-surface-300 leading-relaxed">
                {isAm ? currentPillar.summaryAm : currentPillar.summary}
              </p>

              {/* Bullet points */}
              <div className="space-y-4 pt-2">
                {currentPillar.bullets.map((b, i) => (
                  <div key={i} className="p-4 sm:p-5 rounded-2xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200/80 dark:border-surface-700/80">
                    <h3 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2 mb-1.5">
                      <CheckCircle2 className="w-5 h-5 text-brand-600 dark:text-brand-400 shrink-0" />
                      <span>{isAm ? b.titleAm : b.title}</span>
                    </h3>
                    <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed pl-7">
                      {isAm ? b.descAm : b.desc}
                    </p>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <span className="inline-flex items-center gap-2 text-xs font-mono text-surface-500 dark:text-surface-400 bg-surface-100 dark:bg-surface-800 px-3 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700">
                  <ShieldCheck className="w-4 h-4 text-brand-500" />
                  <span>{isAm ? currentPillar.technicalPillAm : currentPillar.technicalPill}</span>
                </span>
              </div>
            </div>

            {/* Right Column: Interactive Simulator Preview */}
            <div className="lg:col-span-5 bg-surface-950 text-white rounded-3xl p-6 sm:p-8 border border-surface-800 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl" />

              <div className="flex items-center justify-between border-b border-surface-800 pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                </div>
                <span className="text-xs font-mono text-surface-400">
                  {currentPillar.id.toUpperCase()}_LIVE_TERMINAL
                </span>
              </div>

              {/* Dynamic screen simulator matching pillar */}
              {currentPillar.id === 'kds' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-surface-900 border border-emerald-500/40">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-white text-sm">#104 • Table 04 (Main Hall)</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono">03:42 min</span>
                    </div>
                    <div className="space-y-1 text-xs text-surface-300">
                      <div className="flex justify-between"><span>2x Special Shekla Tibs (Well Done)</span> <span className="text-emerald-400 font-semibold">GRILL</span></div>
                      <div className="flex justify-between"><span>1x Shiro Bozena (Spicy)</span> <span className="text-emerald-400 font-semibold">STEW</span></div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-900 border border-amber-500/40">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-white text-sm">#102 • Table 09 (VIP Lounge)</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-950 text-amber-400 font-mono">09:15 min</span>
                    </div>
                    <div className="space-y-1 text-xs text-surface-300">
                      <div className="flex justify-between"><span>1x Doro Wat with Ayib</span> <span className="text-amber-400 font-semibold">PREPPING</span></div>
                      <div className="flex justify-between"><span>2x Cold St. George Beer</span> <span className="text-emerald-400 font-semibold">READY</span></div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-brand-950/40 border border-brand-800 text-center text-xs text-brand-300">
                    {isAm ? 'ትዕዛዙ ሲያልቅ በጣት በመንካት "ተጠናቋል" ብለው ያሳውቁ' : 'Tap item to mark cooked • Sound chime alerts every new ticket'}
                  </div>
                </div>
              )}

              {currentPillar.id === 'tables' && (
                <div className="space-y-3">
                  <div className="text-xs text-surface-400 font-semibold uppercase mb-2">
                    {isAm ? 'የዋናው አዳራሽ ህያው ካርታ' : 'Main Dining Floor • 12 Active Tables'}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-surface-900 border border-emerald-500/50 text-center">
                      <div className="font-bold text-white text-sm">T-01</div>
                      <div className="text-[10px] text-emerald-400 font-medium">Seated (4p)</div>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-900 border border-amber-500/50 text-center">
                      <div className="font-bold text-white text-sm">T-02</div>
                      <div className="text-[10px] text-amber-400 font-medium">Eating (2p)</div>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-900 border border-blue-500/50 text-center">
                      <div className="font-bold text-white text-sm">T-03</div>
                      <div className="text-[10px] text-blue-400 font-medium">Bill Ready</div>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-900/40 border border-surface-800 text-center opacity-60">
                      <div className="font-bold text-surface-400 text-sm">T-04</div>
                      <div className="text-[10px] text-surface-500">Available</div>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-900 border border-emerald-500/50 text-center">
                      <div className="font-bold text-white text-sm">T-05</div>
                      <div className="text-[10px] text-emerald-400 font-medium">Seated (6p)</div>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-900/40 border border-surface-800 text-center opacity-60">
                      <div className="font-bold text-surface-400 text-sm">T-06</div>
                      <div className="text-[10px] text-surface-500">Available</div>
                    </div>
                  </div>
                </div>
              )}

              {currentPillar.id === 'reservations' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-surface-900 border border-surface-800">
                    <div className="flex justify-between items-center text-xs text-surface-400 mb-1">
                      <span>Tonight 7:30 PM • 6 Guests</span>
                      <span className="text-emerald-400 font-semibold">CONFIRMED</span>
                    </div>
                    <div className="text-sm font-bold text-white">Ato Dawit Mekonnen</div>
                    <div className="text-xs text-surface-400">VIP Balcony • Table 12 • Special Birthday Cake</div>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-900 border border-surface-800">
                    <div className="flex justify-between items-center text-xs text-surface-400 mb-1">
                      <span>Tonight 8:15 PM • 4 Guests</span>
                      <span className="text-amber-400 font-semibold">SMS SENT</span>
                    </div>
                    <div className="text-sm font-bold text-white">Dr. Helen Tadesse</div>
                    <div className="text-xs text-surface-400">Main Hall • Quiet corner requested</div>
                  </div>
                </div>
              )}

              {currentPillar.id === 'qrmenu' && (
                <div className="space-y-3 text-center py-4">
                  <div className="w-24 h-24 mx-auto bg-white p-2 rounded-2xl shadow-lg flex items-center justify-center">
                    <QrCode className="w-20 h-20 text-surface-950" />
                  </div>
                  <div className="text-sm font-bold text-white">Table 07 • Scanned</div>
                  <div className="text-xs text-surface-400 max-w-xs mx-auto">
                    {isAm ? 'ደንበኞች ስካን ሲያደርጉ የምግብ ዝርዝሩን በአማርኛ እና በእንግሊዝኛ ይመለከታሉ' : 'Customers instantly view bilingual menu with color photos and caller bell'}
                  </div>
                </div>
              )}

              {currentPillar.id === 'inventory' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-surface-900 border border-surface-800">
                    <div className="flex justify-between font-bold text-white mb-1">
                      <span>Fresh Beef Tenderloin (ስጋ)</span>
                      <span className="text-emerald-400">18.4 kg remaining</span>
                    </div>
                    <div className="w-full bg-surface-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full w-[65%]" />
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-900 border border-surface-800">
                    <div className="flex justify-between font-bold text-white mb-1">
                      <span>Yirgacheffe Coffee Beans (ቡና)</span>
                      <span className="text-amber-400">2.1 kg (Low alert)</span>
                    </div>
                    <div className="w-full bg-surface-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full w-[25%]" />
                    </div>
                  </div>
                </div>
              )}

              {currentPillar.id === 'reports' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-surface-900 border border-surface-800">
                    <div className="text-xs text-surface-400">{isAm ? 'የቀኑ አጠቃላይ ሽያጭ' : 'Today Net Sales'}</div>
                    <div className="text-2xl font-bold font-display text-white">48,650 ETB</div>
                    <div className="flex justify-between text-xs text-surface-400 mt-2 pt-2 border-t border-surface-800">
                      <span>Telebirr: 28,400</span>
                      <span>Cash: 14,250</span>
                      <span>CBE: 6,000</span>
                    </div>
                  </div>
                </div>
              )}

              {currentPillar.id === 'roles' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-surface-900 border border-surface-800">
                    <div className="text-xs text-surface-400 mb-1">Audit Log • 14:28</div>
                    <div className="text-sm font-bold text-white">Void Approved by Manager PIN</div>
                    <div className="text-xs text-surface-400">Order #88 • 1x Habesha Beer (Guest change of mind)</div>
                  </div>
                </div>
              )}

              {currentPillar.id === 'offline' && (
                <div className="space-y-3 text-center py-4">
                  <div className="inline-flex p-3 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 mb-2">
                    <WifiOff className="w-8 h-8" />
                  </div>
                  <div className="text-base font-bold text-white">
                    {isAm ? 'ከመስመር ውጭ (Offline Mode) በስራ ላይ ነው' : 'Ethio Telecom Disconnected • 100% Operational'}
                  </div>
                  <div className="text-xs text-surface-400">
                    {isAm ? '32 ትዕዛዞች በውስጥ ተቀምጠዋል፤ ደረሰኝ ያለማቋረጥ እየታተመ ነው' : '32 orders stored in SQLite queue • Printers firing normally'}
                  </div>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-surface-800 flex justify-between items-center text-xs text-surface-400">
                <span>Kushina Engine v2.4</span>
                <Link to="/demo" className="text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1">
                  <span>{isAm ? 'ሙሉ ማሳያ ይመልከቱ' : 'Test full system'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Final Features CTA */}
      <section className="py-16 bg-surface-50 dark:bg-surface-950 border-t border-surface-200 dark:border-surface-800 text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl sm:text-4xl font-bold text-surface-900 dark:text-white mb-4">
            {isAm ? 'ሬስቶራንትዎን ዛሬውኑ በዘመናዊ ሲስተም ያስተዳድሩ' : 'Ready to see these features in action?'}
          </h2>
          <p className="text-surface-600 dark:text-surface-400 text-base sm:text-lg mb-8">
            {isAm 
              ? 'አዲስ አበባ ውስጥ ባሉበት ቦታ መጥተን በነጻ እናሳያችኋለን። ምንም አይነት ክፍያ ወይም ግዴታ የለበትም።' 
              : 'Our specialists will bring demo tablets and printers directly to your venue in Addis Ababa for a hands-on walk-through.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => openLeadModal({ interest: 'Features Walkthrough (On-Site)', sourcePage: 'features-bottom' })}
              className="px-8 py-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-base shadow-lg shadow-brand-600/25 transition-all cursor-pointer"
            >
              {isAm ? 'የነጻ ማሳያ ቀጠሮ ይያዙ' : 'Book Free On-Site Demo'}
            </button>
            <Link
              to="/pricing"
              className="px-8 py-4 rounded-xl bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-white font-bold text-base hover:bg-surface-50 dark:hover:bg-surface-700 transition-all"
            >
              {isAm ? 'የዋጋ ዝርዝር ይመልከቱ' : 'View Pricing Plans'}
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
