# Glinax Chatbot - Ghanaian University Admissions Assistant

[![Production Ready](https://img.shields.io/badge/status-production%20ready-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)]()
[![React](https://img.shields.io/badge/React-19.1-blue)]()
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

An AI-powered chatbot providing comprehensive guidance on Ghanaian university admissions, including program information, application processes, and personalized recommendations.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **MongoDB** 4.4+ (local or Atlas)
- **Python** 3.8+ (for AI service)
- **Git**

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd 19

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install

# Install AI service dependencies
cd ../ai-rag-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Environment Configuration

#### Frontend (.env)

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_APP_NAME=Glinax Chatbot
VITE_APP_VERSION=2.1.0
```

#### Backend (.env)

Create `backend/.env`:

```env
# Database
MONGODB_URI=mongodb://localhost:27017
DB_NAME=glinax

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Services
AI_SERVICE_URL=http://127.0.0.1:8000/respond

# Optional: LLM Title Generation (Free from console.groq.com)
GROQ_API_KEY=your-groq-api-key

# Email (for verification)
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password

# Payments (Paystack)
PAYSTACK_SECRET_KEY=sk_test_your_key
PAYSTACK_PUBLIC_KEY=pk_test_your_key

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

#### AI RAG Service (.env)

Create `ai-rag-service/.env`:

```env
MONGODB_URI=mongodb://localhost:27017
JWT_SECRET=your-super-secret-jwt-key-change-in-production
GROQ_API_KEY=your-groq-api-key
OPENAI_API_KEY=your-openai-api-key  # Optional
```

### Running the Application

#### Development Mode

**Terminal 1 - Frontend:**

```bash
cd frontend
npm run dev
# Frontend runs on http://localhost:5173
```

**Terminal 2 - Backend:**

```bash
cd backend
npm run dev  # or: npm start
# Backend runs on http://localhost:5000
```

**Terminal 3 - AI RAG Service:**

```bash
cd ai-rag-service
source venv/bin/activate  # Windows: venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
# AI service runs on http://localhost:8000
```

#### Production Build

**Frontend:**

```bash
cd frontend
npm run build
# Output: dist/ folder with optimized bundle
# Serve with: npm run preview
```

**Backend:**

```bash
cd backend
npm start
# Or use PM2: pm2 start server.js --name glinax-backend
```

**AI Service:**

```bash
cd ai-rag-service
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 📦 Project Structure

```
.
├── frontend/              # React TypeScript Frontend
│   ├── src/
│   │   ├── components/   # UI Components
│   │   ├── pages/        # Route Pages
│   │   ├── hooks/        # Custom React Hooks
│   │   ├── contexts/     # React Context Providers
│   │   ├── services/     # API Services
│   │   ├── store/        # Zustand State Management
│   │   └── utils/        # Utility Functions
│   ├── public/           # Static Assets
│   └── dist/             # Production Build Output
│
├── backend/              # Node.js Express Backend
│   ├── src/
│   │   ├── config/       # Database & Config
│   │   ├── controllers/  # Route Controllers
│   │   ├── middleware/   # Express Middleware
│   │   ├── routes/       # API Routes
│   │   ├── utils/        # Helper Functions
│   │   └── scripts/      # Background Jobs
│   ├── uploads/          # File Uploads Storage
│   └── server.js         # Entry Point
│
└── ai-rag-service/       # Python FastAPI AI Service
    ├── main.py           # Entry Point
    └── requirements.txt  # Python Dependencies
```

## 🌟 Features

### Core Features

- ✅ **AI-Powered Chat**: Intelligent responses about Ghanaian university admissions
- ✅ **Real-time Communication**: WebSocket-based real-time messaging
- ✅ **User Authentication**: Secure JWT-based auth with guest mode
- ✅ **Assessment Tool**: Personalized program recommendations
- ✅ **Conversation History**: Save and resume conversations
- ✅ **File Uploads**: Support for documents and images
- ✅ **Payment Integration**: Paystack payment processing
- ✅ **Notifications**: Real-time admission updates
- ✅ **University Context**: Specialized information per institution

### Technical Features

- 🎨 **Modern UI**: Glassmorphism design with dark mode
- 📱 **Responsive**: Mobile-first responsive design
- ⚡ **Fast**: Optimized bundle with code splitting
- 🔒 **Secure**: bcrypt passwords, JWT tokens, input validation
- 📊 **State Management**: Zustand for efficient state handling
- 🎭 **Animations**: Framer Motion for smooth transitions

## 🔧 Available Scripts

### Frontend

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run preview      # Preview production build
npm run type-check   # TypeScript type checking
npm run lint         # ESLint code linting
npm run lint:fix     # Auto-fix lint issues
npm run format       # Prettier formatting
```

### Backend

```bash
npm start           # Start server
npm run dev         # Start with nodemon (auto-reload)
```

### AI Service

```bash
uvicorn main:app --reload          # Development with auto-reload
uvicorn main:app --workers 4       # Production with workers
```

## 🧪 Testing

### Backend Test Scripts

```bash
cd backend

# Test authentication flow
node test-auth.js

# Test route imports
node test-save-route.js

# Test LLM title generation
node test-llm-title-generator.js
```

## 📖 API Documentation

### Authentication Endpoints

- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/guest` - Guest login

### Chat Endpoints

- `POST /api/chat/message` - Send chat message
- `GET /api/chat/conversations` - Get user conversations
- `GET /api/chat/conversations/:id/messages` - Get conversation messages
- `DELETE /api/chat/conversations/:id` - Delete conversation

### Profile Endpoints

- `GET /api/profile/me` - Get user profile
- `PUT /api/profile/update` - Update profile

### Payment Endpoints

- `POST /api/payments/initialize` - Initialize payment
- `POST /api/payments/verify/:reference` - Verify payment
- `POST /api/payments/webhook` - Paystack webhook handler

### Notification Endpoints

- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/mark-read` - Mark all as read
- `PUT /api/notifications/:id/mark-read` - Mark one as read

## 🔐 Security

### Implemented

- ✅ JWT token authentication with 7-day expiry
- ✅ Bcrypt password hashing (10 rounds)
- ✅ Input validation and sanitization
- ✅ CORS configuration with allowed origins
- ✅ Rate limiting (100 requests/minute)
- ✅ Email validation (gmail.com required for signup)
- ✅ Environment variable protection
- ✅ SQL injection prevention (MongoDB parameterized queries)

### Recommended for Production

- [ ] Add Helmet.js for security headers
- [ ] Implement CSRF protection
- [ ] Add per-user rate limiting
- [ ] Set up WAF (Web Application Firewall)
- [ ] Regular dependency security audits
- [ ] Implement API key rotation

## 🚀 Deployment

### Frontend (Netlify/Vercel)

```bash
cd frontend
npm run build
# Deploy dist/ folder
```

### Backend (Heroku/Railway/DigitalOcean)

```bash
cd backend
# Set environment variables
# Deploy with: git push heroku main
```

### AI Service (Docker)

```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Production Checklist

- [ ] Set NODE_ENV=production
- [ ] Configure production MongoDB URI
- [ ] Set strong JWT_SECRET
- [ ] Configure SSL/TLS certificates
- [ ] Set up monitoring (Sentry, LogRocket)
- [ ] Configure CDN for static assets
- [ ] Set up database backups
- [ ] Configure logging aggregation
- [ ] Test payment webhooks
- [ ] Set up error alerting

## 📊 Performance

### Frontend Bundle Size

- Total: ~890 KB (gzipped)
- Main chunks split by route and vendor
- Code splitting with dynamic imports
- Tree shaking enabled

### Backend Performance

- Async/await for non-blocking I/O
- Connection pooling for MongoDB
- Caching middleware for repeated queries
- Gzip compression enabled

## 🐛 Troubleshooting

### Build Issues

**Frontend won't build:**

```bash
rm -rf node_modules dist
npm install
npm run build
```

**TypeScript errors:**

```bash
npm run type-check
```

### Runtime Issues

**Backend can't connect to MongoDB:**

- Check MONGODB_URI in .env
- Ensure MongoDB is running: `mongod`
- For Atlas: Check IP whitelist

**CORS errors:**

- Verify FRONTEND_URL in backend .env
- Check VITE_API_BASE_URL in frontend .env

**Auth failures:**

- Ensure JWT_SECRET matches in backend and AI service
- Check token isn't expired (7 days)

## 📝 License

MIT License - See LICENSE file for details

## 👥 Support

For issues and questions:

- Create an issue on GitHub
- Email: support@glinax.com
- Documentation: [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md)

## 🔄 Version History

### v2.1.0 (Current) - December 2025

- ✅ Production-ready build with zero TypeScript errors
- ✅ Comprehensive environment configuration
- ✅ Standardized .gitignore files
- ✅ Improved error handling across all flows
- ✅ Production logging strategy
- ✅ Complete documentation

### v2.0.0

- Initial production release
- Core features implemented
- AI RAG integration

---

**Built with ❤️ for Ghanaian students**
