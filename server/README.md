# DAS Backend API

Backend API for Distribution Automation System (BESCOM)

## Setup Instructions

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Environment Configuration
1. Create a `.env` file in the `server` directory
2. Add the MongoDB connection string with your credentials (URL-encode any special characters in the password):
```env
MONGODB_URI=mongodb://<USERNAME>:<URL_ENCODED_PASSWORD>@vcaan.in:27017/das?authSource=das&authMechanism=SCRAM-SHA-256
```
3. Add the remaining environment variables:
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=bescom_distribution_automation_system_secret_key_2024
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:5173
```

### 3. Run the Server

Development mode (with watch):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Server will run on: `http://localhost:5000`

## API Endpoints

### Authentication

#### Register User
- **POST** `/api/auth/register`
- Body: User registration data
- Response: User object with JWT token

#### Login User
- **POST** `/api/auth/login`
- Body: `{ userId, password, application }`
- Response: User object with JWT token

#### Get User Profile
- **GET** `/api/auth/profile`
- Headers: `Authorization: Bearer <token>`
- Response: User profile

#### Get All Users
- **GET** `/api/auth/users`
- Headers: `Authorization: Bearer <token>`
- Response: List of users

#### Update User
- **PUT** `/api/auth/users/:id`
- Headers: `Authorization: Bearer <token>`
- Body: Fields to update
- Response: Updated user

#### Delete User
- **DELETE** `/api/auth/users/:id`
- Headers: `Authorization: Bearer <token>`
- Response: Success message

## Health Check

- **GET** `/health` - Server status

## Features

- MongoDB connection with authentication
- User registration and login
- JWT-based authentication
- CBrypt password hashing
- Role-based access control
- Validation for Admin and CCR roles (Division and Circle not mandatory)
- Error handling middleware
- CORS enabled




























