import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DEFAULT_PROP_FIRMS_DIR = path.resolve(__dirname, '../../../prop_firms')

export function loadPropFirmCatalog(directory = DEFAULT_PROP_FIRMS_DIR) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith('.provider.json'))
    .map((name) => {
      const descriptor = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'))
      if (descriptor?.schemaVersion !== 1 || !descriptor.id || !descriptor.driver) {
        throw new Error(`Invalid prop-firm provider descriptor: ${name}`)
      }
      return Object.freeze(descriptor)
    })
}

const catalog = loadPropFirmCatalog()

export function getPropFirmDescriptor(id) {
  return catalog.find((item) => item.id === id) || null
}

export default catalog
