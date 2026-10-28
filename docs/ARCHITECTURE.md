# CanvasCord Architecture

## Overview

The React client communicates with the Express backend through REST APIs
and Socket.IO connections.

## Components

- React and TypeScript provide the user interface.
- Express handles REST API requests.
- Socket.IO manages real-time communication.
- MongoDB stores users, channels, messages, and read receipts.
- Redis coordinates events and ephemeral state across backend instances.
- AWS S3 stores media uploaded through presigned URLs.

## Infrastructure

Docker Compose supports local development. GitHub Actions will run automated
checks and tests.

## Configuration

Environment-specific settings and credentials must remain outside version
control. Use example environment files to document required variables.
