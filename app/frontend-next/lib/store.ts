import { create } from 'zustand';

export type PeriodFilter = 'all' | 'pre_2022' | 'pos_2022';

interface FilterState {
  period: PeriodFilter;
  selectedPortes: Set<string>;
  selectedGroups: Set<string>;
  setPeriod: (p: PeriodFilter) => void;
  togglePorte: (porte: string) => void;
  setPortes: (portes: Set<string>) => void;
  toggleGroup: (group: string) => void;
  setGroups: (groups: Set<string>) => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  period: 'all',
  selectedPortes: new Set(['P', 'M', 'G', 'GG']),
  selectedGroups: new Set<string>(),
  setPeriod: (period) => set({ period }),
  togglePorte: (porte) =>
    set((s) => {
      const next = new Set(s.selectedPortes);
      if (next.has(porte)) {
        if (next.size > 1) next.delete(porte);
      } else {
        next.add(porte);
      }
      return { selectedPortes: next };
    }),
  setPortes: (portes) => set({ selectedPortes: portes }),
  toggleGroup: (group) =>
    set((s) => {
      const next = new Set(s.selectedGroups);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return { selectedGroups: next };
    }),
  setGroups: (groups) => set({ selectedGroups: groups }),
}));
