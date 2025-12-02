import React from 'react';
import { Product } from '../types';
import { ShoppingCart, Edit, Trash2 } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  isAdmin: boolean;
  onBuy: (product: Product) => void;
  onEdit?: (product: Product) => void;
  onDelete?: (id: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  isAdmin, 
  onBuy, 
  onEdit, 
  onDelete 
}) => {
  return (
    <div className="glass-panel rounded-2xl overflow-hidden flex flex-col hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 transform hover:-translate-y-1">
      <div className="relative h-48 w-full bg-slate-800 overflow-hidden group">
        <img 
          src={product.imageUrl} 
          alt={product.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://picsum.photos/400/300?blur=2';
          }}
        />
        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-3 py-1 rounded-full text-indigo-400 font-bold border border-indigo-500/30">
          {product.price}
        </div>
      </div>

      <div className="p-5 flex-grow flex flex-col">
        <h3 className="text-lg font-bold text-white mb-2">{product.title}</h3>
        <p className="text-slate-400 text-sm mb-6 flex-grow whitespace-pre-line">
          {product.description}
        </p>

        <div className="flex items-center gap-2 mt-auto">
          {!isAdmin ? (
             <button 
             onClick={() => onBuy(product)}
             className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-600/20"
           >
             <ShoppingCart className="w-4 h-4" />
             Acheter Maintenant
           </button>
          ) : (
            <>
               <button 
                onClick={() => onEdit && onEdit(product)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Modifier
              </button>
              <button 
                onClick={() => onDelete && onDelete(product.id)}
                className="bg-red-900/50 hover:bg-red-800/80 text-red-200 p-2 rounded-lg transition-colors border border-red-900"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};