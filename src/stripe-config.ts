export interface StripeProduct {
  priceId: string;
  name: string;
  description: string;
  mode: 'payment' | 'subscription';
  price: number;
  currency: string;
  currencySymbol: string;
}

export const STRIPE_PRODUCTS: StripeProduct[] = [
  {
    priceId: 'price_1Ta0DZC09znEPPHD2NRfSKx9',
    name: 'Premium',
    description: 'Unlock unlimited projects and advanced features',
    mode: 'subscription',
    price: 9.99,
    currency: 'usd',
    currencySymbol: '$',
  },
];