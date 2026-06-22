import { Mail, RefreshCw } from 'lucide-react'
import { fieldLabelClass, ghostButtonClass, primaryButtonClass, settingsInputClass } from '../../styles/aurenTheme'
import { t } from '../../utils/translator'

export type BaseEmailOTPFirmProps = {
  isDark: boolean
  idPrefix: string
  email: string
  otp: string
  otpStep: boolean
  sendingOtp: boolean
  verifying: boolean
  onEmailChange: (value: string) => void
  onOtpChange: (value: string) => void
  onSendOtp: () => void
  onVerifyOtp: () => void
  onResendOtp: () => void
  onChangeEmail: () => void
  emailLabel?: string
  emailPlaceholder?: string
}

/** Email + one-time password sign-in form. */
export default function BaseEmailOTPFirm({
  isDark,
  idPrefix,
  email,
  otp,
  otpStep,
  sendingOtp,
  verifying,
  onEmailChange,
  onOtpChange,
  onSendOtp,
  onVerifyOtp,
  onResendOtp,
  onChangeEmail,
  emailLabel = t('props.tradesea.emailLabel'),
  emailPlaceholder = t('props.tradesea.emailPlaceholder'),
}: BaseEmailOTPFirmProps) {
  const inputClass = settingsInputClass(isDark)
  const primaryBtn = `${primaryButtonClass()} w-full sm:w-auto min-w-[8rem]`
  const secondaryBtn = `${ghostButtonClass(isDark)} inline-flex items-center justify-center gap-2`

  if (!otpStep) {
    return (
      <>
        <div>
          <label className={fieldLabelClass(isDark)} htmlFor={`${idPrefix}-email`}>
            {emailLabel}
          </label>
          <div className="relative mt-1.5">
            <Mail
              className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`}
            />
            <input
              id={`${idPrefix}-email`}
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder={emailPlaceholder}
              className={`${inputClass} pl-10`}
              onKeyDown={(e) => e.key === 'Enter' && onSendOtp()}
            />
          </div>
        </div>
        <button
          type="button"
          disabled={sendingOtp}
          onClick={onSendOtp}
          className={`${primaryBtn} mt-4 ${sendingOtp ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {sendingOtp ? t('props.tradesea.sendingOtp') : t('props.tradesea.sendOtp')}
        </button>
      </>
    )
  }

  return (
    <>
      <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        {t('props.tradesea.otpSentTo', { email })}
      </p>
      <div>
        <label className={fieldLabelClass(isDark)} htmlFor={`${idPrefix}-otp`}>
          {t('props.tradesea.otpLabel')}
        </label>
        <input
          id={`${idPrefix}-otp`}
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(e) => onOtpChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          className={`${inputClass} mt-1.5 tracking-[0.3em] text-center font-mono text-lg`}
          onKeyDown={(e) => e.key === 'Enter' && onVerifyOtp()}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={verifying}
          onClick={onVerifyOtp}
          className={`${primaryBtn} ${verifying ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {verifying ? t('props.tradesea.verifying') : t('props.tradesea.verifyOtp')}
        </button>
        <button
          type="button"
          disabled={sendingOtp}
          onClick={onResendOtp}
          className={`${secondaryBtn} ${sendingOtp ? 'opacity-50' : ''}`}
        >
          <RefreshCw className="w-4 h-4" />
          {t('props.tradesea.resendOtp')}
        </button>
      </div>
      <button
        type="button"
        onClick={onChangeEmail}
        className={`text-xs font-medium ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'}`}
      >
        {t('props.tradesea.changeEmail')}
      </button>
    </>
  )
}
