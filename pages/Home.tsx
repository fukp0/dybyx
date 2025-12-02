import React from 'react';
import { Product, AppSettings } from '../types';
import { ProductCard } from '../components/ProductCard';
import { MessageCircle, Shield, Zap, Globe } from 'lucide-react';

interface HomeProps {
  products: Product[];
  settings: AppSettings;
}

export const Home: React.FC<HomeProps> = ({ products, settings }) => {
  
  const handleBuy = (product: Product) => {
    // Replace placeholder variables in the message
    let message = product.buyMessage || `HELLO ZÉPHYR JE VEUX ACHETE ${product.title} PRIX: ${product.price}`;
    
    // Simple template replacement
    message = message.replace('${prix}', product.price);
    message = message.replace('${price}', product.price);
    message = message.replace('${title}', product.title);
    
    const encodedMessage = encodeURIComponent(message);
    // Remove any + or spaces from number for the link
    const cleanNumber = settings.whatsappNumber.replace(/[^0-9]/g, '');
    
    const url = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
    window.open(url, '_blank');
  };

  const handleSupport = () => {
    const cleanNumber = settings.supportNumber ? settings.supportNumber.replace(/[^0-9]/g, '') : settings.whatsappNumber.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent("Bonjour Support, j'ai une question.")}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-16 px-4 relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/40 via-slate-900/50 to-slate-900 border border-slate-700/50">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="relative z-10 max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            Boostez votre <span className="text-indigo-400">Business</span> avec nos Panels Illimités
          </h1>
          <p className="text-slate-300 text-lg mb-8">
            Les meilleurs outils et services pour vos besoins. Accès immédiat, support 24/7.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-400">
             <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" /> Sécurisé
             </div>
             <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-indigo-400" /> Livraison Rapide
             </div>
             <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-400" /> Support Actif
             </div>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="w-1 h-6 bg-indigo-500 rounded-full"></span>
            Nos Produits
            <span className="ml-2 text-sm font-medium bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700">
              {products.length} Disponible{products.length > 1 ? 's' : ''}
            </span>
          </h2>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/30 rounded-2xl">
            <p className="text-slate-400">Aucun produit disponible pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map(product => (
              <ProductCard 
                key={product.id} 
                product={product} 
                isAdmin={false}
                onBuy={handleBuy} 
              />
            ))}
          </div>
        )}
      </section>

      {/* Floating Support Button */}
      <button 
        onClick={handleSupport}
        className="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg shadow-green-500/30 transition-all hover:scale-110 z-50 flex items-center gap-2 group"
      >
        <MessageCircle className="w-6 h-6" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap font-medium">
          Contact Support
        </span>
      </button>
    </div>
  );
};