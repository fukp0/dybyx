export interface Product {
  id: string;
  title: string;
  description: string;
  price: string;
  imageUrl: string;
  buyMessage: string;
  createdAt: number;
}

export interface AppSettings {
  whatsappNumber: string;
  supportNumber: string;
}

export const DEFAULT_BUY_MSG = "HELLO ZÉPHYR JE VEUX ACHETE UN PANEL ${price} JE SAIS PAS SI C'EST DISPONIBLES";
export const DEFAULT_IMAGE = "https://picsum.photos/400/300";
