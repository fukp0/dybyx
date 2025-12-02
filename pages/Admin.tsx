import React, { useState, useEffect } from 'react';
import { Product, AppSettings, DEFAULT_BUY_MSG, DEFAULT_IMAGE } from '../types';
import { ProductCard } from '../components/ProductCard';
import { Plus, Save, X, Settings as SettingsIcon, Image as ImageIcon, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { db, storage } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { GoogleGenAI } from "@google/genai";

interface AdminProps {
  products: Product[];
  settings: AppSettings;
  fetchData: () => void;
}

export const Admin: React.FC<AdminProps> = ({ products, settings, fetchData }) => {
  const [activeTab, setActiveTab] = useState<'products' | 'settings'>('products');
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({});
  
  // Settings State
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);

  // AI Generation State
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleEditProduct = (product: Product) => {
    setOpError(null);
    setCurrentProduct(product);
    setIsEditing(true);
  };

  const handleAddProduct = () => {
    setOpError(null);
    setCurrentProduct({
      title: '',
      description: '',
      price: '10€',
      imageUrl: DEFAULT_IMAGE,
      buyMessage: DEFAULT_BUY_MSG
    });
    setIsEditing(true);
  };

  const handleError = (error: any, action: string) => {
    console.error(`Error ${action}:`, error);
    if (error.code === 'permission-denied') {
      setOpError("Permission refusée ! Puisque vous utilisez une connexion locale, vous devez régler les règles Firestore sur 'public' dans la console Firebase (allow read, write: if true;).");
      alert("ERREUR PERMISSION : Impossible de sauvegarder. Vérifiez vos règles Firestore.");
    } else {
      setOpError(`Erreur lors de l'action: ${error.message}`);
      alert("Une erreur est survenue.");
    }
  };

  const handleGenerateImage = async () => {
    const prompt = window.prompt("Décrivez l'image que vous souhaitez générer (ex: 'Un panneau de contrôle futuriste néon bleu') :");
    if (!prompt) return;

    setIsGenerating(true);
    setOpError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }]
        },
        config: {
          imageConfig: {
            aspectRatio: "4:3"
          }
        }
      });

      let base64Data = null;
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            base64Data = part.inlineData.data;
            break;
          }
        }
      }

      if (!base64Data) {
        throw new Error("Aucune image générée.");
      }

      // Upload to Firebase Storage
      const storageRef = ref(storage, `generated/${Date.now()}.png`);
      await uploadString(storageRef, base64Data, 'base64', { contentType: 'image/png' });
      const url = await getDownloadURL(storageRef);
      
      setCurrentProduct(prev => ({ ...prev, imageUrl: url }));

    } catch (error: any) {
      handleError(error, "generating image");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct.title || !currentProduct.price) return;
    setOpError(null);

    try {
      if (currentProduct.id) {
        // Update
        const productRef = doc(db, 'products', currentProduct.id);
        await updateDoc(productRef, {
          ...currentProduct
        });
      } else {
        // Create
        await addDoc(collection(db, 'products'), {
          ...currentProduct,
          createdAt: Date.now()
        });
      }
      setIsEditing(false);
      fetchData();
    } catch (error: any) {
      handleError(error, "saving product");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) {
      try {
        await deleteDoc(doc(db, 'products', id));
        fetchData();
      } catch (error: any) {
        handleError(error, "deleting product");
      }
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setOpError(null);
    try {
      await setDoc(doc(db, 'settings', 'config'), localSettings);
      fetchData();
      alert("Paramètres sauvegardés !");
    } catch (error: any) {
      handleError(error, "saving settings");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Panel Administrateur</h2>
          <p className="text-slate-400 text-sm">Gérez vos produits et paramètres</p>
        </div>

        <div className="flex bg-slate-800 p-1 rounded-lg self-start">
          <button 
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'products' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            Produits
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            Paramètres
          </button>
        </div>
      </div>

      {opError && (
        <div className="bg-red-900/40 border border-red-700 text-red-200 p-4 mb-6 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{opError}</p>
        </div>
      )}

      {activeTab === 'products' && (
        <>
          {isEditing ? (
            <div className="glass-panel p-6 rounded-2xl max-w-2xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-bold text-white">{currentProduct.id ? 'Modifier le Produit' : 'Ajouter un Produit'}</h3>
                 <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-white">
                   <X className="w-6 h-6" />
                 </button>
              </div>
              
              <form onSubmit={handleSaveProduct} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Titre</label>
                  <input 
                    type="text" 
                    value={currentProduct.title || ''} 
                    onChange={e => setCurrentProduct({...currentProduct, title: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Ex: Panel Premium"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Prix</label>
                    <input 
                      type="text" 
                      value={currentProduct.price || ''} 
                      onChange={e => setCurrentProduct({...currentProduct, price: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="Ex: 25€"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Image URL</label>
                    <div className="flex gap-2">
                      <div className="relative flex-grow">
                        <input 
                          type="text" 
                          value={currentProduct.imageUrl || ''} 
                          onChange={e => setCurrentProduct({...currentProduct, imageUrl: e.target.value})}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                          placeholder="https://..."
                        />
                        <ImageIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                      </div>
                      <button
                        type="button"
                        onClick={handleGenerateImage}
                        disabled={isGenerating}
                        className="px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 rounded-lg border border-indigo-500/30 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Générer avec l'IA"
                      >
                         {isGenerating ? (
                           <Loader2 className="w-5 h-5 animate-spin" />
                         ) : (
                           <Sparkles className="w-5 h-5" />
                         )}
                      </button>
                    </div>
                    {currentProduct.imageUrl && (
                      <div className="mt-3 rounded-lg overflow-hidden border border-slate-700 bg-slate-800">
                        <img 
                          src={currentProduct.imageUrl} 
                          alt="Aperçu du produit" 
                          className="w-full h-32 object-cover"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                          onLoad={(e) => (e.currentTarget.style.display = 'block')}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                  <textarea 
                    value={currentProduct.description || ''} 
                    onChange={e => setCurrentProduct({...currentProduct, description: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none h-24"
                    placeholder="Détails du produit..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Message WhatsApp (Template)</label>
                  <p className="text-xs text-slate-500 mb-2">Variables: {'${title}'}, {'${price}'}</p>
                  <textarea 
                    value={currentProduct.buyMessage || ''} 
                    onChange={e => setCurrentProduct({...currentProduct, buyMessage: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-indigo-200 focus:ring-2 focus:ring-indigo-500 outline-none h-24 font-mono text-sm"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit" 
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-lg shadow-indigo-600/20 transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Sauvegarder
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <button 
                  onClick={handleAddProduct}
                  className="h-full min-h-[300px] border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-slate-800/30 transition-all group"
                >
                  <div className="bg-slate-800 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
                    <Plus className="w-8 h-8" />
                  </div>
                  <span className="font-medium">Ajouter un produit</span>
                </button>
                
                {products.map(product => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    isAdmin={true}
                    onBuy={() => {}} 
                    onEdit={handleEditProduct}
                    onDelete={handleDeleteProduct}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-xl mx-auto glass-panel p-8 rounded-2xl">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-700">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <SettingsIcon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white">Configuration Globale</h3>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Numéro WhatsApp (Vendeur)</label>
              <input 
                type="text" 
                value={localSettings.whatsappNumber} 
                onChange={e => setLocalSettings({...localSettings, whatsappNumber: e.target.value})}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="ex: 33612345678"
              />
              <p className="text-xs text-slate-500 mt-2">Ce numéro recevra les commandes des clients.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Numéro Support (Optionnel)</label>
              <input 
                type="text" 
                value={localSettings.supportNumber} 
                onChange={e => setLocalSettings({...localSettings, supportNumber: e.target.value})}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="ex: 33612345678"
              />
              <p className="text-xs text-slate-500 mt-2">Si vide, le numéro vendeur sera utilisé.</p>
            </div>

            <button 
              type="submit" 
              disabled={savingSettings}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-indigo-600/20 transition-colors flex items-center justify-center gap-2"
            >
              {savingSettings ? 'Sauvegarde...' : 'Sauvegarder les paramètres'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};