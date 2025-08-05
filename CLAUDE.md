# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 application for digital identity certification using BSV blockchain technology. It implements a wallet-based authentication system where users can generate, store, and manage identity certificates.

## Plan & Review

### Before starting work
- Always in plan mode to make a plan
- After get the plan, make sure you Write the plan to .claude/tasks/TASK_NAME.md
- The plan should be a detailed implementation plan and the reasoning behind them, as well as tasks broken down.
- If the task requires external knowledge or certain package, also research to get latest knowledge (Use Task tool for research)
- Don't over plan it, always think MVP.
- Once you write the plan, firstly ask me to review it. Do not continue until I approve the plan.

### While implementing
- You should update the plan as you work.
- After you complete tasks in the plan, you should update and append detailed descriptions of the changes you made so subsequent tasks can be easily handed over to other engineers.

## Development Commands

### Main Application
```bash
# Development server (port 3000)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

### Backend Server
```bash
# Navigate to server directory
cd server

# Start certificate signing server (port 8080)
node index.js
```

## Architecture

### Tech Stack
- **Frontend**: Next.js 15 with App Router, React 19, Tailwind CSS
- **Backend**: Express server with BSV SDK for certificate signing
- **Database**: MongoDB for user data and email verification codes
- **Blockchain**: BSV SDK for wallet operations and certificate management
- **Authentication**: BSV Auth Express Middleware for mutual authentication

### Key Components

#### Authentication Flow
1. **Email Verification** (`src/app/page.js:54-90`): Users verify email before certificate generation
2. **Certificate Generation** (`src/app/page.js:28-51`): Creates BSV-based identity certificate with user data
3. **Wallet Integration** (`src/context/walletContext.js`): Manages wallet connection and certificate storage
4. **Auto-login** (`src/context/authContext.js`): Checks for existing certificates on wallet connection

#### Server Architecture
- **Certificate Signing Server** (`server/index.js`): Express server with BSV auth middleware at port 8080
- **Mutual Authentication**: All server routes require BSV authentication
- **CORS Configuration**: Configured for cross-origin requests from frontend

#### Database Structure
- **users collection**: Stores user certificates linked to public keys
- **verify collection**: Temporary storage for email verification codes with expiration

### API Routes

#### Frontend Routes (Next.js API)
- `/save-certificate`: Saves user certificate to MongoDB
- `/login`: Retrieves existing certificate for a public key
- `/delete-certificate`: Removes certificate from database
- `/emailVerify`: Handles email verification flow

#### Backend Routes (Express)
- `/signCertificate`: Signs certificates with server's private key

### Environment Variables

Required in `.env`:
```
# Frontend
NEXT_PUBLIC_SERVER_PUBLIC_KEY=<server_public_key>

# Backend
SERVER_PRIVATE_KEY=<server_private_key>
WALLET_STORAGE_URL=<wallet_storage_url>
MONGODB_URI=<mongodb_connection_string>
```

### Certificate Structure
Certificates contain:
- Type: "CommonSource user identity" (base64 encoded)
- Fields: username, residence, age, gender, email, work
- Certifier: Server's public key
- Subject: User's identity public key

## Key Implementation Details

### Wallet Context (`src/context/walletContext.js`)
- Automatically initializes wallet on component mount
- Checks for existing certificates in wallet
- Saves new certificates to database
- Handles certificate lifecycle management

### Authentication Context (`src/context/authContext.js`)
- Provides login functionality using stored certificates
- Auto-login on wallet connection if certificate exists

### Certificate Verification
The system checks for certificates in this order:
1. User's wallet (using BSV SDK)
2. MongoDB database (linked to public key)
3. New certificate generation if none exist

### Email Verification System
- Generates 6-digit codes stored in MongoDB
- Codes expire after a set time
- Verified emails are removed from verification collection
- Required before certificate generation