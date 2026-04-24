/** Canonical cart item — flat shape used in confirm/checkout pages */
export interface CartItem {
  menuId: number;
  name: string;
  price: number;
  quantity: number;
  options?: string;
  imageUrl?: string | null;
}

/**
 * Raw shape persisted to localStorage by the menu page.
 * Exported so the confirm page can reference the same definition
 * instead of duplicating the inline type.
 */
export interface StoredCartItem {
  menu: {
    id: number;
    name: string;
    price: number;
    image_url?: string | null;
    options?: string | null;
  };
  quantity: number;
  options?: string | null;
}

/** Returns the localStorage key for a table's cart */
export function cartStorageKey(slug: string, tableNumber: string | number): string {
  return `cart:${slug}:${tableNumber}`;
}
