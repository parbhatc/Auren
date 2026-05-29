import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })

const { installRithmicWireDebug } = await import('./src/services/rithmic/installRithmicWireDebug.js')
await installRithmicWireDebug()

const { default: Server } = await import('./src/server.js')

/**
 * Entry point for the application
 * Creates and starts the server
 */
const server = new Server()
server.start().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
