/** Stub — Topstep CSV download is optional; backtester uses local CSV data. */
export const topstepxAPI = {
  async login(_username: string, _password: string) {
    return {
      success: false,
      message: 'Topstep login is not configured in Auren.',
      token: '',
      result: 1,
    }
  },
}
