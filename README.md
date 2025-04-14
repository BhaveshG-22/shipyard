# Shipyard - Modern Deployment Platform

A full-stack deployment platform that enables continuous deployment from Git repositories with real-time build logs.

## Architecture Overview

This project is structured as a microservices-based platform with four main components:

### 1. API Server (`/api-server`)

- **Technologies**: Node.js, Express, Socket.IO, Redis, AWS ECS Fargate
- **Features**:
  - Accepts GitHub repository URLs and spins up containers for builds
  - Provides real-time deployment logs via WebSockets
  - Handles deployment queuing with Redis pub/sub
  - Supports branch and folder selection for monorepos
  - Auto-stops containers once builds complete

### 2. Build Server (`/build-server`)

- **Technologies**: Node.js, AWS S3, Docker
- **Features**:
  - Runs in containers to build projects
  - Clones Git repositories and executes build commands
  - Streams real-time logs back to the API server
  - Uploads build artifacts to S3 storage
  - Reports build status (success/failure)

### 3. Proxy Server (`/proxy-server`)

- **Technologies**: Node.js, Express, HTTP-Proxy
- **Features**:
  - Serves the deployed websites from S3 storage
  - Routes traffic based on subdomains to the right project
  - Handles request forwarding and URL rewriting

### 4. Deploy UI (`/deployUI`)

- **Technologies**: React, TypeScript, Tailwind CSS, Socket.IO client
- **Features**:
  - User-friendly interface for initiating deployments
  - GitHub repository integration
  - Real-time build log streaming
  - Deployment progress visualization
  - Branch and folder selection for monorepos

## Project Support

**Currently Supported:**
- Static websites built with React, Vite, or similar JavaScript frameworks
- Projects with npm-based build systems
- Single-page applications (SPAs)

**Coming in Shipyard 2.0:**
- Server-side rendering (SSR) applications
- Backend APIs and services
- Database-dependent applications
- Additional framework support beyond JavaScript/npm ecosystems
- Advanced build configuration options

The current build process assumes projects have a standard npm build configuration with a `build` script defined in package.json.

## Getting Started

Each component has its own README with specific setup instructions. The platform requires:

- AWS account with configured credentials
- Redis instance for pub/sub messaging
- S3 bucket for storing build artifacts
- DNS configuration for the subdomain-based routing

## Environment Variables

See individual component READMEs for the specific environment variables required for each service.

## Development Workflow

1. Set up the required infrastructure (AWS, Redis, S3)
2. Configure environment variables for each component
3. Start the API server, proxy server, and UI locally
4. The build server runs in containers and doesn't need to be started locally

## Deployment Example

1. Enter a GitHub repository URL in the UI
2. Select branch and folder for deployment
3. Click "Deploy"
4. Watch real-time build logs
5. Once complete, access your deployed site at the provided URL

## License

MIT