import type { TradeseaAccount, TradeseaAccountRuleSettings } from '../../api/tradesea.api'

type Plan = 'Flex' | 'Pro' | 'Daily' | 'Direct'
type Phase = 'Evaluation' | 'Sim funded' | 'Live' | 'Unconfirmed'

const support = 'https://support.lucidtrading.com/en/articles/'
const sources: Record<Plan, { label: string; url: string }[]> = {
  Flex: [
    { label: 'Evaluation rules', url: `${support}12945790-lucidflex-evaluation-account` },
    { label: 'Drawdown', url: `${support}12945815-lucidflex-drawdown` },
    { label: 'Consistency & options', url: `${support}12945805-lucidflex-consistency-percentage` },
  ],
  Pro: [
    { label: 'Evaluation rules', url: `${support}12890029-lucidpro-evaluation-account` },
    { label: 'Drawdown', url: `${support}12890136-lucidpro-drawdown` },
    { label: 'Consistency', url: `${support}12890109-lucidpro-consistency-percentage` },
  ],
  Daily: [
    { label: 'Evaluation rules', url: `${support}15996664-luciddaily-evaluation` },
    { label: 'Drawdown', url: `${support}15998425-luciddaily-drawdown` },
    { label: 'Consistency & options', url: `${support}16033858-luciddaily-customization` },
  ],
  Direct: [
    { label: 'Funded rules', url: `${support}12890148-luciddirect-funded-account` },
    { label: 'Drawdown', url: `${support}12890192-luciddirect-drawdown` },
    { label: 'Consistency', url: `${support}12890178-luciddirect-consistency-percentage` },
  ],
}

export interface LucidAccountProfile {
  title: string
  phase: Phase
  size?: number
  inferred: boolean
  target?: number
  mll?: number
  drawdown: string
  consistency: string
  dailyLoss: string
  links: { label: string; url: string }[]
}

export function applyLucidAccountSettings(profile: LucidAccountProfile, settings?: TradeseaAccountRuleSettings | null): LucidAccountProfile {
  if (!settings) return profile
  const drawdowns = { eod: 'End-of-day trailing', intraday: 'Intraday trailing', static: 'Static' }
  const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)
  return {
    ...profile,
    target: settings.profitTarget ?? profile.target,
    mll: settings.maxLoss ?? profile.mll,
    drawdown: settings.drawdownMethod ? `${drawdowns[settings.drawdownMethod]} · confirmed` : profile.drawdown,
    consistency: settings.consistencyPercent != null ? settings.consistencyPercent === 0 ? 'None · confirmed' : `${settings.consistencyPercent}% · confirmed` : profile.consistency,
    dailyLoss: settings.dllEnabled === false ? 'Off · confirmed' : settings.dllEnabled === true
      ? settings.dllAmount != null ? `${money(settings.dllAmount)} · on, confirmed` : 'On · amount unconfirmed' : profile.dailyLoss,
  }
}

/** Published references, checked 2026-10-29. Never use these to enforce risk or
 * infer live headroom/consistency from TradeLens' month-scoped results.
 * LDE/LDI/LTD are Lucid's public plan codes; their account phase is unconfirmed.
 */
export function getLucidAccountProfile(account?: TradeseaAccount | null): LucidAccountProfile | null {
  if (!account) return null
  const firms = [account.propFirmDisplayName, account.propFirm].filter(Boolean)
  const lucidFirm = firms.some(value => /\blucid(?:\s*trading)?\b/i.test(value))
  // Display names take priority over opaque provider IDs, but an explicitly
  // different provider must never inherit Lucid rules from a similar account ID.
  if (firms.length && !lucidFirm) return null
  const names = [account.name, account.externalAccountId, ...account.label.split('|').map(s => s.trim())].filter(Boolean)
  const codes = names.map(name => name.match(/^(LFE|LFF|LTE|LDE|LDI|LTD)(025|050|100|150)(?=[_\-]|$)/i)).filter(Boolean)
  const code = codes[0]
  if (codes.some(match => match[1].toUpperCase() !== code[1].toUpperCase() || match[2] !== code[2])) return null
  const description = [account.name, account.accountType, account.label].filter(Boolean).join(' ')
  const namedPlan = description.match(/\blucid\s*(flex|pro|daily|direct)\b/i)?.[1]?.toLowerCase()
  if (!lucidFirm && !code) return null
  const plans: Record<string, Plan> = { LFE: 'Flex', LFF: 'Flex', LTE: 'Pro', LDE: 'Daily', LDI: 'Daily', LTD: 'Direct' }
  const namedPlans: Record<string, Plan> = { flex: 'Flex', pro: 'Pro', daily: 'Daily', direct: 'Direct' }
  const prefix = code?.[1].toUpperCase()
  const plan = prefix ? plans[prefix] : namedPlans[namedPlan]
  const conflict = namedPlan && namedPlans[namedPlan] !== plan
  const size = code ? Number(code[2]) * 1000 : undefined
  const explicitPhase: Phase = /\blive\b/i.test(account.accountType || '') ? 'Live'
    : /\beval(?:uation)?\b/i.test(account.accountType || '') ? 'Evaluation'
    : /\bfunded\b/i.test(account.accountType || '') ? 'Sim funded' : 'Unconfirmed'
  const codePhase: Phase = prefix === 'LFE' || prefix === 'LTE' ? 'Evaluation' : prefix === 'LFF' ? 'Sim funded' : 'Unconfirmed'
  const phase = explicitPhase !== 'Unconfirmed' ? explicitPhase : codePhase
  const ambiguous = Boolean(conflict || (explicitPhase !== 'Unconfirmed' && codePhase !== 'Unconfirmed' && explicitPhase !== codePhase))
  const usable = plan && !ambiguous && phase !== 'Live' && !(plan === 'Direct' && phase === 'Evaluation')
  const index = [25000, 50000, 100000, 150000].indexOf(size)
  const mll = usable && index >= 0 ? (plan === 'Direct' ? [1000, 2000, 3500, 5000] : [1000, 2000, 3000, 4500])[index] : undefined
  const target = usable && phase === 'Evaluation' && plan !== 'Direct' && index >= 0 ? [1250, 3000, 6000, 9000][index] : undefined
  let drawdown = 'Confirm account configuration'
  let consistency = 'Confirm account configuration'
  if (usable) {
    drawdown = plan === 'Daily'
      ? phase === 'Sim funded' ? 'Intraday trailing'
        : phase === 'Unconfirmed' ? 'Evaluation: EOD or intraday · funded: intraday'
        : prefix === 'LDE' ? 'End-of-day trailing (inferred)' : prefix === 'LDI' ? 'Intraday trailing (inferred)' : 'EOD or intraday · selection unconfirmed'
      : 'End-of-day trailing'
    consistency = phase === 'Evaluation'
      ? plan === 'Pro' ? 'No evaluation consistency rule' : plan === 'Direct' ? 'Confirm account phase' : '40% standard / 50% add-on · selection unconfirmed'
      : phase === 'Sim funded'
        ? plan === 'Pro' ? '40% per payout cycle · 35% legacy accounts' : plan === 'Direct' ? '20% per payout cycle' : 'No funded consistency rule'
        : 'Account phase unconfirmed'
  }
  return {
    title: plan && !conflict ? `Lucid${plan}` : 'Lucid Trading', phase, size,
    inferred: Boolean(code), target, mll, drawdown, consistency,
    dailyLoss: 'Account setting not provided',
    links: plan ? sources[plan] : [{ label: 'Lucid account rules', url: 'https://support.lucidtrading.com/en/' }],
  }
}
