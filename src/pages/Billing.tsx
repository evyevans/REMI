import { useEffect } from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Billing() {
  const { user } = useAuth();
  const customerEmail = user?.email || '';

  // Load the Stripe Pricing Table script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/pricing-table.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-6 overflow-y-auto bg-bg-primary w-full">
      <div className="max-w-5xl w-full">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">Fleet Upgrades & Billing</h1>
            <p className="text-sm text-text-secondary mt-1">Scale your agentic bandwidth and manage your subscription.</p>
          </div>
          
          <a
            href="https://billing.stripe.com/p/login/3cI3cubkg6b5bUw8o46Vq00"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-bg-surface border border-border rounded-lg text-sm font-medium text-text-primary hover:bg-bg-elevated transition-colors"
          >
            Manage Subscription <ExternalLink size={14} className="text-text-tertiary" />
          </a>
        </div>

        {/* Security Banner */}
        <div className="flex items-center gap-3 p-4 mb-8 bg-success/5 border border-success/20 rounded-xl">
          <ShieldCheck className="text-success w-5 h-5" />
          <p className="text-sm text-text-primary">
            REMI uses bank-grade encryption via Stripe. Your payment details are never stored on our servers.
          </p>
        </div>

        {/* Stripe Pricing Table Wrapper */}
        <div className="w-full bg-white rounded-2xl shadow-xl overflow-hidden min-h-[600px] border border-border/50">
          {/* @ts-expect-error - Stripe Custom Element */}
          <stripe-pricing-table
            pricing-table-id="prctbl_1TK58pBanK3uDnnOK4EarG5h"
            publishable-key="pk_live_51SuN9DBanK3uDnnO75lHnN5OsbgJOdj88ycyBbCHdGdI5KbdlOc8zJrrWMaNd08yclLYovVFdSQ0DcVUIbWAan9M00g5EcSbXa"
            client-reference-id={user?.id || ''}
            customer-email={customerEmail}
          >
          {/* @ts-expect-error - Stripe component closure */}
          </stripe-pricing-table>
        </div>
      </div>
    </div>
  );
}
