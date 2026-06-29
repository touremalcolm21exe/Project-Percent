import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { useUserPlan } from '../hooks/useUserPlan';
import { PAID_PROJECT_LIMIT } from '../lib/planLimits';

export function SuccessPage() {
  const { isPremium, loading, refresh } = useUserPlan();

  // Poll until webhook promotes user_profiles.plan (same as post-checkout dashboard).
  useEffect(() => {
    if (isPremium) return;

    let attempts = 0;
    const maxAttempts = 12;
    const interval = setInterval(() => {
      attempts += 1;
      void refresh();
      if (attempts >= maxAttempts) clearInterval(interval);
    }, 2000);

    void refresh();

    return () => clearInterval(interval);
  }, [isPremium, refresh]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Payment Successful!
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {loading
              ? 'Activating your subscription…'
              : isPremium
                ? 'Your Premium plan is active.'
                : 'Payment received. Premium access should appear shortly — refresh if it does not.'}
          </p>
        </div>

        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900">What's Next?</h3>
              <p className="mt-2 text-sm text-gray-500">
                {isPremium
                  ? `You now have up to ${PAID_PROJECT_LIMIT} projects, each with its own shareable link!`
                  : 'We are syncing your account with Stripe. This usually takes a few seconds.'}
              </p>
            </div>

            <div className="space-y-4">
              <Link
                to="/"
                className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>

              <Link
                to="/pricing"
                className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                View Plans
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
