import BacktesterSessionsListWrapper from '../../../backtester/BacktesterSessionsList/BacktesterSessionsListWrapper'

/** Replay sessions hub — same shell as practice accounts, embedded on `/`. */
export default function HubReplaySection({ isDark }: { isDark: boolean }) {
  return <BacktesterSessionsListWrapper embedded isDark={isDark} />
}
