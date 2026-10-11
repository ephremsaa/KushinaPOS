import React from 'react';
import { XCircle, Mail, RefreshCw, MessageCircle, ChefHat } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card } from '../components/ui';

export default function RejectedPage() {
  const { user, signOut } = useAuth();
  const reason = (user as any)?.restaurant?.rejection_reason;

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 to-surface-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg text-center animate-fade-in">

        {/* Brand mark */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <img
            src="/kushinaPOStrace.png"
            alt="kushinaPOS"
            className="w-10 h-10 object-contain drop-shadow-sm"
          />
          <span className="font-display font-black text-xl text-primary tracking-tight">
            kushina<span className="text-brand-500">POS</span>
          </span>
        </div>

        {/* Status icon — neutral, not all-red */}
        <div className="w-20 h-20 bg-surface-100 border-4 border-default rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
          <XCircle className="w-10 h-10 text-surface-400" />
        </div>

        <h1 className="font-display font-black text-2xl text-primary mb-3">
          Application Not Approved
        </h1>
        <p className="text-muted mb-6 max-w-sm mx-auto leading-relaxed">
          After reviewing your application, we were unable to approve it at this time.
        </p>

        {/* Rejection reason — always show, never hide */}
        {reason ? (
          <Card className="mb-6 text-left border-l-4 border-red-400 p-5">
            <p className="text-xs font-black uppercase tracking-wider text-red-600 mb-2">
              Reason provided by reviewer
            </p>
            <p className="text-sm text-surface-700 leading-relaxed">{String(reason)}</p>
          </Card>
        ) : (
          <Card className="mb-6 text-left p-5">
            <p className="text-xs font-black uppercase tracking-wider text-surface-400 mb-2">
              No specific reason was provided
            </p>
            <p className="text-sm text-surface-600 leading-relaxed">
              Contact our support team and reference your email address — they can give you details.
            </p>
          </Card>
        )}

        {/* What you can do — actionable, not vague */}
        <Card className="mb-6 text-left p-5">
          <h3 className="font-bold text-primary text-sm mb-3">What you can do</h3>
          <ul className="space-y-2.5 text-sm text-surface-600">
            <li className="flex items-start gap-2.5">
              <Mail className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Contact support</strong> — email us with your business details and we'll explain the decision.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <RefreshCw className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Re-apply</strong> — if you've resolved the issue raised, you can submit a new application.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <MessageCircle className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Appeal the decision</strong> — if you believe this is a mistake, we're happy to review it again.
              </span>
            </li>
          </ul>
        </Card>

        <div className="flex gap-3">
          <Button
            variant="primary"
            fullWidth
            icon={<Mail className="w-4 h-4" />}
            as="a"
            href="mailto:support@kushina.pos"
          >
            Contact Support
          </Button>
          <Button variant="ghost" fullWidth onClick={signOut}>
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
