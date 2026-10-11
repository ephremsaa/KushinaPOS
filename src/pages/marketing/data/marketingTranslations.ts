export interface MarketingDict {
  // Promo Bar
  promoText: string;
  promoButton: string;

  // Header & Nav
  navSolutions: string;
  navFeatures: string;
  navPricing: string;
  navHardware: string;
  navPayments: string;
  navIntegrations: string;
  navSuccess: string;
  navSupport: string;
  navAbout: string;
  navContact: string;
  navLogin: string;
  navBookDemo: string;
  navFreeTrial: string;

  // Solutions Mega Menu
  solutionsTitle: string;
  solutionsDesc: string;
  solRestaurants: string;
  solRestaurantsDesc: string;
  solCafes: string;
  solCafesDesc: string;
  solBars: string;
  solBarsDesc: string;
  solBakeries: string;
  solBakeriesDesc: string;
  solFastFood: string;
  solFastFoodDesc: string;
  solHotels: string;
  solHotelsDesc: string;

  // Product Mega Menu
  prodFeatures: string;
  prodFeaturesDesc: string;
  prodHardware: string;
  prodHardwareDesc: string;
  prodPayments: string;
  prodPaymentsDesc: string;
  prodIntegrations: string;
  prodIntegrationsDesc: string;

  // Footer Link Groups
  footerSolutions: string;
  footerProduct: string;
  footerHardware: string;
  footerCompany: string;
  footerSupport: string;
  footerLegal: string;
  footerRights: string;
  footerTagline: string;
  terms: string;
  privacy: string;
  faq: string;

  // Cookie Notice
  cookieTitle: string;
  cookieDesc: string;
  cookieAccept: string;
  cookieEssential: string;

  // Common CTAs
  bookFreeDemo: string;
  seeHowItWorks: string;
  startFreeTrial: string;
  talkToSales: string;
  contactSupport: string;
  exploreFeatures: string;
  viewAllSolutions: string;
}

export const MARKETING_TRANSLATIONS: Record<'en' | 'am', MarketingDict> = {
  en: {
    promoText: '🔥 New: Ethiopia Offline-First POS Engine now live — keep selling seamlessly through internet & power cuts!',
    promoButton: 'Explore Offline Tech',

    navSolutions: 'Solutions',
    navFeatures: 'Features',
    navPricing: 'Pricing',
    navHardware: 'Hardware',
    navPayments: 'Payments',
    navIntegrations: 'Integrations',
    navSuccess: 'Success Stories',
    navSupport: 'Support',
    navAbout: 'About',
    navContact: 'Contact',
    navLogin: 'Log in',
    navBookDemo: 'Book a demo',
    navFreeTrial: 'Start 14-Day Free Trial',

    solutionsTitle: 'Industry Solutions',
    solutionsDesc: 'Tailored specifically for Ethiopian food service workflows',
    solRestaurants: 'Dine-In Restaurants',
    solRestaurantsDesc: 'Full service dining, multi-course meals, and table turnaround',
    solCafes: 'Cafes & Macchiato Bars',
    solCafesDesc: 'Speed checkouts for morning rush and barista espresso queues',
    solBars: 'Bars & Nightlife',
    solBarsDesc: 'Customer tabs, dark theme, and blind cash reconciliations',
    solBakeries: 'Bakeries & Pastries',
    solBakeriesDesc: 'Custom cake deposits, morning batches, and waste tracking',
    solFastFood: 'Fast Food & QSR',
    solFastFoodDesc: 'Order numbering, combo buttons, and speedy counter lines',
    solHotels: 'Hotels & Multi-Outlet',
    solHotelsDesc: 'Centralize restaurant, terrace, and room service into one POS',

    prodFeatures: 'Core POS Features',
    prodFeaturesDesc: 'KDS, table plans, recipe inventory, and mobile reports',
    prodHardware: 'Hardware Bundles',
    prodHardwareDesc: 'Certified tablets, 80mm thermal printers, and cash drawers',
    prodPayments: 'Ethiopian Payments',
    prodPaymentsDesc: 'Instant Telebirr QR, CBE Birr, cash, and bank transfers',
    prodIntegrations: 'Real Integrations',
    prodIntegrationsDesc: 'Printers, local SQLite offline mirror, and payment gateways',

    footerSolutions: 'Solutions',
    footerProduct: 'Product',
    footerHardware: 'Hardware',
    footerCompany: 'Company',
    footerSupport: 'Support & Help',
    footerLegal: 'Legal',
    footerRights: 'All rights reserved.',
    footerTagline: 'The modern restaurant operating system built for Ethiopia.',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    faq: 'Frequently Asked Questions',

    cookieTitle: 'Cookie and Analytics Preference',
    cookieDesc: 'We use essential cookies to maintain security and anonymized analytics to improve your experience. No personal data is sold or shared.',
    cookieAccept: 'Accept All',
    cookieEssential: 'Essential Only',

    bookFreeDemo: 'Book a free demo',
    seeHowItWorks: 'See how it works',
    startFreeTrial: 'Start 14-Day Free Trial',
    talkToSales: 'Talk with our team in Addis Ababa',
    contactSupport: 'Contact Support',
    exploreFeatures: 'Explore all features',
    viewAllSolutions: 'View all solutions',
  },

  am: {
    promoText: '🔥 አዲስ፡ ከመስመር ውጭ የሚሰራው (Offline POS) ተጀመረ — መብራት ወይም ኢንተርኔት ሲቋረጥ ያለማቋረጥ ይሽጡ!',
    promoButton: 'ስለ አሰራሩ ይመልከቱ',

    navSolutions: 'አገልግሎቶች',
    navFeatures: 'ይዘቶች',
    navPricing: 'ዋጋዎች',
    navHardware: 'እቃዎች',
    navPayments: 'ክፍያዎች',
    navIntegrations: 'ግኑኝነቶች',
    navSuccess: 'የስኬት ታሪኮች',
    navSupport: 'ድጋፍ',
    navAbout: 'ስለ እኛ',
    navContact: 'ያግኙን',
    navLogin: 'ግባ',
    navBookDemo: 'ቀጠሮ ይያዙ',
    navFreeTrial: 'የ14 ቀን ነጻ አገልግሎት',

    solutionsTitle: 'የስራ ዘርፎች',
    solutionsDesc: 'ለኢትዮጵያ የምግብና የመስተንግዶ ስራዎች ተስማሚ ሆኖ የተዘጋጀ',
    solRestaurants: 'ባህላዊና ዘመናዊ ሬስቶራንቶች',
    solRestaurantsDesc: 'የጠረጴዛ መስተንግዶ፣ የወጥ ቤት ስክሪን እና ፈጣን የሂሳብ ክፍፍል',
    solCafes: 'ካፌዎች እና ማኪያቶ ቤቶች',
    solCafesDesc: 'የጠዋት ሰዓት ወረፋን የሚያስቀር ፈጣን የባሪስታ ሲስተም',
    solBars: 'ባሮች እና የምሽት ክለቦች',
    solBarsDesc: 'ክፍት ሂሳቦች፣ የጠርሙስ ቁጥጥር እና የሰራተኛ ፈረቃ ማጠቃለያ',
    solBakeries: 'ዳቦ እና ኬክ ቤቶች',
    solBakeriesDesc: 'የልደት ኬክ ቅድመ ክፍያ፣ የዳቦ ባች እና የብክነት ቁጥጥር',
    solFastFood: 'ፈጣን ምግቦች እና በርገር ቤቶች',
    solFastFoodDesc: 'የትዕዛዝ ቁጥር አውጪ፣ የኮምቦ አቋራጮች እና ፈጣን ካውንተር',
    solHotels: 'ሆቴሎች እና ሪዞርቶች',
    solHotelsDesc: 'የካፌ፣ የዋና አዳራሽ እና የክፍል ውስጥ ትዕዛዝ ማዕከላዊ ቁጥጥር',

    prodFeatures: 'የሲስተሙ ይዘቶች',
    prodFeaturesDesc: 'የወጥ ቤት ስክሪን፣ የጠረጴዛ ካርታ እና የቀጥታ ስልክ ሪፖርት',
    prodHardware: 'የቴክኒክ እቃዎች',
    prodHardwareDesc: 'ታብሌት፣ 80ሚሊ የደረሰኝ ፕሪንተር እና ጠንካራ ካሽ ቦክስ',
    prodPayments: 'የአገር ውስጥ ክፍያዎች',
    prodPaymentsDesc: 'ቴሌብር፣ ሲቢኢ ብር፣ ጥሬ ገንዘብ እና የባንክ ዝውውር',
    prodIntegrations: 'ቀጥተኛ ግኑኝነቶች',
    prodIntegrationsDesc: 'ፕሪንተሮች፣ ከመስመር ውጭ መስሪያ እና የክፍያ መንገዶች',

    footerSolutions: 'አገልግሎቶች',
    footerProduct: 'ሲስተሙ',
    footerHardware: 'የቴክኒክ እቃዎች',
    footerCompany: 'ድርጅቱ',
    footerSupport: 'ድጋፍ እና እገዛ',
    footerLegal: 'ህጋዊ መረጃ',
    footerRights: 'መብቱ በህግ የተጠበቀ ነው።',
    footerTagline: 'ለኢትዮጵያ ሬስቶራንቶች የተሰራ ዘመናዊ የኦፕሬሽን ሲስተም።',
    terms: 'የአገልግሎት ውል',
    privacy: 'የመረጃ ደህንነት',
    faq: 'ተደጋጋሚ ጥያቄዎች',

    cookieTitle: 'የኩኪ እና መረጃ ምርጫ',
    cookieDesc: 'ኩሽና ፖስ ሲስተሙን ደህንነቱ የተጠበቀ ለማድረግ እና አገልግሎታችንን ለማሻሻል መሰረታዊ ኩኪዎችን ይጠቀማል። የእርስዎ መረጃ ለሶስተኛ ወገን አይተላለፍም።',
    cookieAccept: 'ሁሉንም ተቀበል',
    cookieEssential: 'መሰረታዊውን ብቻ',

    bookFreeDemo: 'የነጻ ማሳያ ቀጠሮ ይያዙ',
    seeHowItWorks: 'አሰራሩን ይመልከቱ',
    startFreeTrial: 'የ14 ቀን ነጻ ሙከራ ይጀምሩ',
    talkToSales: 'አዲስ አበባ ካለው ቡድናችን ጋር ይነጋገሩ',
    contactSupport: 'የቴክኒክ ድጋፍ ያግኙ',
    exploreFeatures: 'ሁሉንም ይዘቶች ይመልከቱ',
    viewAllSolutions: 'ሁሉንም የስራ ዘርፎች ይመልከቱ',
  },
};
