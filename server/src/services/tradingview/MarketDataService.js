/**
 * TradingView Market Data Service
 * Handles market data and symbol search API calls
 */
class MarketDataService {
  constructor(baseURL = 'https://symbol-search.tradingview.com') {
    this.baseURL = baseURL
  }

  /**
   * Search for symbols on TradingView
   * @param {string} query - Search query text (e.g., "TE", "AAPL")
   * @param {string} [lang='en'] - Language code (default: 'en')
   * @param {string} [exchange=''] - Exchange filter (optional, empty string for all)
   * @param {string} [searchType='undefined'] - Search type filter:
   *   - 'undefined' (default) - All types
   *   - 'stocks' - Stocks only
   *   - 'funds' - Funds only
   *   - 'futures' - Futures only
   *   - 'forex' - Forex only
   *   - 'crypto' - Cryptocurrencies only
   *   - 'index' - Indices only
   *   - 'bond' - Bonds only
   *   - 'economic' - Economic indicators only
   *   - 'options' - Options only
   * @param {string} [domain='production'] - Domain (default: 'production')
   * @param {string} [sortByCountry='US'] - Sort by country code (default: 'US')
   * @param {boolean} [promo=true] - Include promotional results (default: true)
   * @param {number} [hl=1] - Highlight level (default: 1)
   * @returns {Promise<{symbols: Array, symbols_remaining: number}>}
   * @description
   * Searches TradingView symbol database. No authentication required.
   * Returns array of symbol objects with symbol, description, type, exchange, etc.
   */
  async search(query, lang = 'en', exchange = '', searchType = 'undefined', domain = 'production', sortByCountry = 'US', promo = true, hl = 1) {
    try {
      if (!query || query.trim() === '') {
        throw new Error('Query is required for search')
      }

      const queryParams = new URLSearchParams({
        text: query.trim(),
        hl: hl.toString(),
        exchange: exchange || '',
        lang: lang,
        search_type: searchType,
        domain: domain,
        sort_by_country: sortByCountry,
        promo: promo.toString(),
      })

      const response = await fetch(`${this.baseURL}/symbol_search/v3/?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': '*/*',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://www.tradingview.com',
          'Priority': 'u=1, i',
          'Referer': 'https://www.tradingview.com/',
          'Sec-Ch-Ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      throw new Error(`Failed to search symbols from TradingView API: ${error.message}`)
    }
  }
}

export default MarketDataService
