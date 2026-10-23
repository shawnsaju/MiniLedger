# MiniLedger 

MiniLedger is a minimal full-stack application designed to help users track money lent to friends, monitor repayment statuses, and view real-time financial summaries. 

This project was built as a technical assessment submission.

## Key Features

*   **Secure Passwordless Authentication:** Dynamic phone number login utilizing a mock SMS OTP system (displayed safely in the backend server logs).
*   **Loan Management Dashboard:** Seamlessly log new lending entries complete with friend details, exact amounts, and set due dates. Easily mark existing entries as fully repaid.
*   **Intelligent Financial Summaries:** A real-time data overview component tracking Total Lent, Total Repaid, and highlighting Overdue Amounts.
*   **Visual Status Indicators:** Automatic highlighting and visual sorting for overdue transactions to ensure high-priority entries are instantly visible.

## 🛠️ Tech Stack

*   **Frontend:** React Native, Expo Go, TypeScript
*   **Backend:** Node.js, Express, TypeScript, Prisma/TypeORM (or standard pg-client)
*   **Database:** PostgreSQL
