export const CURRENT_SEARCH_KEY = 'pathsharer_current_search';
export const CURRENT_SEARCH_CHANGED_EVENT = 'pathsharer:current-search-changed';

export interface CurrentSearchUser {
  userId: string;
  name?: string;
  isActive: boolean;
  source: { name: string; coordinates: [number, number] };
  destination: { name: string; coordinates: [number, number] };
  updatedAt: string;
}

export interface CurrentSearchState {
  users: CurrentSearchUser[];
  sourceName: string;
  destName: string;
}

export function getCurrentSearch(): CurrentSearchState | null {
  const raw = localStorage.getItem(CURRENT_SEARCH_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as CurrentSearchState;
  } catch {
    return null;
  }
}

export function setCurrentSearch(search: CurrentSearchState): void {
  localStorage.setItem(CURRENT_SEARCH_KEY, JSON.stringify(search));
  window.dispatchEvent(new Event(CURRENT_SEARCH_CHANGED_EVENT));
}

export function clearCurrentSearch(): void {
  localStorage.removeItem(CURRENT_SEARCH_KEY);
  window.dispatchEvent(new Event(CURRENT_SEARCH_CHANGED_EVENT));
}
