import React, { useState } from 'react';
import { Check, Crown } from 'lucide-react';
import { STRIPE_PRODUCTS } from '../stripe-config';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { useUserPlan } from '../hooks/useUserPlan';
import { createCheckoutSession } from '../lib/stripe';

export function PricingPage() {
  const { user } = useAuth();
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const { isPremium, loading: planLoading } = useUserPlan();
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string) => {
    if (!user) {
      window.location.href = '/login';
      return;
    }

    setLoadingProductId(priceId);

    try {
      const { url } = await createCheckoutSession({
        priceId,
        mode: 'subscription',
        successUrl: `${window.location.origin}/success`,
        cancelUrl: window.location.href,
      });

      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
    } finally {
      setLoadingProductId(null);
    }
  };

  const isCurrentPlan = (priceId: string) => {
    if (!isPremium) return false;
    // Main checkout path updates user_profiles.plan; stripe_user_subscriptions may be absent.
    if (!subscription?.price_id) return true;
    const status = subscription.subscription_status;
    const active = status === 'active' || status === 'trialing' || status === 'past_due';
    return active && subscription.price_id === priceId;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Choose Your Plan
          </h2>
          <p className="mt-4 text-xl text-gray-600">
            Up to 500 projects and advanced features on paid plans
          </p>
        </div>

        <div className="mt-12 space-y-4 sm:mt-16 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0 xl:grid-cols-3">
          {/* Free Plan */}
          <div className="border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-200 bg-white">
            <div className="p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Free</h3>
              <p className="mt-4 text-sm text-gray-500">Perfect for getting started</p>
              <p className="mt-8">
                <span className="text-4xl font-extrabold text-gray-900">$0</span>
                <span className="text-base font-medium text-gray-500">/month</span>
              </p>
              <button
                disabled
                className="mt-8 block w-full bg-gray-100 border border-gray-300 rounded-md py-2 text-sm font-semibold text-gray-500 text-center cursor-not-allowed"
              >
                Current Plan
              </button>
            </div>
            <div className="pt-6 pb-8 px-6">
              <h4 className="text-xs font-medium text-gray-900 tracking-wide uppercase">
                What's included
              </h4>
              <ul className="mt-6 space-y-4">
                <li className="flex space-x-3">
                  <Check className="flex-shrink-0 h-5 w-5 text-green-500" />
                  <span className="text-sm text-gray-500">1 project with shareable link</span>
                </li>
                <li className="flex space-x-3">
                  <Check className="flex-shrink-0 h-5 w-5 text-green-500" />
                  <span className="text-sm text-gray-500">Basic milestone tracking</span>
                </li>
                <li className="flex space-x-3">
                  <Check className="flex-shrink-0 h-5 w-5 text-green-500" />
                  <span className="text-sm text-gray-500">Progress visualization</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Premium Plans */}
          {STRIPE_PRODUCTS.map((product) => (
            <div
              key={product.priceId}
              className="border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-200 bg-white relative"
            >
              {product.name === 'Monthly' && (
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2">
                  <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                    <Crown className="h-3 w-3 mr-1" />
                    Popular
                  </div>
                </div>
              )}
              <div className="p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">{product.name}</h3>
                <p className="mt-4 text-sm text-gray-500">{product.description}</p>
                <p className="mt-8">
                  <span className="text-4xl font-extrabold text-gray-900">
                    {product.currencySymbol}{product.price}
                  </span>
                  <span className="text-base font-medium text-gray-500">
                    /{product.mode === 'subscription' ? 'month' : 'one-time'}
                  </span>
                </p>
                <button
                  onClick={() => handleSubscribe(product.priceId)}
                  disabled={
                    subscriptionLoading ||
                    planLoading ||
                    loadingProductId === product.priceId ||
                    isCurrentPlan(product.priceId)
                  }
                  className="mt-8 block w-full bg-blue-600 border border-transparent rounded-md py-2 text-sm font-semibold text-white text-center hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingProductId === product.priceId ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </div>
                  ) : isCurrentPlan(product.priceId) ? (
                    'Current Plan'
                  ) : (
                    `Subscribe to ${product.name}`
                  )}
                </button>
              </div>
              <div className="pt-6 pb-8 px-6">
                <h4 className="text-xs font-medium text-gray-900 tracking-wide uppercase">
                  What's included
                </h4>
                <ul className="mt-6 space-y-4">
                  <li className="flex space-x-3">
                    <Check className="flex-shrink-0 h-5 w-5 text-green-500" />
                    <span className="text-sm text-gray-500">Shareable link on every project</span>
                  </li>
                  <li className="flex space-x-3">
                    <Check className="flex-shrink-0 h-5 w-5 text-green-500" />
                    <span className="text-sm text-gray-500">Up to 500 projects</span>
                  </li>
                  <li className="flex space-x-3">
                    <Check className="flex-shrink-0 h-5 w-5 text-green-500" />
                    <span className="text-sm text-gray-500">Advanced milestone tracking</span>
                  </li>
                  <li className="flex space-x-3">
                    <Check className="flex-shrink-0 h-5 w-5 text-green-500" />
                    <span className="text-sm text-gray-500">Custom progress colors</span>
                  </li>
                  <li className="flex space-x-3">
                    <Check className="flex-shrink-0 h-5 w-5 text-green-500" />
                    <span className="text-sm text-gray-500">Priority support</span>
                  </li>
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}