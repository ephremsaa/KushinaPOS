import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Puzzle, CheckCircle2, Clock, ArrowRight, ShieldCheck, 
  ExternalLink, Sparkles, Filter, Code2, Send, Check
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import MarketingLayout from './components/MarketingLayout';
import MarketingSEO from './components/MarketingSEO';
import { INTEGRATIONS_DATA } from './data/marketingData';
import { Modal, Button, Input } from '../../components/ui';
import { globalToast } from '../../components/ui/Toast';

export default function IntegrationsPage() {
  const { lang } = useLanguage();
  const isAm = lang === 'am';
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming'>('all');

  // Request an Integration Modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [formData, setFormData] = useState({
    restaurant_name: '',
    contact_name: '',
    email: '',
    phone: '',
    integration_name: '',
    use_case_notes: '',
  });

  const filteredIntegrations = INTEGRATIONS_DATA.filter((item) => {
    if (filter === 'live') return item.isLive;
    if (filter === 'upcoming') return !item.isLive;
    return true;
  });

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.restaurant_name || !formData.contact_name || !formData.integration_name) {
      globalToast.error('Please complete all required fields.');
      return;
    }
    if (!formData.email && !formData.phone) {
      globalToast.error('Please provide either an email or a phone number.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/public/integration-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit request');

      setSubmittedSuccess(true);
      globalToast.success('Integration request submitted! Our engineering team will follow up within 24 hours.');
    } catch (err: any) {
      globalToast.error(err.message || 'Error submitting request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MarketingLayout>
      <MarketingSEO
        title={isAm ? 'የሲስተም ግኑኝነቶች እና ተጨማሪ አሰራሮች | KushinaPOS Integrations' : 'Integrations: Telebirr, REST API, Webhooks, CSV Export & Accounting | KushinaPOS'}
        description={isAm ? 'ኩሽና ፖስ ከቴሌብር፣ ከሲቢኢ ብር፣ ከREST API፣ ከWebhooks እና ከሌሎች የኢትዮጵያ ሲስተሞች ጋር ያለው ቀጥተኛ ግኑኝነት።' : 'Explore real live integrations for KushinaPOS: REST API v1, signed Webhooks, Telebirr, CBE Birr, CSV/Excel export, and upcoming delivery dispatch protocols.'}
        canonicalUrl="/integrations"
      />

      {/* Hero Header */}
      <section className="pt-12 pb-16 md:py-20 bg-gradient-to-b from-surface-100 via-white to-surface-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 border-b border-surface-200/70 dark:border-surface-800/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200/80 dark:border-brand-800/80 text-brand-700 dark:text-brand-300 text-xs font-semibold uppercase tracking-wider mb-6">
            <Puzzle className="w-4 h-4 text-brand-600" />
            <span>{isAm ? 'የተገናኘ ሲስተም' : 'Connected Hospitality Ecosystem'}</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-surface-900 dark:text-white max-w-4xl mx-auto mb-6">
            {isAm 
              ? 'ከአገር በቀል የክፍያ፣ የኤፒአይ እና የሪፖርት ሲስተሞች ጋር የተገናኘ' 
              : 'Connect your POS with the tools and services you use every day'}
          </h1>

          <p className="text-base sm:text-xl text-surface-600 dark:text-surface-300 max-w-3xl mx-auto leading-relaxed mb-8">
            {isAm
              ? 'የተሟሉ የቀጥታ ግኑኝነቶች ከPartner REST API፣ Webhooks፣ ቴሌብር፣ ንግድ ባንክ እና የቴሌግራም የቀን ማጠቃለያ ጋር። በቅርብ የሚጀመሩትንም በግልጽ ይመልከቱ።'
              : 'Real production integrations you can use today (REST API, Webhooks, Telebirr, CBE Birr, Excel exports, Telegram bots), plus transparent roadmap milestones under active development for Ethiopia.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                setSubmittedSuccess(false);
                setShowRequestModal(true);
              }}
              icon={<Send className="w-4 h-4" />}
            >
              {isAm ? 'አዲስ ግኑኝነት ይጠይቁ' : 'Request an Integration'}
            </Button>
            <Link
              to="/developers"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-surface-900 dark:text-white font-semibold text-sm transition-all border border-surface-200 dark:border-surface-700"
            >
              <Code2 className="w-4 h-4 text-brand-600" />
              <span>{isAm ? 'የገንቢዎች መመሪያ (API Docs)' : 'Developer API Docs'}</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-60" />
            </Link>
          </div>

          {/* Filter Pills */}
          <div className="inline-flex items-center p-1.5 rounded-2xl bg-surface-200/80 dark:bg-surface-800 border border-surface-300/80 dark:border-surface-700">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-white dark:bg-surface-900 text-surface-900 dark:text-white shadow-xs'
                  : 'text-surface-600 dark:text-surface-400'
              }`}
            >
              {isAm ? 'ሁሉም (All)' : 'All Integrations'}
            </button>
            <button
              onClick={() => setFilter('live')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filter === 'live'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-surface-600 dark:text-surface-400'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isAm ? 'በስራ ላይ ያሉ (Live)' : 'Live & Ready'}</span>
            </button>
            <button
              onClick={() => setFilter('upcoming')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filter === 'upcoming'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-surface-600 dark:text-surface-400'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{isAm ? 'በቅርብ ቀን (Coming Soon)' : 'Coming Soon'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Grid of Integrations */}
      <section className="py-16 md:py-24 bg-white dark:bg-surface-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredIntegrations.map((item, idx) => (
              <div
                key={idx}
                className="p-8 rounded-3xl border border-surface-200/90 dark:border-surface-800 bg-surface-50/60 dark:bg-surface-950/40 hover:shadow-lg transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-surface-500">
                      {isAm ? item.categoryAm : item.category}
                    </span>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${
                      item.isLive
                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                    }`}>
                      {item.isLive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                      <span>{isAm ? item.statusAm : item.status}</span>
                    </span>
                  </div>

                  <h3 className="font-display text-xl font-bold text-surface-900 dark:text-white mb-3">
                    {isAm ? item.nameAm : item.name}
                  </h3>

                  <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                    {isAm ? item.descAm : item.desc}
                  </p>
                </div>

                <div className="mt-8 pt-4 border-t border-surface-200 dark:border-surface-800 flex items-center justify-between text-xs">
                  <span className="font-medium text-surface-500">
                    {item.isLive 
                      ? (isAm ? 'በሁሉም ፕላኖች ላይ ይሰራል' : 'Available on KushinaPOS')
                      : (isAm ? 'በዝግጅት ላይ ያለ' : 'In active engineering')}
                  </span>
                  {item.isLive ? (
                    <Link to="/developers" className="font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
                      <span>{isAm ? 'ሰነድ ይመልከቱ' : 'View docs'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  ) : (
                    <button
                      onClick={() => {
                        setFormData(prev => ({ ...prev, integration_name: item.name }));
                        setSubmittedSuccess(false);
                        setShowRequestModal(true);
                      }}
                      className="text-amber-600 dark:text-amber-400 font-semibold hover:underline"
                    >
                      {isAm ? 'ፍላጎት ያሳውቁ' : 'Vote for this'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Developer API & Custom Protocols Notice */}
      <section className="py-16 md:py-20 bg-surface-50 dark:bg-surface-950 border-t border-surface-200 dark:border-surface-800 text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white mb-3">
            {isAm ? 'ልዩ የድርጅት ግኑኝነት (Custom API) ይፈልጋሉ?' : 'Need a custom ERP, delivery dispatcher, or bank bridge?'}
          </h2>
          <p className="text-surface-600 dark:text-surface-400 text-sm sm:text-base mb-8">
            {isAm
              ? 'ለትላልቅ ሆቴሎች እና የሬስቶራንት ሰንሰለቶች ከነባር የፋይናንስ ወይም የክምችት ሲስተም ጋር የሚያገናኝ የኤፒአይ (REST API) ድጋፍ እንሰጣለን።'
              : 'Our engineering team in Addis Ababa collaborates with restaurant owners and software vendors to build custom data connectors, webhooks, and automated export pipelines.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                setSubmittedSuccess(false);
                setShowRequestModal(true);
              }}
              icon={<Send className="w-4 h-4" />}
            >
              {isAm ? 'የግኑኝነት ጥያቄ ቅጽ ይሙሉ' : 'Submit Integration Request'}
            </Button>
            <Link
              to="/developers"
              className="px-6 py-3.5 rounded-xl bg-white dark:bg-surface-800 hover:bg-surface-100 text-surface-900 dark:text-white font-bold text-sm shadow-md transition-all inline-flex items-center gap-2 border border-surface-200 dark:border-surface-700"
            >
              <Code2 className="w-4 h-4 text-brand-600" />
              <span>{isAm ? 'የገንቢዎች ፖርታል' : 'Developer Portal & API Docs'}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* MODAL: REQUEST AN INTEGRATION LEAD FORM */}
      <Modal
        open={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        title="Request an Integration"
      >
        {submittedSuccess ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-surface-900 dark:text-white">Request Received!</h3>
            <p className="text-sm text-surface-600 dark:text-surface-400 max-w-sm mx-auto">
              Thank you for letting us know what you need. Our Addis Ababa integrations team will evaluate your workflow and reach out within 24 hours.
            </p>
            <Button variant="primary" onClick={() => setShowRequestModal(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <p className="text-xs text-surface-500">
              Tell us about the software, bank, or delivery service you want connected to KushinaPOS.
            </p>

            <Input
              label="Restaurant or Business Name"
              placeholder="e.g. Habesha Gourmet Bole"
              value={formData.restaurant_name}
              onChange={(e) => setFormData({ ...formData, restaurant_name: e.target.value })}
              required
            />

            <Input
              label="Contact Person Name"
              placeholder="e.g. Yohannes Girma"
              value={formData.contact_name}
              onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Phone Number"
                placeholder="+251 9..."
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
              <Input
                type="email"
                label="Email Address"
                placeholder="yohannes@restaurant.et"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <Input
              label="Software or Service to Integrate"
              placeholder="e.g. Odoo ERP, Deliver Addis, QuickBooks, Awash Bank"
              value={formData.integration_name}
              onChange={(e) => setFormData({ ...formData, integration_name: e.target.value })}
              required
            />

            <div>
              <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider mb-1">
                How will you use this integration? (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. We want daily ingredient purchases from our central commissary pushed directly into our inventory ledger."
                value={formData.use_case_notes}
                onChange={(e) => setFormData({ ...formData, use_case_notes: e.target.value })}
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-800 rounded-xl bg-white dark:bg-surface-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-surface-200 dark:border-surface-800">
              <Button variant="ghost" type="button" onClick={() => setShowRequestModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submitting}>
                Submit Request
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </MarketingLayout>
  );
}
