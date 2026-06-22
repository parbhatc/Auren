import Database from '../../config/Database.js'
import PropsController from '../../controllers/PropsController.js'
import { getBootstrapRithmicCredentials } from './RithmicBootstrapState.js'

async function readStoredRithmicCredentials(userId) {
  await PropsController.initializeTable()
  const row = await Database.get(
    'SELECT credentials_encrypted FROM prop_firms WHERE user_id = ? AND type = ?',
    [userId, 'rithmic']
  )
  if (!row?.credentials_encrypted) return null
  return PropsController.decryptCredentials(row.credentials_encrypted)
}

export async function getRithmicCredentials(userId) {
  const stored = await readStoredRithmicCredentials(userId)
  if (stored?.username?.trim() && stored?.password) {
    return stored
  }
  return getBootstrapRithmicCredentials()
}

export async function upsertRithmicCredentials(userId, credentials) {
  await PropsController.initializeTable()
  const encrypted = await PropsController.encryptCredentials(credentials)
  const existing = await Database.get(
    'SELECT id FROM prop_firms WHERE user_id = ? AND type = ?',
    [userId, 'rithmic']
  )
  if (existing) {
    await Database.run(
      'UPDATE prop_firms SET credentials_encrypted = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [encrypted, existing.id]
    )
    return true
  }
  await Database.run(
    'INSERT INTO prop_firms (user_id, type, name, display_name, enabled, credentials_encrypted) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, 'rithmic', 'rithmic', 'Rithmic', 1, encrypted]
  )
  return true
}

export async function saveRithmicCredentials(userId, credentials) {
  await PropsController.initializeTable()
  const row = await Database.get(
    'SELECT id FROM prop_firms WHERE user_id = ? AND type = ?',
    [userId, 'rithmic']
  )
  if (!row) return false

  const encrypted = await PropsController.encryptCredentials(credentials)
  await Database.run(
    'UPDATE prop_firms SET credentials_encrypted = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [encrypted, row.id]
  )
  return true
}

/** Mark Rithmic as logged out in stored credentials (e.g. duplicate session / login rejected). */
export async function clearRithmicLoginPassed(userId) {
  const credentials = await getRithmicCredentials(userId)
  if (!credentials) return
  await saveRithmicCredentials(userId, {
    ...credentials,
    loginPassed: false,
  })
}
