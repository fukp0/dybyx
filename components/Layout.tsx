import React from 'react';
import { ShoppingBag, MessageCircle, LogIn, LogOut, Settings } from 'lucide-react';
import { auth } from '../firebase';

interface LayoutProps {
  children: React.ReactNode;
  user: any;
  isAdminPage?: boolean;
  onNavigate: (page: string) => void;
  onLogout?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, isAdminPage, onNavigate, onLogout }) => {
  const handleLogout = async () => {
    try {
      if (onLogout) {
        onLogout();
      } else {
        await auth.signOut();
      }
      onNavigate('home');
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="glass-panel sticky top-0 z-50 px-4 py-3 border-b border-slate-700">
        <div className="container mx-auto flex justify-between items-center">
          <div 
            className="flex items-center space-x-2 cursor-pointer"
            onClick={() => onNavigate('home')}
          >
            <div className="bg-indigo-600 p-2 rounded-lg">
              <ShoppingBag className="text-white w-6 h-6" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
              DybyTech
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                 <button
                  onClick={() => onNavigate('admin')}
                  className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${isAdminPage ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'}`}
                >
                  <Settings className="inline-block w-4 h-4 mr-1" />
                  Admin
                </button>
                <button
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-red-400 transition-colors"
                  title="Déconnexion"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
              <button
                onClick={() => onNavigate('login')}
                className="text-slate-400 hover:text-white transition-colors"
                title="Connexion Admin"
              >
                <LogIn className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="border-t border-slate-800 py-6 mt-8">
        <div className="container mx-auto text-center text-slate-500 text-sm">
          <p>© {new Date().getFullYear()} DybyTech. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
};