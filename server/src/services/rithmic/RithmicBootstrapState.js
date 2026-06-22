/** Validated Rithmic credentials from config.json after a successful startup login. */
let bootstrapCredentials = null

export function getBootstrapRithmicCredentials() {
  return bootstrapCredentials
}

export function setBootstrapRithmicCredentials(credentials) {
  bootstrapCredentials = credentials
}
