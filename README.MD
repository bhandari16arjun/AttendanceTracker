# Full-Stack Attendance Tracker

This is a complete full-stack mobile application for tracking attendance, built with a Go backend and a React Native (Expo) frontend. The system allows instructors to create classes and generate time-sensitive QR codes for attendance sessions. Students can join classes and mark their attendance by scanning these QR codes.

A key feature is its **offline capability**: if a student has a poor internet connection, their attendance is saved locally and automatically synced to the server once the connection is restored.

## Features

- **Offline-First Attendance**: Students can reliably mark attendance even with a poor or non-existent internet connection. Records are saved locally and synced automatically.
- **User Authentication**: Secure JWT-based registration and login, with personalized welcome messages.
- **Classroom Management**: Instructors can create classes with unique codes. Students can join or leave classes using these codes.
- **Dynamic QR Code Generation**: Instructors can initiate a secure attendance session, which generates a QR code that automatically refreshes every 30 seconds.
- **Secure QR Code Scanning**: Students mark attendance by scanning the QR code. The backend prevents duplicate scans for the same session.
- **Attendance History**: Students can view a complete, real-time history of their attendance records across all classes.
- **Instructor Dashboard**: Instructors can view a list of students enrolled in their class and see a summary of their attendance counts.

## Tech Stack

### Backend
- **Language**: Go (Golang)
- **Web Framework**: Chi v5 (a lightweight, idiomatic router)
- **Database**: MongoDB (with the official Go driver)
- **Authentication**: JSON Web Tokens (JWT)
- **Environment Variables**: `godotenv`

### Frontend
- **Framework**: React Native with Expo
- **Routing**: Expo Router (file-based routing)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Component Library**: Gluestack UI (headless, themeable components)
- **State Management**: React Context for global auth state and offline queue synchronization.
- **Offline Capabilities**: `AsyncStorage` for queueing, `@react-native-community/netinfo` for network detection.
- **QR Code Generation**: `react-native-qrcode-svg`
- **QR Code Scanning**: `expo-camera`
- **Icons**: `lucide-react-native`

## Prerequisites

Before you begin, ensure you have the following installed:
- [Go](https://go.dev/doc/install) (version 1.21 or later)
- [Node.js](https://nodejs.org/) (LTS version recommended)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account (or a local MongoDB instance).

## Setup and Running the Project

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd <your-project-folder>
    ```

2.  **Set up the Backend:**
    - Navigate to the `backend` directory: `cd backend`
    - Create a `.env` file if it doesn't exist.
    - Edit the `.env` file with your credentials:
      ```env
      MONGO_URI="your_mongodb_connection_string"
      DB_NAME="attendance_db"
      JWT_SECRET="a_very_strong_and_secret_key"
      SERVER_PORT="3000"
      ```
    - Run the backend server:
      ```bash
      go run ./cmd/api/main.go
      ```
    - The server should now be running on `http://localhost:3000`.

3.  **Set up the Frontend:**
    - Open a new terminal and navigate to the `frontend` directory: `cd frontend`
    - Install the dependencies:
      ```bash
      npm install
      ```
    - **Find your computer's local IP address.** This is crucial for the mobile app to connect to your local backend server.
      - On Windows: `ipconfig` (look for "IPv4 Address").
      - On macOS/Linux: `ifconfig` or `ip a` (look for "inet").
    - Open the `frontend/services/api.ts` file and update the `API_BASE_URL` with your IP address:
      ```typescript
      const API_BASE_URL = 'http://YOUR_LOCAL_IP_ADDRESS:3000/api';
      ```
    - Start the Expo development server:
      ```bash
      npx expo start
      ```
    - Scan the QR code with the Expo Go app on your mobile device, or run on a simulator/web.

## API Endpoints

All endpoints are prefixed with `/api`.

| Method | Endpoint                                 | Description                             | Auth Required |
|--------|------------------------------------------|-----------------------------------------|:-------------:|
| POST   | `/register`                              | Register a new user.                    |       No      |
| POST   | `/login`                                 | Log in a user and get a JWT.            |       No      |
| POST   | `/classes`                               | Create a new class (as an instructor).  |      Yes      |
| GET    | `/classes`                               | Get all classes the user is enrolled in.|      Yes      |
| POST   | `/classes/join`                          | Join a class using a code.              |      Yes      |
| POST   | `/classes/{classID}/leave`               | Leave a class.                          |      Yes      |
| POST   | `/classes/{classID}/attendance-session`  | Create a new attendance QR code token.  |      Yes      |
| GET    | `/classes/{classID}/attendance`          | Get attendance summary for a class.     |      Yes      |
| GET    | `/attendance/history`                    | Get the current user's attendance history.|     Yes      |
| POST   | `/attendance/mark`                       | Mark attendance using a session token.  |      Yes      |
