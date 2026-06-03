import Database from '../../config/Database.js'
import PropsController from '../../controllers/PropsController.js'

export async function getRithmicCredentials(userId) {
  await PropsController.initializeTable()
  const row = await Database.get(
    'SELECT credentials_encrypted FROM prop_firms WHERE user_id = ? AND type = ?',
    [userId, 'rithmic']
  )
  if (!row?.credentials_encrypted) return null
  return PropsController.decryptCredentials(row.credentials_encrypted)
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
