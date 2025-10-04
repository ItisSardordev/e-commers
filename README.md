# E-commerce demo

## Talablar

- Node.js (v14+)

## O'rnatish

1. Loyihani klonlang:
   git clone ...

2. Paketlarni o'rnating:
   npm install

3. .env faylini backend/.env ga nusxa ko'chiring (.env.example dan) va to'ldiring:

   - JWT_SECRET
   - ADMIN_PASSWORD_HASH (yoki quyidagi hash skriptidan yarating)
   - STRIPE_SECRET_KEY
   - PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET

   **Parol hash yaratish:**
   node -e "const bcrypt=require('bcrypt');(async()=>console.log(await bcrypt.hash('SizningParolingiz',10)))()"

   Olingan hashni `.env` dagi ADMIN_PASSWORD_HASH maydoniga joylang.

4. Serverni ishga tushurish:
   npm start

5. Brauzer:
   - Do'kon: http://localhost:3000/
   - Admin: http://localhost:3000/admin.html

## Eslatmalar

- PayPal SDK frontend uchun `index.html` ichidagi `YOUR_PAYPAL_CLIENT_ID` ni almashtiring.
- Stripe Checkout ishlashi uchun `.env` dagi `STRIPE_SECRET_KEY` to'g'ri bo'lishi kerak.
- Production uchun webhook sign verification, HTTPS va real DB (Postgres/Mongo) talab qilinadi.
