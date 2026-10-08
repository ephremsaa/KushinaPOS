import React from 'react';
import { AlertTriangle, Mail, CreditCard, ChefHat } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card } from '../components/ui';

export default function SuspendedPage() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 to-amber-50/40 flex items-center justify-center p-4">
      <div className="w-full max-w-lg text-center animate-fade-in">

        {/* Brand mark */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-amber-500 rounded-2xl flex items-center justify-center shadow-glow-sm">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-black text-xl text-surface-900 tracking-tight">
            kushina<span className="text-brand-500">POS</span>
          </span>
        </div>

        {/* Status icon */}
        <div className="w-20 h-20 bg-amber-100 border-4 border-amber-200 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-amber-600" />
        </div>

        <h1 className="font-display font-black text-2xl text-surface-900 mb-3">
          Account Temporarily Paused
        </h1>
        <p className="text-surface-500 mb-6 max-w-sm mx-auto leading-relaxed">
          Your restaurant account has been suspended. This is usually due to a missed or overdue payment.
          Your data is safe — this is reversible once the issue is resolved.
        </p>

        {/* What's happening / what to do */}
        <Card className="mb-6 text-left p-5">
          <h3 className="font-bold text-surface-900 text-sm mb-3">To restore access</h3>
          <ul className="space-y-2.5 text-sm text-surface-600">
            <li className="flex items-start gap-2.5">
              <CreditCard className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Review your billing</strong> — check for overdue invoices or a failed payment method.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Mail className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Contact support</strong> — if you believe this is a mistake or need a payment extension.
              </span>
            </li>
          </ul>
        </Card>

        <div className="flex gap-3">
          <Button
            variant="primary"
            fullWidth
            icon={<CreditCard className="w-4 h-4" />}
            as={Link}
            to="/dashboard/billing"
          >
            Review Billing
          </Button>
          <Button
            variant="secondary"
            fullWidth
            icon={<Mail className="w-4 h-4" />}
            as="a"
            href="mailto:support@kushina.pos"
          >
            Contact Support
          </Button>
        </div>

        <button
          onClick={signOut}
          className="mt-4 text-xs text-surface-400 hover:text-surface-600 underline transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
