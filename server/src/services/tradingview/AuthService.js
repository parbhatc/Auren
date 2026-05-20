/**
 * TradingView Authentication Service
 * Handles TradingView API authentication
 */
import puppeteer from 'puppeteer'

class AuthService {
  constructor(baseURL = 'https://www.tradingview.com') {
    this.baseURL = baseURL
  }


  /**
   * Login to TradingView using Puppeteer
   * This bypasses Cloudflare protection and CAPTCHA by using a real browser
   * @param {string} username - Username or email for login
   * @param {string} password - Password for login
   * @param {Object} [options={}] - Additional options
   * @param {boolean} [options.remember=true] - Whether to remember the session
   * @param {boolean} [options.headless=true] - Whether to run browser in headless mode
   * @returns {Promise<{success: boolean, error?: string, user?: object, auth_token?: string, session_hash?: string}>}
   * @description
   *   - On success: Returns user object, auth_token, and session_hash
   *   - On failure: Returns error message with code
   */
  async login(username, password, options = {}) {
    const { remember = true, headless = true } = options
    let browser = null
    
    try {
      if (!username || !password) {
        return {
          success: false,
          error: 'Username and password are required',
          code: 'missing_credentials'
        }
      }

      // Launch browser
      browser = await puppeteer.launch({
        headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-blink-features=AutomationControlled',
        ],
      })

      const page = await browser.newPage()
      
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0')
      
      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 })

      // Remove webdriver property to avoid detection
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        })
      })

      // Set up response interceptor to catch login API response
      let loginResponse = null
      page.on('response', async (response) => {
        const url = response.url()
        if (url.includes('/accounts/signin/')) {
          try {
            const data = await response.json()
            loginResponse = data
          } catch (e) {
            // Response might not be JSON
          }
        }
      })

      // Navigate to homepage
      await page.goto(`${this.baseURL}/`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })

      // Wait for page to load
      await page.waitForTimeout(2000)

      // Wait for and click the sign-in button
      try {
        await page.waitForSelector('button[data-name="header-user-menu-sign-in"]', { timeout: 10000 })
        await page.click('button[data-name="header-user-menu-sign-in"]')
      } catch (error) {
        // Try alternative selectors if the main one doesn't work
        const signInSelectors = [
          'button[data-name="header-user-menu-sign-in"]',
          'a[href*="signin"]',
          '.item-jFqVJoPk[data-name="header-user-menu-sign-in"]',
        ]
        
        let clicked = false
        for (const selector of signInSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 5000 })
            await page.click(selector)
            clicked = true
            break
          } catch (e) {
            continue
          }
        }
        
        if (!clicked) {
          throw new Error('Could not find sign-in button')
        }
      }

      // Wait for login form/modal to appear
      await page.waitForTimeout(1000)

      // Fill in username
      try {
        // Try different username input selectors
        const usernameSelectors = [
          'input[name="username"]',
          'input[type="text"][placeholder*="username" i]',
          'input[type="email"]',
          'input[id*="username" i]',
        ]
        
        let usernameFilled = false
        for (const selector of usernameSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 3000 })
            await page.type(selector, username, { delay: 50 })
            usernameFilled = true
            break
          } catch (e) {
            continue
          }
        }
        
        if (!usernameFilled) {
          throw new Error('Could not find username input field')
        }
      } catch (error) {
        return {
          success: false,
          error: 'Could not find username input field: ' + error.message,
          code: 'form_not_found'
        }
      }

      // Fill in password
      try {
        const passwordSelectors = [
          'input[name="password"]',
          'input[type="password"]',
          'input[id*="password" i]',
        ]
        
        let passwordFilled = false
        for (const selector of passwordSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 3000 })
            await page.type(selector, password, { delay: 50 })
            passwordFilled = true
            break
          } catch (e) {
            continue
          }
        }
        
        if (!passwordFilled) {
          throw new Error('Could not find password input field')
        }
      } catch (error) {
        return {
          success: false,
          error: 'Could not find password input field: ' + error.message,
          code: 'form_not_found'
        }
      }

      // Wait a bit before submitting
      await page.waitForTimeout(500)

      // Submit the form
      try {
        const submitSelectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          'button:has-text("Sign in")',
          'button:has-text("Log in")',
        ]
        
        let submitted = false
        for (const selector of submitSelectors) {
          try {
            const element = await page.$(selector)
            if (element) {
              await element.click()
              submitted = true
              break
            }
          } catch (e) {
            continue
          }
        }
        
        // If no submit button found, try pressing Enter
        if (!submitted) {
          await page.keyboard.press('Enter')
        }
      } catch (error) {
        return {
          success: false,
          error: 'Could not submit login form: ' + error.message,
          code: 'submit_failed'
        }
      }

      // Wait for login response (max 30 seconds)
      let attempts = 0
      while (!loginResponse && attempts < 60) {
        await page.waitForTimeout(500)
        attempts++
      }

      if (!loginResponse) {
        return {
          success: false,
          error: 'Login request timed out - no response received',
          code: 'timeout'
        }
      }

      // Check if login was successful
      if (loginResponse.error && loginResponse.error.trim() !== '') {
        return {
          success: false,
          error: loginResponse.error,
          code: loginResponse.code || 'login_failed'
        }
      }

      // Successful login
      if (loginResponse.user && loginResponse.auth_token) {
        return {
          success: true,
          user: loginResponse.user,
          auth_token: loginResponse.auth_token,
          session_hash: loginResponse.session_hash || null
        }
      }

      // Unexpected response format
      return {
        success: false,
        error: 'Unexpected response format from TradingView',
        code: 'invalid_response'
      }
    } catch (error) {
      console.error('TradingView login error:', error)
      return {
        success: false,
        error: error.message || 'Failed to login to TradingView',
        code: 'connection_error'
      }
    } finally {
      if (browser) {
        await browser.close()
      }
    }
  }
}

export default AuthService
