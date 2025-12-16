FrontDeskFlow 🏨

Front Desk & Operations Management System

FrontDeskFlow is a web-based front desk and operations management system designed for hotels and hospitality facilities.
The system is intended for internal staff only (front desk agents, managers, and operations teams) and focuses on operational flow, room status management, and guest handling.

✨ Key Features

🛎️ Room status management (Available / Occupied / Cleaning / Maintenance)

👥 Guest and reservation handling

📅 Daily front desk operational flow

🔐 Role-based access (Front Desk / Manager)

📊 Infrastructure ready for reports and insights

⚡ High-performance database access using connection pooling

🧱 Tech Stack

Node.js

TypeScript

Prisma ORM (v6)

PostgreSQL (Supabase)

Supabase – Database & Auth

GraphQL (Pothos Prisma Types)

Yarn

📂 Project Structure
FrontDeskFlow/
├─ prisma/
│  └─ schema.prisma
├─ src/
│  ├─ graphql/
│  ├─ services/
│  └─ utils/
├─ .env
├─ package.json
└─ README.md

⚙️ Prerequisites

Node.js 18+

Yarn

Active Supabase project

Network access allowing direct PostgreSQL connections (port 5432)

🔐 Environment Variables (.env)
# Supabase – runtime (connection pooler)
DATABASE_URL="postgresql://USER:PASSWORD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require"

# Supabase – direct database connection (used for migrations)
DIRECT_URL="postgresql://USER:PASSWORD@db.<PROJECT_REF>.supabase.co:5432/postgres?sslmode=require"

# Supabase client
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

🗄️ Prisma Configuration
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // Pooler – runtime
  directUrl = env("DIRECT_URL")     // Direct – migrations
}

generator client {
  provider = "prisma-client-js"
}

generator pothos {
  provider = "prisma-pothos-types"
}

🚀 Installation & Setup
1️⃣ Install dependencies
yarn install

2️⃣ Generate Prisma Client
yarn prisma generate

3️⃣ Run database migrations (development)
yarn prisma migrate dev


⚠️ Important
prisma migrate dev requires a direct database connection (port 5432).
Some networks block this port — use a VPN or mobile hotspot if needed.

🧪 Useful Prisma Commands
yarn prisma studio        # Open Prisma Studio (DB GUI)
yarn prisma db push       # Sync schema without migrations
yarn prisma migrate reset # Reset database (development only)

🧠 Important Notes

Prisma migrate dev uses a Shadow Database internally

Supabase connection pooling is not suitable for schema migrations

Separating DATABASE_URL (pooler) and DIRECT_URL (direct DB) is mandatory

Prisma version used: Prisma 6

📌 Project Status

🚧 Active development
Designed for internal hotel operations and front desk teams
Architecture prepared for future extensions (reports, automation, AI agents)

👤 Author

Barak Mozes
Software Engineer & Systems Designer
🇮🇱 Israel