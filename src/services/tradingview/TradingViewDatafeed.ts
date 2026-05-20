import {
  IDatafeedChartApi,
  LibrarySymbolInfo,
  ResolutionString,
  SubscribeBarsCallback,
} from '../../types/chart'

/**
 * Minimal stub datafeed for layout preview when no live datafeed is wired.
 */
class StubTradingViewDatafeed implements IDatafeedChartApi {
  onReady(callback: (configuration: unknown) => void): void {
    setTimeout(() => {
      callback({
        supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D'],
        supports_group_request: false,
        supports_marks: false,
        supports_search: false,
        supports_timescale_marks: false,
      })
    }, 0)
  }

  searchSymbols(
    _userInput: string,
    _exchange: string,
    _symbolType: string,
    onResultReadyCallback: (symbols: LibrarySymbolInfo[]) => void
  ): void {
    onResultReadyCallback([])
  }

  resolveSymbol(
    symbolName: string,
    onResolve: (symbolInfo: LibrarySymbolInfo) => void,
    _onError: (reason: string) => void
  ): void {
    onResolve({
      name: symbolName,
      ticker: symbolName,
      description: symbolName,
      type: 'futures',
      session: '24x7',
      timezone: 'Etc/UTC',
      exchange: '',
      listed_exchange: '',
      minmov: 1,
      pricescale: 100,
      has_intraday: true,
      has_daily: true,
      has_weekly_and_monthly: true,
      supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D'] as ResolutionString[],
      volume_precision: 0,
      data_status: 'streaming',
    })
  }

  getBars(
    _symbolInfo: LibrarySymbolInfo,
    _resolution: ResolutionString,
    _periodParams: { from: number; to: number; firstDataRequest: boolean },
    onResult: (bars: unknown[], meta: { noData: boolean }) => void,
    _onError: (reason: string) => void
  ): void {
    onResult([], { noData: true })
  }

  subscribeBars(
    _symbolInfo: LibrarySymbolInfo,
    _resolution: ResolutionString,
    _onTick: SubscribeBarsCallback,
    _listenerGuid: string,
    _onResetCacheNeededCallback: () => void
  ): void {}

  unsubscribeBars(_listenerGuid: string): void {}
}

export function createStubDatafeed(): IDatafeedChartApi {
  return new StubTradingViewDatafeed()
}
