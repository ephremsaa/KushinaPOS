import React from 'react';
import { XCircle, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function RejectedPage() {
  const { user, signOut } = useAuth();
  const reason = user?.restaurant?.rejection_reason;
  return (
    <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="font-display font-bold text-2xl text-surface-900 mb-3">Application Rejected</h1>
        <p className="text-surface-500 mb-4">
          Unfortunately, your restaurant application was not approved.
        </p>
        {Boolean(reason) && (
          <div className="card mb-6 text-left border border-red-200 bg-red-50">
            <p className="text-sm font-semibold text-surface-700 mb-1">Reason:</p>
            <p className="text-sm text-surface-600">{String(reason)}</p>
          </div>
        )}
        <p className="text-surface-500 mb-8 text-sm">
          If you believe this is a mistake, please contact our support team.
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
