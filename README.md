# MiniLedger 

MiniLedger is a minimal full-stack application designed to help users track money lent to friends, monitor repayment statuses, and view real-time financial summaries. 

This project was built as a technical assessment submission.

## Key Features

*   **Secure Passwordless Authentication:** Dynamic phone number login utilizing a mock SMS OTP system (displayed safely in the backend server logs).
*   **Loan Management Dashboard:** Seamlessly log new lending entries complete with friend details, exact amounts, and set due dates. Easily mark existing entries as fully repaid.
*   **Intelligent Financial Summaries:** A real-time data overview component tracking Total Lent, Total Repaid, and highlighting Overdue Amounts.
*   **Visual Status Indicators:** Automatic highlighting and visual sorting for overdue transactions to ensure high-priority entries are instantly visible.

## Tech Stack

*   **Frontend:** React Native, Expo Go, TypeScript
*   **Backend:** Node.js, Express, TypeScript, pg-client
*   **Database:** PostgreSQL

## Run it

You need Node 20+ and PostgreSQL 16+. To run the app on a phone, install **Expo Go** and keep the phone on the same Wi-Fi as your computer.

### 1. Database

local PostgreSQL:

```bash
psql -U postgres -c "CREATE USER miniledger WITH PASSWORD 'miniledger';"
psql -U postgres -c "CREATE DATABASE miniledger OWNER miniledger;"
```

Both give you `postgres://miniledger:miniledger@localhost:5432/miniledger`, which is the default in `.env.example`.

### 2. Backend

```bash
cd backend
cp .env.example .env      # adjust DATABASE_URL / JWT_SECRET if needed
npm install
npm run dev               # creates the tables on first start, listens on :4000
```

**Mock OTP:** when you request a code, it's printed in this terminal:

```
[MOCK SMS] OTP for +919876543210: 482913 (valid 5 min)
```

### 3. Mobile app

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go. The app finds the backend automatically: Expo Go knows your computer's address, and the app talks to port 4000 on that same machine.

### Tests

```bash
cd backend
npm test            # 35 tests; no database setup needed 
```
