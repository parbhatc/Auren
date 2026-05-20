import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import ConfigLoader from '../config/ConfigLoader.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Email service class
 * Handles sending emails with professional HTML templates
 */
class EmailService {
  constructor() {
    this.config = ConfigLoader.load()
    this.transporter = null
    this.templatePath = path.join(__dirname, '../templates/email-template.html')
    this.emailTemplate = null
    this.loadTemplate()
    this.initializeTransporter()
  }

  /**
   * Load email template from HTML file
   */
  loadTemplate() {
    try {
      this.emailTemplate = fs.readFileSync(this.templatePath, 'utf8')
      console.log('✅ Email template loaded successfully')
    } catch (error) {
      console.error('❌ Error loading email template:', error.message)
      throw new Error('Failed to load email template')
    }
  }

  /**
   * Initialize nodemailer transporter
   * Configured for Gmail SMTP
   */
  initializeTransporter() {
    // Load SMTP credentials from config.json
    const smtpUser = this.config.email.smtp?.user
    const smtpPass = this.config.email.smtp?.password

    if (!smtpUser || !smtpPass) {
      console.warn('⚠️  SMTP credentials not configured in config.json. Email sending will be logged to console.')
      console.warn('⚠️  To enable email sending, add smtp.user and smtp.password to data/config.json')
      // Use console transport for development
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      })
      return
    }

    // Gmail SMTP settings
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass, // Gmail app-specific password
      },
      tls: {
        rejectUnauthorized: false,
      },
    })

    console.log(`✅ Email transporter configured for ${smtpUser}`)
  }

  /**
   * Generate email HTML template with dynamic content
   */
  getEmailTemplate({ title, greeting, message, code, buttonText, buttonLink, footerText }) {
    const appName = this.config.email.appName
    const supportEmail = this.config.email.supportEmail
    const currentYear = new Date().getFullYear()

    // SVG Logo (NexusSync logo - trending up icon)
    const logo = `
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="6" fill="#10b981"/>
        <path d="M16 7h6v6m-6-6l-8.5 8.5-5-5L2 17" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `

    // Build message section
    const messageSection = message 
      ? `<p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">${message}</p>`
      : ''

    // Build code section
    const codeSection = code
      ? `
              <!-- Verification Code Box -->
              <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 2px solid #10b981; border-radius: 12px; padding: 24px; text-align: center; margin: 32px 0;">
                <p style="margin: 0 0 12px 0; color: #065f46; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                  Your Verification Code
                </p>
                <div style="font-size: 36px; font-weight: 700; color: #10b981; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                  ${code}
                </div>
                <p style="margin: 12px 0 0 0; color: #047857; font-size: 12px;">
                  This code expires in ${this.config.verificationCode.expiryMinutes} minutes
                </p>
              </div>
              `
      : ''

    // Build button section
    const buttonSection = buttonText && buttonLink
      ? `
              <!-- Button -->
              <table role="presentation" style="width: 100%; margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="${buttonLink}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>
              `
      : ''

    // Build footer text section
    const footerTextSection = footerText
      ? `<p style="margin: 32px 0 0 0; color: #9ca3af; font-size: 14px; line-height: 1.6; border-top: 1px solid #e5e7eb; padding-top: 24px;">
                ${footerText}
              </p>`
      : ''

    // Replace placeholders in template
    let html = this.emailTemplate
      .replace(/\{\{title\}\}/g, title)
      .replace(/\{\{greeting\}\}/g, greeting)
      .replace(/\{\{message\}\}/g, messageSection)
      .replace(/\{\{codeSection\}\}/g, codeSection)
      .replace(/\{\{buttonSection\}\}/g, buttonSection)
      .replace(/\{\{footerText\}\}/g, footerTextSection)
      .replace(/\{\{logo\}\}/g, logo)
      .replace(/\{\{appName\}\}/g, appName)
      .replace(/\{\{supportEmail\}\}/g, supportEmail)
      .replace(/\{\{currentYear\}\}/g, currentYear.toString())

    return html
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(email, name, code) {
    const appUrl = this.config.email.appName
    const verificationLink = `${this.config.email.appUrl}/verify-email?code=${code}&email=${encodeURIComponent(email)}`

    const html = this.getEmailTemplate({
      title: 'Verify Your Email Address',
      greeting: `Hello ${name},`,
      message: `Thank you for signing up for ${this.config.email.appName}! To complete your registration, please verify your email address using the code below.`,
      code: code,
      buttonText: 'Verify Email Address',
      buttonLink: verificationLink,
      footerText: `If you didn't create an account with ${this.config.email.appName}, you can safely ignore this email.`,
    })

    return this.sendEmail({
      to: email,
      subject: `Verify Your ${this.config.email.appName} Account`,
      html,
    })
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, code) {
    const resetLink = `${this.config.email.appUrl}/reset-password?code=${code}&email=${encodeURIComponent(email)}`

    const html = this.getEmailTemplate({
      title: 'Reset Your Password',
      greeting: 'Hello,',
      message: `We received a request to reset your password for your ${this.config.email.appName} account. Use the code below to reset your password.`,
      code: code,
      buttonText: 'Reset Password',
      buttonLink: resetLink,
      footerText: `If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged. This code expires in ${this.config.resetCode.expiryMinutes} minutes.`,
    })

    return this.sendEmail({
      to: email,
      subject: `Reset Your ${this.config.email.appName} Password`,
      html,
    })
  }

  /**
   * Send email
   */
  async sendEmail({ to, subject, html }) {
    try {
      const mailOptions = {
        from: this.config.email.from,
        to,
        subject,
        html,
      }

      const info = await this.transporter.sendMail(mailOptions)

      // If using console transport (development), log the email
      if (this.transporter.transporter && this.transporter.transporter.name === 'JSONTransport') {
        console.log('\n📧 Email sent (development mode - SMTP_PASS not configured):')
        console.log('To:', to)
        console.log('Subject:', subject)
        console.log('HTML Preview:', html.substring(0, 200) + '...')
        console.log('Full email info:', JSON.stringify(info, null, 2))
        console.log('\n💡 To enable real email sending, set SMTP_PASS in .env file')
        console.log('   See README.md for Gmail setup instructions\n')
      } else {
        console.log(`✅ Email sent successfully to ${to}`)
      }

      return { success: true, messageId: info.messageId }
    } catch (error) {
      console.error('❌ Error sending email:', error)
      throw new Error('Failed to send email')
    }
  }
}

export default new EmailService()

