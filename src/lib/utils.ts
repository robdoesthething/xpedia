import type { Collection, Theme, ThemeWithCollections } from '@/types/database';

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function groupCollectionsByTheme(
  allCollections: (Collection & { themes: Theme | null })[],
  // allThemes is not needed — theme metadata is embedded in allCollections via the join
): { themeMap: Map<string, ThemeWithCollections>; uncategorized: Collection[] } {
  const themeMap = new Map<string, ThemeWithCollections>();
  const uncategorized: Collection[] = [];

  for (const col of allCollections) {
    const theme = col.themes;
    if (theme && col.theme_id) {
      if (!themeMap.has(theme.id)) {
        themeMap.set(theme.id, { ...theme, collections: [] });
      }
      themeMap.get(theme.id)!.collections.push(col);
    } else {
      uncategorized.push(col);
    }
  }

  return { themeMap, uncategorized };
}
