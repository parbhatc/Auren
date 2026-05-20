import Database from './Database.js'

/**
 * Database migration class
 * Handles database schema updates and migrations
 */
class DatabaseMigration {
  /**
   * Run all migrations
   */
  async runMigrations() {
    try {
      await Database.initialize()
      console.log('✅ Database migrations completed')
    } catch (error) {
      console.error('❌ Database migration failed:', error)
      throw error
    }
  }
}

export default new DatabaseMigration()

