# Leap Frogs Auth Service

NestJS-based authentication service supporting user registration, login, token refresh, and logout.

## Setup

```bash
npm install
```

## Build & Run

```bash
npm run build
npm run start
```

The service listens on `http://localhost:3000`

## Endpoints

### POST /auth/register
Register a new user
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"<username>","password":"<password>"}'
```
Response:
```json
{"username":"alice","registered":true}
```

### POST /auth/login
Login with credentials
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<configured-user>","password":"<configured-password>"}'
```
Response:
```json
{
  "accessToken":"<access-token>",
  "refreshToken":"<refresh-token>"
}
```

### POST /auth/refresh
Refresh access token using refresh token
```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh-token>"}'
```
Response:
```json
{"accessToken":"<access-token>"}
```

### POST /auth/logout
Logout and invalidate refresh token
```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh-token>"}'
```
Response:
```json
{"loggedOut":true}
```

## Implementation Notes

- In-memory user store (suitable for development/testing)
- Stub token generation for demonstration purposes
- Input validation using class-validator
- All refresh tokens are invalidated on logout
