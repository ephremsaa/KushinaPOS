import React from 'react';
import { AlertTriangle, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function SuspendedPage() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="font-display font-bold text-2xl text-surface-900 mb-3">Account Suspended</h1>
        <p className="text-surface-500 mb-8">
          Your restaurant account has been suspended, usually due to a missed payment.
          Please contact support to resolve this and reactivate your account.
        </p>
        <div className="flex gap-3 justify-center">
          <a href="mailto:support@kushina.pos" className="btn-primary gap-2">
            <Mail className="w-4 h-4" /> Contact support
          </a>
          <button onClick={signOut} className="btn-secondary">Sign out</button>
        </div>
      </div>
    </div>
  );
}
