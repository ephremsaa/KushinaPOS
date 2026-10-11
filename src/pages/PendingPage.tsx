import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ChefHat, Mail, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card } from '../components/ui';

const STEPS = [
  { label: 'Application submitted',         done: true },
  { label: 'Our team reviews your details', done: false, active: true },
  { label: 'Approval email sent to you',    done: false },
  { label: 'Choose your plan and go live',  done: false },
];

export default function PendingPage() {
  const { user, signOut } = useAuth();

  const submittedAt = (user as any)?.restaurant?.created_at;
  const submittedDate = submittedAt
    ? new Date(submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-surface-50 flex items-center justify-center p-4">
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

        {/* Status icon */}
        <div className="w-20 h-20 bg-amber-100 border-4 border-amber-200 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-glow-amber">
          <Clock className="w-10 h-10 text-amber-600" />
        </div>

        <h1 className="font-display font-black text-2xl text-primary mb-3">
          Application Under Review
        </h1>
        <p className="text-muted mb-1 max-w-sm mx-auto leading-relaxed">
          Thank you for registering! Our team is reviewing your restaurant application.
        </p>
        <p className="text-muted mb-6 text-sm max-w-sm mx-auto">
          We'll email{' '}
          <span className="font-semibold text-surface-700">{user?.email}</span>{' '}
          once you're approved.
          {submittedDate && (
            <span className="text-surface-400"> (Submitted {submittedDate} — typically 1–2 business days.)</span>
          )}
        </p>

        {/* Progress steps */}
        <Card className="mb-6 text-left p-5">
          <h3 className="font-bold text-primary text-sm mb-4">What happens next</h3>
          <ol className="space-y-3">
            {STEPS.map((step, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <div className={[
                  'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black',
                  step.done
                    ? 'bg-emerald-500 text-white'
                    : step.active
                    ? 'bg-amber-100 border-2 border-amber-400 text-amber-700'
                    : 'bg-surface-100 border-2 border-default text-surface-400',
                ].join(' ')}>
                  {step.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={step.done ? 'line-through text-surface-400' : step.active ? 'text-amber-700 font-semibold' : 'text-muted'}>
                  {step.label}
                </span>
                {step.active && (
                  <span className="ml-auto text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                    In Progress
                  </span>
                )}
              </li>
            ))}
          </ol>
        </Card>

        <div className="flex gap-3">
          <Button
            variant="secondary"
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
