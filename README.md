# Kimizo Store

Express backend + vanilla JS frontend, with role-based login.

## Run
```bash
npm install
npm start
```
- Store: http://localhost:3000
- Login: http://localhost:3000/login.html
- Admin: http://localhost:3000/admin (admin role only)

## Logins
| Role | Email | Password | Goes to |
|---|---|---|---|
| Admin | admin@zanoit.com | Admin@123 | Admin panel |
| Customer | anyone who signs up on the login page | their own | Store |

The admin account is created automatically on first start from `.env`
(`ADMIN_EMAIL`, `ADMIN_PASSWORD`). Change both before going live.

## Structure
```
kimizo-store/
├─ server.js      API + static server
├─ auth.js        password hashing + signed tokens
├─ .env           PORT, JWT_SECRET, admin login
├─ data/          products.json, orders.json, users.json, settings.json
└─ public/        index.html, login.html, admin.html, app.js, style.css
```

## API
Public: GET /api/products, GET /api/settings, POST /api/auth/register, POST /api/auth/login
Customer (token): GET /api/auth/me, POST /api/orders, GET /api/my-orders
Admin (token, admin role): products POST/PUT/DELETE, GET /api/orders, PATCH /api/orders/:id, PUT /api/settings
Send the token as `Authorization: Bearer <token>`.
