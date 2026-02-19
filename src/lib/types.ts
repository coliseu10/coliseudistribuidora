import type { Timestamp } from "firebase/firestore";

export type PriceTier = {
  label: string;   // "1 a 49", "50 a 100", "Varejo", "Atacado"
  min: number | null;
  max: number | null;
  price: number;
};

export type Variant = {
  id: string;
  sku: string | null;
  shape: string;   // quadrado, redondo...
  socket: string;  // GU10, E27...
  color: string;   // branco, preto...
  active: boolean;
  imageUrls: string[];   // vai vir do Storage depois
  priceTiers: PriceTier[];
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  active: boolean;
  tags: string[];
  description: string | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};
