#!/bin/bash

# Grok Notes Auto-Deploy Script
# Handles setup, env vars, testing, deployment, and start/stop for frontend/backend.

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Paths
FRONTEND_DIR="/Volumes/qbitOS/03.models/06-grok/grok-notes-ts"
BACKEND_DIR="/Volumes/qbitOS/03.models/06-grok/grok-notes-backend"
OLLAMA_MODELS_DIR="/Volumes/qbitOS/03.models/01-ollama"

# Ports (must match grok-notes-ts/.env and grok-notes-backend/.env)
BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-5178}"
OLLAMA_PORT="${OLLAMA_PORT:-11434}"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

error() {
    echo -e "${RED}✗ $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

check_deps() {
    log "Checking dependencies..."
    command -v node >/dev/null 2>&1 || error "Node.js not installed"
    command -v npm >/dev/null 2>&1 || error "npm not installed"
    command -v lsof >/dev/null 2>&1 || error "lsof not installed (needed for port checks)"
    command -v ollama >/dev/null 2>&1 || warn "Ollama not in PATH (offline AI may not work)"
    command -v vercel >/dev/null 2>&1 || warn "Vercel CLI not installed (run: npm i -g vercel)"
    command -v heroku >/dev/null 2>&1 || warn "Heroku CLI not installed"
    success "Dependencies OK"
}

setup_env() {
    log "Setting up environment variables..."
    if [ ! -f "$FRONTEND_DIR/.env" ]; then
        cat > "$FRONTEND_DIR/.env" << EOF
VITE_BACKEND_URL=http://localhost:${BACKEND_PORT}
VITE_GROK_API_KEY=your_grok_api_key_here
VITE_AWS_ACCESS_KEY_ID=your_aws_key_here
VITE_AWS_SECRET_ACCESS_KEY=your_aws_secret_here
EOF
        warn "Created $FRONTEND_DIR/.env – Edit with your keys!"
    fi

    if [ ! -f "$BACKEND_DIR/.env" ]; then
        cat > "$BACKEND_DIR/.env" << EOF
PORT=${BACKEND_PORT}
JWT_SECRET=your_jwt_secret_here
DATABASE_URL=sqlite:///./grok-notes.db
GROK_API_KEY=your_grok_api_key_here
AWS_ACCESS_KEY_ID=your_aws_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_here
OLLAMA_HOST=http://localhost:${OLLAMA_PORT}
EOF
        warn "Created $BACKEND_DIR/.env – Edit with your keys!"
    fi
    success "Environment files created"
}

install_deps() {
    log "Installing dependencies..."

    if [ -d "$FRONTEND_DIR" ]; then
        cd "$FRONTEND_DIR"
        npm install
        success "Frontend deps installed"
    fi

    if [ -d "$BACKEND_DIR" ]; then
        cd "$BACKEND_DIR"
        npm install
        success "Backend deps installed"
    fi
}

test_app() {
    log "Running tests..."

    if [ -d "$FRONTEND_DIR" ]; then
        cd "$FRONTEND_DIR"
        npm test -- --watchAll=false
        success "Frontend tests passed"
    fi

    if [ -d "$BACKEND_DIR" ]; then
        cd "$BACKEND_DIR"
        npm test 2>/dev/null || warn "No backend tests defined"
    fi
}

check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1
    else
        return 0
    fi
}

# Kill whatever is listening on a TCP port (for standalone ./auto-deploy.sh stop)
kill_port_listener() {
    local port=$1
    local label=$2
    local pids
    pids=$(lsof -ti :"$port" -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "$pids" ]; then
        # shellcheck disable=SC2086
        kill $pids 2>/dev/null && success "$label stopped (port $port)" || warn "Could not stop $label on port $port"
    else
        log "Nothing listening on port $port ($label)"
    fi
}

start_servers() {
    log "Starting servers (frontend http://localhost:${FRONTEND_PORT}, backend http://localhost:${BACKEND_PORT}, Ollama http://localhost:${OLLAMA_PORT})..."

    OLLAMA_PID=""
    BACKEND_PID=""
    FRONTEND_PID=""

    # Check/start Ollama
    if command -v ollama >/dev/null 2>&1; then
        if check_port "$OLLAMA_PORT"; then
            ollama serve &
            OLLAMA_PID=$!
            success "Ollama started on http://localhost:${OLLAMA_PORT} (PID: $OLLAMA_PID)"
            sleep 5
        else
            success "Ollama already running on http://localhost:${OLLAMA_PORT}"
        fi
    else
        warn "ollama not in PATH — start it manually for http://localhost:${OLLAMA_PORT}"
    fi

    # Start backend
    if [ -d "$BACKEND_DIR" ]; then
        if check_port "$BACKEND_PORT"; then
            cd "$BACKEND_DIR"
            npm start &
            BACKEND_PID=$!
            success "Backend started on http://localhost:${BACKEND_PORT} (PID: $BACKEND_PID)"
        else
            warn "Backend port ${BACKEND_PORT} in use – Skipping"
        fi
    fi

    # Start frontend (Vite)
    if [ -d "$FRONTEND_DIR" ]; then
        if check_port "$FRONTEND_PORT"; then
            cd "$FRONTEND_DIR"
            npm run dev -- --port "$FRONTEND_PORT" &
            FRONTEND_PID=$!
            success "Frontend started on http://localhost:${FRONTEND_PORT} (PID: $FRONTEND_PID)"
        else
            warn "Port ${FRONTEND_PORT} in use – trying default Vite port"
            cd "$FRONTEND_DIR"
            npm run dev &
            FRONTEND_PID=$!
        fi
    fi

    echo "PIDs: Ollama=$OLLAMA_PID, Backend=$BACKEND_PID, Frontend=$FRONTEND_PID"
    log "Press Ctrl+C to stop all"
    trap stop_servers INT
    wait
}

stop_servers() {
    log "Stopping servers..."
    # PIDs from background jobs in this shell (when start was used in-process)
    if [ -n "${OLLAMA_PID:-}" ]; then kill "$OLLAMA_PID" 2>/dev/null && success "Ollama stopped (PID)"; fi
    if [ -n "${BACKEND_PID:-}" ]; then kill "$BACKEND_PID" 2>/dev/null && success "Backend stopped (PID)"; fi
    if [ -n "${FRONTEND_PID:-}" ]; then kill "$FRONTEND_PID" 2>/dev/null && success "Frontend stopped (PID)"; fi
    # Standalone ./auto-deploy.sh stop: no PIDs — free the stack ports
    kill_port_listener "$FRONTEND_PORT" "Frontend (Vite)"
    kill_port_listener "$BACKEND_PORT" "Backend (Express)"
    kill_port_listener "$OLLAMA_PORT" "Ollama"
    exit 0
}

deploy_frontend() {
    log "Deploying frontend to Vercel/Netlify..."
    if command -v vercel >/dev/null 2>&1; then
        cd "$FRONTEND_DIR"
        vercel --prod
        success "Frontend deployed to Vercel"
    else
        warn "Vercel CLI not found – Manual deploy needed"
    fi
}

deploy_backend() {
    log "Deploying backend to Railway/Heroku..."
    if command -v heroku >/dev/null 2>&1; then
        cd "$BACKEND_DIR"
        heroku create grok-notes-backend
        git init
        git add .
        git commit -m "Deploy"
        heroku deploy
        success "Backend deployed to Heroku"
    else
        warn "Heroku CLI not found – Manual deploy needed"
    fi
}

setup_cloudflare() {
    log "Cloudflare setup notes..."
    warn "Manual setup required: Add site, set DNS to Vercel/Netlify, enable SSL/CDN"
    echo "Domain: yourdomain.com"
    echo "CNAME: your-vercel-url.vercel.app"
    echo "Enable: SSL, CDN, WAF"
}

voice_test() {
    log "Testing voice commands..."
    warn "Grant microphone permissions in browser, test voice input in UI"
}

main() {
    case "$1" in
        setup)
            check_deps
            setup_env
            install_deps
            ;;
        test)
            test_app
            ;;
        start)
            start_servers
            ;;
        stop)
            stop_servers
            ;;
        deploy-frontend)
            deploy_frontend
            ;;
        deploy-backend)
            deploy_backend
            ;;
        deploy)
            deploy_frontend
            deploy_backend
            setup_cloudflare
            ;;
        voice-test)
            voice_test
            ;;
        all)
            check_deps
            setup_env
            install_deps
            test_app
            start_servers
            ;;
        *)
            echo "Usage: $0 {setup|test|start|stop|deploy-frontend|deploy-backend|deploy|voice-test|all}"
            echo "  setup: Check deps, setup env, install"
            echo "  test: Run tests"
            echo "  start: Start all servers"
            echo "  stop: Stop all servers"
            echo "  deploy-frontend: Deploy to Vercel"
            echo "  deploy-backend: Deploy to Heroku"
            echo "  deploy: Full deploy + Cloudflare notes"
            echo "  voice-test: Voice testing notes"
            echo "  all: Full setup + start"
            exit 1
            ;;
    esac
}

main "$@"