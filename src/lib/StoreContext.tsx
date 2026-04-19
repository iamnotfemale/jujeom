'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

interface StoreContextValue {
  storeName: string;
}

const StoreContext = createContext<StoreContextValue>({ storeName: '주점' });

export function StoreProvider({ children, initialName }: { children: React.ReactNode; initialName: string }) {
  return (
    <StoreContext.Provider value={{ storeName: initialName }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStoreName() {
  return useContext(StoreContext).storeName;
}
