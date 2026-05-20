# Server Architecture Documentation

## Overview
The server has been refactored to use a clean class-based architecture following SOLID principles and industry best practices.

## Project Structure

```
server/
├── src/
│   ├── config/
│   │   ├── constants.js      # HTTP status codes, app config
│   │   └── database.js       # Database abstraction layer
│   ├── controllers/
│   │   └── AuthController.js # Request/response handling
│   ├── services/
│   │   ├── AuthService.js    # Business logic
│   │   └── TokenService.js   # Token management
│   ├── middleware/
│   │   ├── Validator.js       # Request validation
│   │   ├── ErrorHandler.js   # Error handling
│   │   └── CorsMiddleware.js # CORS configuration
│   ├── routes/
│   │   ├── AuthRoutes.js     # Auth route definitions
│   │   └── index.js          # Route aggregator
│   ├── app.js                # Express app configuration
│   └── server.js             # Server initialization
└── server.js                 # Entry point
```

## Architecture Layers

### 1. **Entry Point** (`server.js`)
- Creates and starts the server
- Minimal, single responsibility

### 2. **Server Class** (`src/server.js`)
- Initializes Express app
- Configures port
- Starts listening

### 3. **App Class** (`src/app.js`)
- Configures Express middleware
- Sets up routes
- Centralized app configuration

### 4. **Routes Layer** (`src/routes/`)
- **AuthRoutes**: Defines authentication endpoints
- **index**: Combines all routes
- Uses class-based pattern for organization

### 5. **Controllers Layer** (`src/controllers/`)
- **AuthController**: Handles HTTP requests/responses
- Delegates business logic to services
- Handles errors appropriately

### 6. **Services Layer** (`src/services/`)
- **AuthService**: Contains authentication business logic
- **TokenService**: Handles JWT and reset tokens
- Pure business logic, no HTTP concerns

### 7. **Middleware Layer** (`src/middleware/`)
- **Validator**: Request validation
- **ErrorHandler**: Centralized error handling
- **CorsMiddleware**: CORS configuration

### 8. **Config Layer** (`src/config/`)
- **constants**: HTTP status codes, app config
- **database**: Database abstraction (replace with real DB)

## Class Responsibilities

### Server Class
- Server initialization
- Port configuration
- Starting the server

### App Class
- Express app setup
- Middleware configuration
- Route registration

### AuthRoutes Class
- Route definitions
- Middleware attachment
- Route organization

### AuthController Class
- HTTP request handling
- Response formatting
- Error delegation

### AuthService Class
- User registration logic
- Login logic
- Password reset logic
- Business rules

### TokenService Class
- JWT generation
- Reset token generation
- Token verification
- Token cleanup

### Database Class
- User CRUD operations
- Reset token management
- Data persistence abstraction

### Validator Class
- Request validation
- Input sanitization
- Error responses

### ErrorHandler Class
- Error type handling
- Consistent error responses
- Error logging

## Design Patterns Used

### 1. **Class-Based Architecture**
- Each module is a class
- Clear separation of concerns
- Easy to test and mock

### 2. **Service Layer Pattern**
- Business logic separated from HTTP
- Reusable services
- Testable business logic

### 3. **Repository Pattern** (Database class)
- Data access abstraction
- Easy to swap implementations
- Testable with mocks

### 4. **Middleware Pattern**
- Request validation
- Error handling
- Cross-cutting concerns

## Benefits

### 1. **Maintainability**
- Clear structure
- Easy to locate code
- Single responsibility principle

### 2. **Scalability**
- Easy to add new features
- Modular architecture
- Clear extension points

### 3. **Testability**
- Classes can be mocked
- Services are testable
- Clear dependencies

### 4. **Readability**
- Self-documenting code
- Clear class names
- Organized structure

### 5. **Team Collaboration**
- Clear ownership
- Easy to understand
- Consistent patterns

## Adding New Features

### Adding a New Endpoint

1. **Add route** in `AuthRoutes.js`:
```javascript
this.router.post('/new-endpoint', 
  Validator.validateNewEndpoint.bind(Validator),
  AuthController.newEndpoint.bind(AuthController)
)
```

2. **Add controller method** in `AuthController.js`:
```javascript
async newEndpoint(req, res) {
  try {
    const result = await AuthService.newMethod()
    return res.status(HTTP_STATUS.OK).json(result)
  } catch (error) {
    return ErrorHandler.handleServerError(res, error)
  }
}
```

3. **Add service method** in `AuthService.js`:
```javascript
async newMethod() {
  // Business logic here
  return { success: true, message: 'Success' }
}
```

4. **Add validation** in `Validator.js`:
```javascript
validateNewEndpoint(req, res, next) {
  // Validation logic
  next()
}
```

## Database Migration

To replace in-memory database with real database:

1. Replace `Database` class implementation
2. Keep the same interface/methods
3. Update `src/config/database.js`
4. No changes needed in services/controllers

## Environment Variables

```env
PORT=3001
JWT_SECRET=your-secret-key-change-in-production
CORS_ORIGIN=http://localhost:2000
```

## Testing Strategy

Each layer can be tested independently:
- **Services**: Unit tests with mocked database
- **Controllers**: Integration tests with mocked services
- **Routes**: End-to-end tests
- **Validators**: Unit tests for validation logic

## Future Improvements

1. Add logging service (Winston/Pino)
2. Add rate limiting middleware
3. Add request logging middleware
4. Add database connection pooling
5. Add API documentation (Swagger)
6. Add unit and integration tests
7. Add Docker configuration
8. Add CI/CD pipeline

