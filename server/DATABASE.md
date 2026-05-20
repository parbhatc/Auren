# Database Documentation

## Overview

The server uses **SQLite** as the database system. SQLite is a lightweight, file-based database that's perfect for development and small to medium-scale applications.

## Database Location

- **Path**: `server/data/database.sqlite`
- **Created**: Automatically on first server start
- **Backup**: Include `data/` directory in your backup strategy

## Schema

### Users Table

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Indexes:**
- `idx_users_email` on `email`
- `idx_users_username` on `username`

### Reset Tokens Table

```sql
CREATE TABLE reset_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Indexes:**
- `idx_reset_tokens_email` on `email`

## Database Operations

All database operations are handled through the `Database` class in `src/config/Database.js`.

### User Operations

- `findUserByUsernameOrEmail(usernameOrEmail)` - Find user by username or email
- `findUserByEmail(email)` - Find user by email
- `findUserById(id)` - Find user by ID
- `createUser(userData)` - Create new user
- `updateUserPassword(email, hashedPassword)` - Update user password
- `userExists(username, email)` - Check if user exists

### Reset Token Operations

- `storeResetToken(token, email)` - Store reset token
- `getEmailByResetToken(token)` - Get email by token (checks expiry)
- `deleteResetToken(token)` - Delete reset token
- `cleanExpiredTokens()` - Remove expired tokens

## Automatic Cleanup

- Expired reset tokens are automatically cleaned up:
  - On server startup
  - Every hour via scheduled task

## Database Initialization

The database is automatically initialized when the server starts:

1. Creates `data/` directory if it doesn't exist
2. Connects to SQLite database
3. Creates tables if they don't exist
4. Creates indexes
5. Cleans expired tokens

## Backup and Migration

### Backup

To backup your database:
```bash
cp data/database.sqlite data/database.sqlite.backup
```

### Migration to Another Database

To migrate to PostgreSQL, MySQL, or MongoDB:

1. Update `src/config/Database.js` with new database connection
2. Update SQL queries to match new database syntax
3. Keep the same method signatures for compatibility

### Viewing Database

You can use SQLite command-line tool or GUI tools like:
- **DB Browser for SQLite** (GUI)
- **SQLite CLI**: `sqlite3 data/database.sqlite`

Example queries:
```sql
-- View all users
SELECT id, username, email, created_at FROM users;

-- View reset tokens
SELECT token, email, expires_at FROM reset_tokens;

-- Count users
SELECT COUNT(*) FROM users;
```

## Performance Considerations

- SQLite is suitable for:
  - Development and testing
  - Small to medium applications (< 100K users)
  - Single-server deployments
  
- For production at scale, consider:
  - PostgreSQL for better concurrency
  - MySQL for better performance
  - MongoDB for document-based storage

## Security Notes

- Database file should be in `.gitignore` (already configured)
- Passwords are hashed using bcrypt before storage
- Reset tokens expire after 1 hour
- Database file permissions should be restricted

## Troubleshooting

### Database locked error
- Ensure only one server instance is running
- Check file permissions

### Database file not found
- Ensure `data/` directory exists
- Check write permissions

### Migration issues
- Backup existing database before migration
- Test migration on development environment first

