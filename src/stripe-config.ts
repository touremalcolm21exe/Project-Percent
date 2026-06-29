export interface StripeProduct {
  priceId: string;
  name: string;
  description: string;
  mode: 'payment' | 'subscription';
  price: number;
  currency: string;
  currencySymbol: string;
}

/** Paid tiers map to user_profiles.plan = 'premium' after checkout. */
export const STRIPE_PRODUCTS: StripeProduct[] = [
  {
    priceId: 'price_1Ta0DZC09znEPPHD2NRfSKx9',
    name: 'Monthly',
    description: 'Unlimited projects with a shareable link on each one',
    mode: 'subscription',
    price: 9.99,
    currency: 'usd',
    currencySymbol: '$',
  },
];
