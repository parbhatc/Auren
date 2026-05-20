import Server from './src/server.js'

/**
 * Entry point for the application
 * Creates and starts the server
 */
const server = new Server()
server.start().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
