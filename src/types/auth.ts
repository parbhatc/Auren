import { UseFormRegisterReturn, UseFormHandleSubmit, FieldErrors } from 'react-hook-form'

export interface User {
  id: string
  name: string
  username: string
  email: string
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface RegisterData {
  name: string
  username: string
  email: string
  password: string
  confirmPassword: string
}

export interface ForgotPasswordData {
  email: string
  code: string
}

export interface VerifyEmailData {
  email: string
  code: string
}

export interface ResetPasswordData {
  email: string
  code: string
  password: string
}

export interface ResetPasswordFormData {
  password: string
  confirmPassword: string
}

export interface AuthResponse {
  success: boolean
  message: string
  token?: string
  user?: User
}

export interface ApiError {
  message: string
  status?: number
}

// Component Props Interfaces
export interface LoginProps {
  isDark: boolean
  toggleTheme: () => void
  error: string
  loading: boolean
  register: (name: keyof LoginCredentials, options?: any) => UseFormRegisterReturn
  handleSubmit: UseFormHandleSubmit<LoginCredentials>
  errors: FieldErrors<LoginCredentials>
  onSubmit: (data: LoginCredentials) => void
}

export interface RegisterProps {
  isDark: boolean
  toggleTheme: () => void
  error: string
  success: string
  loading: boolean
  showVerification: boolean
  registeredEmail: string
  verificationCode: string
  verifying: boolean
  register: (name: keyof RegisterData, options?: any) => UseFormRegisterReturn
  handleSubmit: UseFormHandleSubmit<RegisterData>
  errors: FieldErrors<RegisterData>
  password: string
  onSubmit: (data: RegisterData) => void
  onVerifySubmit: (e: React.FormEvent) => void
  onVerificationCodeChange: (code: string) => void
  onBackToRegistration: () => void
}

export interface ForgotPasswordProps {
  isDark: boolean
  toggleTheme: () => void
  error: string
  success: string
  resendMessage: string
  loading: boolean
  sending: boolean
  resending: boolean
  continuing: boolean
  resendCooldownSeconds: number
  register: (name: keyof ForgotPasswordData, options?: any) => UseFormRegisterReturn
  handleSubmit: UseFormHandleSubmit<ForgotPasswordData>
  errors: FieldErrors<ForgotPasswordData>
  onSendCode: (data: ForgotPasswordData) => void
  onCodeChange: (code: string) => void
  onResend: () => void
  onContinue: () => void
  code: string
  email: string
}

export interface VerifyEmailProps {
  isDark: boolean
  toggleTheme: () => void
  error: string
  success: string
  resendMessage: string
  loading: boolean
  verifying: boolean
  resending: boolean
  resendCooldownSeconds: number
  register: (name: keyof VerifyEmailData, options?: any) => UseFormRegisterReturn
  handleSubmit: UseFormHandleSubmit<VerifyEmailData>
  errors: FieldErrors<VerifyEmailData>
  onSubmit: (data: VerifyEmailData) => void
  onCodeChange: (code: string) => void
  onResend: () => void
  code: string
  email: string
}

export interface ResetPasswordProps {
  isDark: boolean
  toggleTheme: () => void
  error: string
  success: string
  loading: boolean
  verifying: boolean
  codeValid: boolean
  code: string | null
  email: string | null
  register: (name: keyof ResetPasswordFormData, options?: any) => UseFormRegisterReturn
  handleSubmit: UseFormHandleSubmit<ResetPasswordFormData>
  errors: FieldErrors<ResetPasswordFormData>
  password: string
  onSubmit: (data: ResetPasswordFormData) => void
}
