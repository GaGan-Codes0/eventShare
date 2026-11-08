/**
 * Signed links change now and then, but the file behind them doesn't. Caching by the file's
 * address (the link without its signature) means a photo is only ever downloaded once.
 */
export function stableSource(uri: string) {
  return { uri, cacheKey: uri.split('?')[0] };
}
