# Architecture Documentation

## Project Structure

```
src/
├── components/
│   ├── auth/              # Authentication pages
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   └── ForgotPassword.tsx
│   ├── common/            # Reusable UI components
│   │   ├── ErrorMessage.tsx
│   │   ├── SuccessMessage.tsx
│   │   ├── SubmitButton.tsx
│   │   ├── PageHeader.tsx
│   │   └── AuthLink.tsx
│   ├── ThemeToggle.tsx    # Theme switcher component
│   ├── LoginCard.tsx      # Card wrapper component
│   ├── Logo.tsx           # Logo component
│   └── InputField.tsx     # Form input component
├── hooks/
│   ├── useAuth.ts         # Authentication logic hook
│   └── useTheme.ts        # Theme management hook
├── services/
│   └── api.ts             # API service layer
├── types/
│   └── auth.ts            # TypeScript type definitions
├── constants/
│   ├── routes.ts           # Route constants
│   └── messages.ts        # UI messages and validation rules
├── utils/
│   ├── validation.ts      # Validation utilities
│   └── errorHandler.ts    # Error handling utilities
└── App.tsx                # Main app component with routing
```

## Design Principles

### 1. Separation of Concerns
- **Components**: Handle UI rendering only
- **Hooks**: Contain business logic and state management
- **Services**: Handle API communication
- **Utils**: Provide pure utility functions
- **Types**: Define TypeScript interfaces

### 2. Reusability
- Common components (`ErrorMessage`, `SubmitButton`, etc.) are reusable
- Custom hooks (`useAuth`, `useTheme`) encapsulate logic
- Utility functions are pure and testable

### 3. Type Safety
- All components and functions are fully typed
- Types are centralized in `src/types/`
- No `any` types used

### 4. Maintainability
- Constants are centralized (`routes.ts`, `messages.ts`)
- Clear naming conventions
- Comprehensive JSDoc comments
- Consistent code structure

## Component Architecture

### Authentication Pages
All auth pages follow the same structure:
1. Theme management via `useTheme` hook
2. Form handling via `react-hook-form`
3. API calls via `useAuth` hook
4. Consistent UI components

### Custom Hooks

#### `useAuth`
- Manages authentication state (error, loading)
- Provides login, register, forgotPassword functions
- Handles navigation after successful operations
- Centralizes error handling

#### `useTheme`
- Manages dark/light theme state
- Applies theme to document root
- Provides toggle function

## API Service Layer

The `api.ts` file provides:
- Centralized API configuration
- Typed API methods
- Consistent error handling
- JSDoc documentation

## Constants Management

### Routes (`constants/routes.ts`)
- Centralized route definitions
- Type-safe route constants
- Easy to update routes across the app

### Messages (`constants/messages.ts`)
- UI messages
- Error messages
- Validation rules
- Easy to internationalize later

## Error Handling

1. **API Errors**: Handled by `errorHandler.ts`
2. **Validation Errors**: Handled by `validation.ts`
3. **Component Errors**: Displayed via `ErrorMessage` component

## Adding New Features

### Adding a New Page
1. Create component in appropriate directory
2. Add route to `constants/routes.ts`
3. Add route to `App.tsx`
4. Use existing hooks and components

### Adding a New API Endpoint
1. Add method to `authAPI` in `services/api.ts`
2. Add types to `types/auth.ts`
3. Add to `useAuth` hook if needed
4. Use in components

### Adding a New Validation Rule
1. Add to `utils/validation.ts`
2. Add error message to `constants/messages.ts`
3. Use in form validation

## Best Practices

1. **Always use TypeScript types** - No `any` types
2. **Extract reusable logic** - Use hooks and utilities
3. **Centralize constants** - Don't hardcode values
4. **Handle errors gracefully** - Use error components
5. **Document complex logic** - Add JSDoc comments
6. **Keep components small** - Single responsibility
7. **Use consistent naming** - Follow existing patterns

