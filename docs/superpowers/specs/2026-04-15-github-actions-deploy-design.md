# GitHub Actions CI/CD and Docker Deployment Specification

## Overview
This design outlines the deployment architecture and CI/CD pipeline for the SantaGymBot project to a Linux VPS (`204.168.249.237`). The project consists of a Telegram Python Backend (`api.gym.santariver.lol`) and a React/Vue Web Frontend (`gym.santariver.lol`). 

## Architecture

### 1. Reverse Proxy & HTTPS
- **Service**: Traefik v3
- **Function**: Routes HTTP/HTTPS traffic to the appropriate containers. Automatically issues and renews SSL certificates via Let's Encrypt using the TLS-ALPN-01 or HTTP-01 challenge.
- **Data storage**: Let's Encrypt certificate configurations will be stored in an anonymous volume or mounted file (`acme.json`) to persist across container restarts.

### 2. Backend Container
- **Subdomain**: `api.gym.santariver.lol`
- **Dockerization**: Uses the existing `./backend/Dockerfile`.
- **Environment config**: Connects to the database and Redis via Docker's internal network. Gets its required environment variables (like `BOT_TOKEN`) from the `.env` file present on the server.

### 3. Frontend Container
- **Subdomain**: `gym.santariver.lol`
- **Dockerization**: A multi-stage Dockerfile will be created in `./frontend`. 
  - *Stage 1 (Build)*: Uses a Node.js image to install packages and build the static assets (`npm run build`).
  - *Stage 2 (Serve)*: Uses an `nginx:alpine` image to serve the compiled static files on port 80.
- **Labels**: Traefik labels routing traffic based on the `gym.santariver.lol` Host rule.

### 4. Database & Cache
- **Postgres & Redis**: Run in internal containers. Not exposed to the internet. Uses named volumes for data persistence.

## Infrastructure & Configuration
- **Deployment Path**: Project will reside at `/opt/santagym` on the specified VPS.
- **Secret Management**: Environmental secrets will be housed in `/opt/santagym/.env` directly on the server. They will **not** be managed by the GitHub Actions pipeline, preventing accidental leaks and simplifying the CI toolchain.

## CI/CD Pipeline
- **Trigger**: Pushes to the `main` branch.
- **Runner**: `ubuntu-latest`
- **Steps**:
  1. **Checkout Code**: Retrieves the latest repository state.
  2. **Transfer Files (SCP)**: Uses `appleboy/scp-action` to copy the project to `/opt/santagym` on the VPS. 
     - *Exclusions*: It will exclude `.git`, `node_modules`, `.venv`, `.idea`, and local `.env` files to save bandwidth and prevent overwriting the server's `.env`.
  3. **Deploy (SSH)**: Uses `appleboy/ssh-action` to execute a script on the remote server:
     - `cd /opt/santagym`
     - `docker-compose up -d --build` (this pulls any new code changes, rebuilds images without destroying cache if unchanged, and recreates containers if needed).
     - Prunes dangling Docker images to prevent disk space exhaustion.

## Requirements from User
- A valid Email address to use for the Let's Encrypt certificate generation (will be put into the `docker-compose.yml` config).
- **GitHub Secrets** required to power the workflow:
  - `HOST`: Server IP (`204.168.249.237`)
  - `USERNAME`: Server User (`root`)
  - `SSH_KEY`: A private SSH key associated with the Server.
