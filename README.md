# SpendStudent 💸

A robust, multi-device personal finance tracker designed to help students manage expenses, track savings, and split costs. Built with a mobile-first Progressive Web App (PWA) approach, SpendStudent bridges the gap between offline-capable local storage and real-time cloud synchronization.

## ✨ Features

* **Multi-Device Cloud Sync:** Two-way data synchronization using Supabase as the master source of truth, ensuring your phone and laptop always reflect the exact same ledger.
* **Local-First Architecture:** Powered by Dexie.js (IndexedDB) for blazing-fast load times and resilient offline capabilities.
* **Mobile-Optimized UX:** A clean, responsive interface tailored for on-the-go financial tracking without redundant toggles.
* **Fluid Animations:** Custom loading guards, splash screens, and micro-interactions built with Framer Motion and specialized UI libraries.
* **Enterprise-Grade Security:** Strict Row Level Security (RLS) policies in PostgreSQL ensure your financial data is completely isolated and secure.

## 🛠 Tech Stack

* **Frontend:** React, Vite, Tailwind CSS, Framer Motion
* **Local Database:** Dexie.js
* **Cloud Database & Auth:** Supabase (PostgreSQL)
* **Deployment & CI/CD:** Vercel

## 🚀 Getting Started

### Prerequisites

* Node.js (v18 or higher)
* A [Supabase](https://supabase.com/) account
* A [Vercel](https://vercel.com/) account

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/abikurian/split-finance-tracker.git](https://github.com/abikurian/split-finance-tracker.git)
   cd split-finance-tracker
# SpendStudent 💸

A robust, multi-device personal finance tracker designed to help students manage expenses, track savings, and split costs. Built with a mobile-first Progressive Web App (PWA) approach, SpendStudent bridges the gap between offline-capable local storage and real-time cloud synchronization.

## ✨ Features

* **Multi-Device Cloud Sync:** Two-way data synchronization using Supabase as the master source of truth, ensuring your phone and laptop always reflect the exact same ledger.
* **Local-First Architecture:** Powered by Dexie.js (IndexedDB) for blazing-fast load times and resilient offline capabilities.
* **Mobile-Optimized UX:** A clean, responsive interface tailored for on-the-go financial tracking without redundant toggles.
* **Fluid Animations:** Custom loading guards, splash screens, and micro-interactions built with Framer Motion and specialized UI libraries.
* **Enterprise-Grade Security:** Strict Row Level Security (RLS) policies in PostgreSQL ensure your financial data is completely isolated and secure.

## 🛠 Tech Stack

* **Frontend:** React, Vite, Tailwind CSS, Framer Motion
* **Local Database:** Dexie.js
* **Cloud Database & Auth:** Supabase (PostgreSQL)
* **Deployment & CI/CD:** Vercel

## 🚀 Getting Started

### Prerequisites

* Node.js (v18 or higher)
* A [Supabase](https://supabase.com/) account
* A [Vercel](https://vercel.com/) account

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/abikurian/split-finance-tracker.git](https://github.com/abikurian/split-finance-tracker.git)
   cd split-finance-tracker
2. Install dependencies:

   ```bash
   npm install
3. Configure Environment Variables:
Create a .env file in the root directory and add your Supabase credentials:

Code snippet
   ```bash
   VITE_SUPABASE_URL=[https://your-project-url.supabase.co](https://your-project-url.supabase.co)
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
Initialize the Cloud Database:
Open your Supabase project's SQL Editor and execute the schema script to create the accounts, categories, transactions, people, and friends tables. Ensure Row Level Security (RLS) is enabled for all tables so multi-device sync functions correctly.

Start the development server:

Bash
npm run dev
🏗 Deployment
This project is configured for seamless deployment on Vercel. Pushing to the main branch will automatically trigger a new production build. Ensure your Vercel project's Environment Variables match your local .env configuration.

👨‍💻 Author
Abi Kurian Varghese

GitHub: @abikurian
