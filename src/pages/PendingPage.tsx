import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ChefHat, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function PendingPage() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Clock className="w-10 h-10 text-amber-600" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <ChefHat className="w-5 h-5 text-brand-500" />
          <span className="font-display font-bold text-brand-600">kushinaPOS</span>
        </div>
        <h1 className="font-display font-bold text-2xl text-surface-900 mb-3">
          Application under review
        </h1>
        <p className="text-surface-500 mb-2">
          Thank you for registering! Our team is reviewing your restaurant application.
          This usually takes <strong>1–2 business days</strong>.
        </p>
        <p className="text-surface-500 mb-8">
          We'll send a confirmation email to{' '}
          <span className="font-semibold text-surface-700">{user?.email}</span>{' '}
          once your account is approved.
        </p>

        <div className="card mb-6 text-left">
          <h3 className="font-semibold text-surface-900 mb-3 text-sm">What happens next?</h3>
          <ol className="space-y-2.5">
            {[
              'Our team reviews your business details and documents',
              'You receive an approval email',
              'Select your subscription plan',
              'Start managing your restaurant!',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-surface-600">
                <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="flex gap-3">
          <a
            href="mailto:support@kushina.pos"
            className="btn-secondary flex-1 gap-2"
          >
            <Mail className="w-4 h-4" />
            Contact support
          </a>
          <button onClick={signOut} className="btn-ghost flex-1">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
