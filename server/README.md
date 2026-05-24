# NexusSyncPro Server

Express.js API server for NexusSyncPro authentication with SQLite database.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file:
```env
PORT=3001
JWT_SECRET=your-secret-key-change-in-production
```

3. Configure email settings in `data/config.json`:
```json
{
  "email": {
    "smtp": {
      "user": "your-email@gmail.com",
      "password": "your-gmail-app-specific-password"
    }
  }
}
```

**Gmail Setup Instructions:**
1. Go to your Google Account settings: https://myaccount.google.com/
2. Enable **2-Step Verification** (required for app passwords)
3. Go to **Security** > **2-Step Verification** > **App passwords**
4. Generate a new app password for "Mail"
5. Copy the 16-character password and add it to `data/config.json` under `email.smtp.password`

**Note:** If SMTP credentials are not configured in `config.json`, emails will be logged to console instead of being sent.

3. Database:
   - SQLite database will be automatically created in `data/database.sqlite` on first run
   - Tables are created automatically
   - No additional database setup required

## Running the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will run on `http://localhost:3001`

## API Endpoints

### POST `/api/auth/register`
Register a new user.

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "jwt-token",
  "user": {
    "id": "string",
    "username": "string",
    "email": "string"
  }
}
```

### POST `/api/auth/login`
Login with username/email and password.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt-token",
  "user": {
    "id": "string",
    "username": "string",
    "email": "string"
  }
}
```

### POST `/api/auth/forgot-password`
Request password reset link.

**Request Body:**
```json
{
  "email": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "If the email exists, a reset link has been sent"
}
```

### POST `/api/auth/reset-password`
Reset password with token.

**Request Body:**
```json
{
  "token": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

### GET `/api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

## Database

- **SQLite** database is used for data persistence
- Database file: `data/database.sqlite`
- Tables are automatically created on first run:
  - `users` - Stores user accounts (with email_verified flag)
  - `reset_tokens` - Stores password reset tokens
  - `verification_codes` - Stores email verification and password reset codes
- Expired reset tokens are automatically cleaned up

## Email Configuration

- **Email Service**: Configured for Gmail SMTP
- **From Address**: Set in `data/config.json` (configure SMTP user/password via environment or local config)
- **Email Templates**: Professional HTML templates with logo for:
  - Email verification (6-digit code)
  - Password reset (6-digit code)
- **Configuration**: Edit `data/config.json` to customize:
  - Password min/max length
  - Verification code length (4-8 digits)
  - Code expiry times
  - Email settings

## Notes

- **Default admin** (first run, empty database): username `admin`, password `admin`. Change after first login.
- **Email Verification**: New users must verify their email before logging in
- **Password Reset**: Uses 6-digit codes sent via email
- JWT tokens expire after 7 days (configurable in `data/config.json`)
- Verification codes expire after 15 minutes (configurable)
- Reset codes expire after 30 minutes (configurable)
- Database connection is managed automatically
- Expired tokens and codes are automatically cleaned up

