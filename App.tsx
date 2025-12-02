import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Admin } from './pages/Admin';
import { auth, db } from './firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { Product, AppSettings } from './types';
import { Lock } from 'lucide-react';

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  whatsappNumber: '33600000000',
  supportNumber: ''
};

const ADMIN_EMAIL = "dybytech00@gmail.com";
const ADMIN_PASSWORD = "mike12&&";

// Login Component moved outside to prevent re-renders losing focus
const Login = ({ onLogin, onNavigate }: { onLogin: (e: React.FormEvent, p: string) => void, onNavigate: (page: string) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    // Hardcoded check as requested
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
       onLogin(e, 'success');
       setIsSubmitting(false);
       return;
    }

    setError("Identifiants incorrects.");
    setIsSubmitting(false);
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="glass-panel p-8 rounded-2xl w-full max-w-md border border-slate-700">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-indigo-600/20 p-3 rounded-full mb-3">
             <Lock className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Connexion Admin</h2>
          <p className="text-slate-400 text-sm mt-2">Accès sécurisé réservé</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-900/50 text-red-200 p-3 rounded-lg text-sm text-center border border-red-900 font-medium">{error}</div>}
          
          <div>
            <label className="block text-slate-400 mb-1 text-sm">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="admin@dybytech.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-slate-400 mb-1 text-sm">Mot de passe</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className={`w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg transition-colors mt-4 shadow-lg shadow-indigo-600/20 ${isSubmitting ? 'opacity-70 cursor-wait' : ''}`}
          >
            {isSubmitting ? 'Connexion...' : 'Se Connecter'}
          </button>
          
          <div className="text-center mt-4">
              <button 
              type="button"
              onClick={() => onNavigate('home')}
              className="text-indigo-400 hover:text-indigo-300 text-sm"
              >
              Retour à l'accueil
              </button>
          </div>
        </form>
      </div>
    </div>
  );
};

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [user, setUser] = useState<any | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auth State Management
  useEffect(() => {
    // 1. Check Local Storage (Simple Auth)
    const isLocalAdmin = localStorage.getItem('dybytech_admin_auth');
    if (isLocalAdmin === 'true') {
      setUser({ email: ADMIN_EMAIL, uid: 'admin-local' });
    }

    // 2. Check Firebase Auth (Fallback/Alternative)
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      // If we are already logged in via local storage, ignore firebase null state
      if (localStorage.getItem('dybytech_admin_auth') === 'true') return;

      if (currentUser && currentUser.email === ADMIN_EMAIL) {
        setUser(currentUser);
      } else if (currentUser) {
        // Wrong email
        auth.signOut();
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSimpleLogout = () => {
    localStorage.removeItem('dybytech_admin_auth');
    auth.signOut();
    setUser(null);
    setCurrentPage('home');
  };

  const handleLocalLoginSuccess = () => {
      localStorage.setItem('dybytech_admin_auth', 'true');
      setUser({ email: ADMIN_EMAIL, uid: 'admin-local' });
      setCurrentPage('admin');
  };

  // Data Fetching
  const fetchData = async () => {
    setErrorMsg(null);
    try {
      // Fetch Products
      try {
        const productsSnapshot = await getDocs(collection(db, 'products'));
        const productsList = productsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];
        setProducts(productsList);
      } catch (err: any) {
        console.warn("Could not fetch products.", err);
        // Don't block the UI, just leave products empty
        if (err.code === 'permission-denied') {
          setErrorMsg("Erreur de permission. Si vous n'utilisez pas l'Auth Firebase, veuillez configurer les règles Firestore sur 'public' (allow read, write: if true;).");
        } else if (err.code === 'unavailable') {
          setErrorMsg("Service temporairement indisponible (Hors ligne).");
        }
      }

      // Fetch Settings
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'config'));
        if (settingsDoc.exists()) {
          setSettings(settingsDoc.data() as AppSettings);
        }
      } catch (err: any) {
         console.warn("Could not fetch settings.", err);
      }

    } catch (error) {
      console.error("Critical error in fetchData:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Re-fetch data when user changes (e.g. login) or on mount
  useEffect(() => {
    fetchData();
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <Layout 
      user={user} 
      isAdminPage={currentPage === 'admin'} 
      onNavigate={setCurrentPage}
      onLogout={handleSimpleLogout}
    >
      {currentPage === 'home' && (
        <>
          {errorMsg && (
            <div className="bg-yellow-900/30 border border-yellow-700 text-yellow-200 p-4 mb-4 rounded-lg mx-auto max-w-4xl text-center text-sm">
              <span className="font-bold block mb-1">Attention:</span> {errorMsg}
            </div>
          )}
          <Home products={products} settings={settings} />
        </>
      )}

      {currentPage === 'login' && (
        <Login onLogin={handleLocalLoginSuccess} onNavigate={setCurrentPage} />
      )}

      {currentPage === 'admin' && (
        user && user.email === ADMIN_EMAIL ? (
          <Admin 
            products={products} 
            settings={settings} 
            fetchData={fetchData} 
          />
        ) : (
          currentPage === 'admin' && (
            <div className="text-center py-20">
              <h2 className="text-2xl text-white font-bold mb-4">Accès Refusé</h2>
              <p className="text-slate-400 mb-6">Vous n'avez pas les permissions nécessaires.</p>
              <button 
                onClick={() => setCurrentPage('login')}
                className="text-indigo-400 hover:underline"
              >
                Se connecter
              </button>
            </div>
          )
        )
      )}
    </Layout>
  );
}

export default App;