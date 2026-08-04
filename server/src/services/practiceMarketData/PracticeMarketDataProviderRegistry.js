import TradingViewMarketDataClient from '../tradingview/TradingViewMarketDataClient.js'
import { loadPropFirmCatalog } from '../propfirms/PropFirmCatalog.js'

const DRIVER_FACTORIES = {
  tradingview: (descriptor, options) => new TradingViewMarketDataClient({
    ...options,
    tokenEnv: descriptor.credentials?.tokenEnv,
    baseURL: descriptor.transport?.upstreamWebSocketBaseUrl,
  }),
}

export class PracticeMarketDataProviderRegistry {
  constructor(options = {}) {
    this.factories = options.factories || DRIVER_FACTORIES
    this.providerOptions = options.providerOptions || {}
    this.descriptors = (options.descriptors || loadPropFirmCatalog(options.providersDir))
      .filter((item) => item?.enabled && item?.capabilities?.marketData?.practice)
    this.instances = new Map()
  }

  get descriptor() {
    return this.descriptors.find((item) => item.defaults?.practiceMarketData) || this.descriptors[0] || null
  }

  get supportedResolutions() {
    return this.descriptor?.marketData?.supportedResolutions || []
  }

  getProvider() {
    const descriptor = this.descriptor
    if (!descriptor) throw new Error('No practice market-data provider is enabled')
    if (this.instances.has(descriptor.id)) return this.instances.get(descriptor.id)
    const factory = this.factories[descriptor.driver]
    if (!factory) throw new Error(`Unsupported practice market-data driver: ${descriptor.driver}`)
    const provider = factory(descriptor, this.providerOptions)
    this.instances.set(descriptor.id, provider)
    return provider
  }

  search(query, options) {
    return this.getProvider().search(query, options)
  }

  history(symbol, options) {
    return this.getProvider().history(symbol, options)
  }

  subscribeQuotes(symbols, options) {
    const provider = this.getProvider()
    return typeof provider.subscribeQuotes === 'function'
      ? provider.subscribeQuotes(symbols, options)
      : () => undefined
  }
}

export default new PracticeMarketDataProviderRegistry()
