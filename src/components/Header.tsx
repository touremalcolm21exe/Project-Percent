import React from 'react';
import { BarChart3, Plus, User, LogOut, Crown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { STRIPE_PRODUCTS } from '../stripe-config';

interface HeaderProps {
  onCreateProject: () => void;
}

export function Header({ onCreateProject }: HeaderProps) {
  const { user, signOut } = useAuth();
  const { subscription } = useSubscription();
  const [showUserMenu, setShowUserMenu] = React.useState(false);

  const handleSignOut = async () => {
    await signOut();
    setShowUserMenu(false);
  };

  const getPlanName = () => {
    if (subscription?.subscription_status === 'active' && subscription?.price_id) {
      const product = STRIPE_PRODUCTS.find(p => p.priceId === subscription.price_id);
      return product?.name || 'Premium';
    }
    return 'Free';
  };

  const isActivePremium = subscription?.subscription_status === 'active';

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <BarChart3 className="h-8 w-8 text-indigo-600" />
            <h1 className="ml-2 text-xl font-bold text-gray-900">ProjectTracker</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-gray-100">
              {isActivePremium && <Crown className="h-4 w-4 text-yellow-500" />}
              <span className="text-sm font-medium text-gray-700">
                {getPlanName()}
              </span>
            </div>
            
            <button
              onClick={onCreateProject}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </button>
            
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none"
              >
                <User className="h-5 w-5" />
                <span className="text-sm font-medium">{user?.email}</span>
              </button>
              
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}