'use client';
import { createContext, useContext, useState } from 'react';
type ProductContextValue = {
  trade: any;
  version: string;
  productId: string;
  selection: string[];
  setSelection: (s: string[]) => void;
  valid: boolean;
  key: string;
};
const ProductContext = createContext<ProductContextValue | null>(null);
export const useProductSelection = () => useContext(ProductContext);
export function ProductProvider({
  trade,
  version,
  productId,
  children,
}: {
  trade: any;
  version: string;
  productId: string;
  children: React.ReactNode;
}) {
  const [selection, setSelection] = useState<string[]>(
    trade?.specs.map(() => '') || [],
  );
  const key = selection.length ? [...selection].sort().join('~') : 'default';
  const valid =
    !!trade &&
    selection.every(Boolean) &&
    trade.variants.some((v: any) => v.key === key && v.enabled);
  return (
    <ProductContext.Provider
      value={
        trade
          ? { trade, version, productId, selection, setSelection, valid, key }
          : null
      }
    >
      {children}
    </ProductContext.Provider>
  );
}
