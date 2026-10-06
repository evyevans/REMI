/**
 * useSavedProperties — Zustand Store for Watchlisted Properties
 *
 * WHY THIS EXISTS:
 * The Map tab sidebar previously dumped ALL 500 properties as image-centric cards.
 * Since Apify doesn't return image URLs, 90% showed "No Photo" — a raw, unpolished
 * experience that undermines investor trust.
 *
 * This store powers the "Saved Properties" paradigm: users explore via the map,
 * click pins for insight, and explicitly bookmark properties worth tracking.
 * Only bookmarked properties appear in the sidebar — curated, intentional, premium.
 *
 * PERSISTENCE: localStorage via Zustand persist middleware.
 * DESIGN: Properties are keyed by ID for O(1) lookups (is this pin bookmarked?).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Property } from '../types';

export interface SavedPropertyEntry {
  property: Property;
  savedAt: string;        // ISO timestamp — when the user bookmarked it
  notes?: string;         // Optional user annotation (future feature)
}

interface SavedPropertiesState {
  /** Map of property ID → saved entry for O(1) lookups */
  saved: Record<string, SavedPropertyEntry>;

  /** Ordered list of saved property IDs (newest first) */
  order: string[];

  // ─── Actions ───────────────────────────────────────────

  /** Save a property to the watchlist */
  saveProperty: (property: Property) => void;

  /** Remove a property from the watchlist */
  unsaveProperty: (id: string) => void;

  /** Toggle save/unsave */
  toggleSave: (property: Property) => void;

  /** Check if a property is saved (O(1)) */
  isSaved: (id: string) => boolean;

  /** Get all saved properties in order (newest first) */
  getSavedList: () => SavedPropertyEntry[];

  /** Get the count of saved properties */
  getCount: () => number;

  /** Update notes for a saved property */
  setNotes: (id: string, notes: string) => void;

  /** Clear all saved properties */
  clearAll: () => void;
}

export const useSavedProperties = create<SavedPropertiesState>()(
  persist(
    (set, get) => ({
      saved: {},
      order: [],

      saveProperty: (property) =>
        set((state) => {
          if (state.saved[property.id]) return state; // Already saved
          return {
            saved: {
              ...state.saved,
              [property.id]: {
                property,
                savedAt: new Date().toISOString(),
              },
            },
            order: [property.id, ...state.order],
          };
        }),

      unsaveProperty: (id) =>
        set((state) => {
          const { [id]: _, ...remaining } = state.saved;
          return {
            saved: remaining,
            order: state.order.filter((pid) => pid !== id),
          };
        }),

      toggleSave: (property) => {
        const { saved, saveProperty, unsaveProperty } = get();
        if (saved[property.id]) {
          unsaveProperty(property.id);
        } else {
          saveProperty(property);
        }
      },

      isSaved: (id) => !!get().saved[id],

      getSavedList: () => {
        const { saved, order } = get();
        return order
          .map((id) => saved[id])
          .filter((entry): entry is SavedPropertyEntry => !!entry);
      },

      getCount: () => get().order.length,

      setNotes: (id, notes) =>
        set((state) => {
          if (!state.saved[id]) return state;
          return {
            saved: {
              ...state.saved,
              [id]: { ...state.saved[id], notes },
            },
          };
        }),

      clearAll: () => set({ saved: {}, order: [] }),
    }),
    {
      name: 'remi-saved-properties',
      storage: createJSONStorage(() => localStorage),
      // Only persist the data, not the computed methods
      partialize: (state) => ({
        saved: state.saved,
        order: state.order,
      }),
    },
  ),
);
