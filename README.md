<img width="1323" height="794" alt="Screenshot 2026-05-09 at 2 26 13 PM" src="https://github.com/user-attachments/assets/64a094c1-4e3c-4ad8-bd36-9fd1d2ab762a" />

# Grok Notes

Grok Notes is an advanced, AI-powered notebook application built with React, TypeScript, and Node.js. It provides a collaborative, offline-capable environment for coding, data analysis, and machine learning, integrated with Grok AI for assistance.

## Quick Start (Auto-Deploy Script)

Use the auto-deploy script for easy setup, testing, and deployment:

```bash
# Full setup and start
./auto-deploy.sh all

# Individual commands
./auto-deploy.sh setup    # Check deps, setup env, install
./auto-deploy.sh test     # Run tests
./auto-deploy.sh start    # Start servers
./auto-deploy.sh stop     # Stop servers
./auto-deploy.sh deploy   # Deploy to cloud + Cloudflare notes
```

Edit `.env` files with your API keys before deploying.

## Features

- **Interactive Notebooks**: Jupyter-like cells for code execution, markdown, and visualizations.
- **Terminal Integration**: Embedded terminal for shell commands.
- **Drawing Layer**: Freehand drawing over content.
- **Collaboration**: Real-time collaborative editing.
- **Machine Learning**: Client-side ML with TensorFlow.js, extensible to cloud.
- **Offline Sync**: Work offline with automatic sync.
- **Plugin System**: Extensible via plugins.
- **AI Assistance**: Live chat with Grok for code help.
- **Security**: OAuth login, data encryption, secure headers.
- **Advanced Features**: Voice commands, VR/AR support, internationalization.

## Architecture Overview

### Frontend (grok-notes-ts)
- **Framework**: React + TypeScript + Vite
- **State Management**: Zustand
- **Components**:
  - TopBar: Navigation and controls
  - NotebookPane: Main notebook interface
  - TerminalPane: Embedded terminal
  - NotesDrawer: Side notes panel
  - DrawLayer: Drawing overlay
  - Footer: Status bar
- **Services**:
  - collaboration: Real-time editing
  - mlService: ML operations
  - offlineSync: Offline functionality
  - performanceMonitor: Performance tracking
- **Plugins**: Extensible plugin system

### Backend (grok-notes-backend)
- **Framework**: Node.js + Express
- **Features**:
  - API endpoints for notebooks, users, collaboration
  - OAuth integration (Google/GitHub)
  - Data encryption with AES
  - Security headers via Helmet.js
  - Cloud ML integration (AWS SageMaker)

## Setup Instructions

### Prerequisites
- Node.js 18+
- npm or yarn
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd grok-notes
   ```

2. Install frontend dependencies:
   ```bash
   cd grok-notes-ts
   npm install
   ```

3. Install backend dependencies:
   ```bash
   cd ../grok-notes-backend
   npm install
   ```

### Configuration

1. Create `.env` files for backend:
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` for OAuth
   - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` for OAuth
   - `ENCRYPTION_KEY` for AES encryption
   - `AWS_ACCESS_KEY`, `AWS_SECRET_KEY` for SageMaker
   - `GROK_API_KEY` for AI integration

2. Configure frontend:
   - Update API base URL in `src/config.ts`

### Running

1. Start backend:
   ```bash
   cd grok-notes-backend
   npm start
   ```

2. Start frontend:
   ```bash
   cd grok-notes-ts
   npm run dev
   ```

3. Open http://localhost:5173

## API Documentation

### Endpoints

- `GET /api/notebooks` - List notebooks
- `POST /api/notebooks` - Create notebook
- `GET /api/notebooks/:id` - Get notebook
- `PUT /api/notebooks/:id` - Update notebook
- `DELETE /api/notebooks/:id` - Delete notebook
- `POST /auth/login` - OAuth login
- `POST /ml/train` - Cloud ML training
- `POST /ml/infer` - Cloud ML inference

### Authentication
Uses OAuth 2.0 with Google/GitHub. Tokens stored securely.

## User Guides

### Creating a Notebook
1. Click "New Notebook" in TopBar.
2. Add cells: Code or Markdown.
3. Execute code with Shift+Enter.

### Using AI Chat
1. Open chat panel.
2. Ask questions about code/cells.
3. Grok provides assistance.

### Collaboration
1. Share notebook link.
2. Real-time edits visible to all.

### Voice Commands
1. Enable microphone.
2. Speak commands like "run cell" or "add markdown".

### VR Mode
1. Enable WebXR.
2. Interact with 3D canvas.

## Security

- **OAuth**: Secure login via Google/GitHub.
- **Encryption**: AES-256 for stored data.
- **Headers**: Helmet.js for XSS, CSRF protection.
- **Penetration Testing**: Run `npm test:security` for basic checks. Use tools like OWASP ZAP for API testing, ensure HTTPS in production, rate limiting on auth endpoints.

## Testing

- Unit tests: `npm test`
- E2E tests: `npx cypress run`
- Security tests: Custom scripts

## Contributing

1. Fork the repo.
2. Create feature branch.
3. Submit PR.

## License

ISC
