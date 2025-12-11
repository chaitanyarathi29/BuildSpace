# 🏗️ Buildspace — A Vercel Clone

> **A self-hosted, production-ready deployment platform** inspired by Vercel. Deploy web projects from GitHub, run containerized builds, and stream build logs via Kafka to ClickHouse with HTTP polling.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org)
[![AWS](https://img.shields.io/badge/AWS-ECS%20%7C%20S3-orange?logo=amazon-aws)](https://aws.amazon.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-blue?logo=postgresql)](https://www.postgresql.org)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Workflow](#workflow)
- [Services](#services)
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Build Logs](#build-logs)
- [Deployment](#deployment)
- [Future Enhancements](#future-enhancements)

---

## Overview

**Buildspace** is a distributed deployment platform that automates the entire build and deployment lifecycle. It combines the power of AWS ECS for containerized builds, S3 for static hosting, PostgreSQL for project metadata, Kafka for distributed logging, and ClickHouse for analytics.

### Key Features

✅ **GitHub Integration** — Deploy directly from GitHub repositories  
✅ **Containerized Builds** — Isolated Docker containers via AWS ECS/Fargate  
✅ **Build Logs** — Stream build logs via Kafka → ClickHouse & HTTP polling API  
✅ **Subdomain Routing** — Automatic subdomain-to-S3 mapping via reverse proxy  
✅ **Database Persistence** — Track projects, deployments, and status with PostgreSQL  
✅ **Analytics Pipeline** — Analyze logs and metrics with ClickHouse  
✅ **Scalable Architecture** — Microservices designed for horizontal scaling  

---

## Architecture

<img width="1562" height="1404" alt="Screenshot 2025-12-10 234945" src="https://github.com/user-attachments/assets/f6759cfb-1b41-42b2-b039-b4d94e162a0d" />

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Orchestration** | AWS ECS (Fargate) | Containerized build execution |
| **Registry** | AWS ECR | Docker image storage |
| **Storage** | AWS S3 | Static build outputs |
| **Databases** | PostgreSQL | Project metadata, deployments, users |
| **Analytics** | ClickHouse | Log aggregation & analytics |
| **Messaging** | Apache Kafka | Distributed log streaming |
| **Backend** | Node.js, Express.js | API server & microservices |
| **ORM** | Prisma | Database query builder |
| **Validation** | Zod | Runtime type validation |
| **HTTP Proxy** | http-proxy | Reverse proxy routing |
| **Deployment** | Docker | Container images for builds |

---

## Workflow

### Complete Deployment Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER INITIATES DEPLOYMENT                                    │
│                                                                  │
│   POST /project                                                 │
│   {                                                              │
│     "name": "my-app",                                            │
│     "gitUrl": "https://github.com/user/my-app.git"             │
│   }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. API SERVER PROCESSES REQUEST                                 │
│                                                                  │
│   • Generate unique deployment_id (UUID)                        │
│   • Create project record in PostgreSQL                         │
│   • Validate input with Zod schema                              │
│   • Create deployment record with QUEUE status                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. SPAWN ECS FARGATE TASK                                       │
│                                                                  │
│   RunTaskCommand {                                               │
│     cluster: CLUSTER_ARN,                                        │
│     taskDefinition: TASK_ARN,                                    │
│     launchType: "FARGATE",                                       │
│     environment: {                                               │
│       GIT_REPOSITORY_URL: gitUrl,                               │
│       PROJECT_ID: project_id,                                    │
│       DEPLOYMENT_ID: deployment_id                              │
│     }                                                             │
│   }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. BUILD SERVER CONTAINER STARTS                                │
│                                                                  │
│   • Initialize Kafka producer                                   │
│   • Clone repository: git clone $GIT_REPOSITORY_URL             │
│   • Publish: "Build Started" to Kafka topic: container-logs     │
│   • Run: npm install                                            │
│   • Publish: install logs to Kafka                              │
│   • Run: npm run build                                          │
│   • Publish: build logs to Kafka                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. LOGS FLOW: BUILD SERVER → KAFKA → CLICKHOUSE                 │
│                                                                  │
│   Build Server                                                   │
│   └─► publishLog(message)                                       │
│       └─► Kafka Producer                                        │
│           └─► Topic: container-logs                             │
│               └─► ClickHouse (inserted async)                   │
│                   └─► PostgreSQL (deployment status update)     │
│                       └─► API Server (/logs/:id endpoint)       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. UPLOAD BUILD OUTPUT TO S3                                    │
│                                                                  │
│   For each file in dist/:                                       │
│   • Get MIME type                                               │
│   • Upload to S3:                                               │
│     s3://buildspace-vercel-clone/__outputs/{PROJECT_ID}/...    │
│   • Publish upload progress to Kafka                            │
│   • Update deployment status: READY                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. ACCESS DEPLOYED APP VIA REVERSE PROXY                        │
│                                                                  │
│   User visits: http://my-app.localhost:8000                    │
│   └─► Reverse Proxy extracts subdomain: "my-app"               │
│       └─► Maps to S3 path: __outputs/my-app/                   │
│           └─► Routes to: s3://bucket/__outputs/my-app/         │
│               └─► Returns index.html for root /                 │
│                   └─► Browser displays deployed app             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. VIEW LOGS VIA HTTP POLLING                                   │
│                                                                  │
│   GET /logs/{deployment_id}                                     │
│   └─► API Server queries ClickHouse                             │
│       └─► Returns stored logs with timestamps                   │
│           └─► Client polls every 5 seconds for updates          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Services

### 🔹 API Server (`:9000`)

**File:** `api-server/index.js`

#### Responsibilities:
- REST API endpoint for project creation
- AWS ECS task orchestration
- PostgreSQL project metadata management
- Kafka consumer for log ingestion
- ClickHouse analytics integration
- HTTP endpoint for retrieving logs

#### Key Endpoints:

**POST `/project`** — Create and deploy a new project
```bash
curl -X POST http://localhost:9000/project \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-awesome-app",
    "gitUrl": "https://github.com/user/repo.git"
  }'
```

**Response:**
```json
{
  "deploymentId": "550e8400-e29b-41d4-a716-446655440000",
  "projectSlug": "crimson-elephant",
  "status": "QUEUE",
  "url": "http://crimson-elephant.localhost:8000"
}
```

**GET `/logs/:id`** — Fetch logs from ClickHouse
```bash
curl http://localhost:9000/logs/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "rawLogs": [
    {
      "event_id": "1",
      "deployment_id": "550e8400...",
      "log": "npm install output...",
      "timestamp": "2025-12-10T10:30:45Z"
    }
  ]
}
```

---

### 🔹 Build Server (Docker Container in ECS)

**File:** `build-server/script.js`

#### Responsibilities:
- Clone GitHub repository
- Execute `npm install` and `npm run build`
- Stream logs to Kafka broker
- Upload build artifacts to S3
- Update deployment status in PostgreSQL

#### Environment Variables:
```env
PROJECT_ID=crimson-elephant
DEPLOYMENT_ID=550e8400-e29b-41d4-a716-446655440000
GIT_REPOSITORY_URL=https://github.com/user/repo.git
ACCESS_KEY_ID=<AWS_ACCESS_KEY>
SECRET_ACCESS_KEY_ID=<AWS_SECRET_KEY>
```

#### Log Publishing Flow:
```javascript
await publishLog('Build Started...');
// Sends to Kafka topic: "container-logs"
// Message: { PROJECT_ID, DEPLOYMENT_ID, log: "Build Started..." }
```

#### S3 Upload:
```
s3://buildspace-vercel-clone/
└── __outputs/
    └── crimson-elephant/
        ├── index.html
        ├── assets/
        │   ├── app.js
        │   └── style.css
        └── ...
```

---

### 🔹 S3 Reverse Proxy (`:8000`)

**File:** `s3-reverse-proxy/index.js`

#### Responsibilities:
- Route incoming HTTP requests to S3 buckets
- Extract subdomain from hostname
- Map subdomain → S3 project folder
- Handle static file serving (index.html for root)

#### Routing Logic:

```javascript
hostname: "my-app.localhost:8000"
  └─► subdomain: "my-app"
      └─► S3 path: __outputs/my-app/
          └─► Request to: https://s3.amazonaws.com/.../my-app/
```

#### Examples:

| Request | Routed To |
|---------|-----------|
| `http://crimson-elephant.localhost:8000/` | `s3://.../crimson-elephant/index.html` |
| `http://crimson-elephant.localhost:8000/assets/app.js` | `s3://.../crimson-elephant/assets/app.js` |
| `http://p1.localhost:8000/about` | `s3://.../p1/about/index.html` |

---

## Installation

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- AWS Account (ECS, ECR, S3)
- PostgreSQL 15+
- Apache Kafka
- ClickHouse

### Step 1: Clone Repository

```bash
git clone https://github.com/chaitanyarathi29/buildspace.git
cd buildspace
```

### Step 2: Environment Setup

#### API Server (`.env`)

```env
# AWS
ACCESS_KEY_ID=<your-access-key>
SECRET_ACCESS_KEY_ID=<your-secret-key>
CLUSTER_ARN=arn:aws:ecs:eu-north-1:xxxxx:cluster/buildspace
TASK_ARN=arn:aws:ecs:eu-north-1:xxxxx:task-definition/buildspace-builder:1

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/buildspace
ACCELERATE_URL=postgresql://user:password@xxxxx.acceleration.prisma-data.com/?api_key=xxxxx

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC=container-logs

# ClickHouse
CLICKHOUSE_HOST=http://localhost:8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=<password>
CLICKHOUSE_DATABASE=buildspace
```

#### Build Server (`.env`)

```env
ACCESS_KEY_ID=<your-access-key>
SECRET_ACCESS_KEY_ID=<your-secret-key>
S3_BUCKET=buildspace-vercel-clone
S3_REGION=eu-north-1
KAFKA_BROKERS=kafka-host:14027
```

### Step 3: Install Dependencies

```bash
# API Server
cd api-server
npm install

# Build Server
cd ../build-server
npm install

# S3 Reverse Proxy
cd ../s3-reverse-proxy
npm install
```

### Step 4: Database Setup

```bash
cd api-server

# Run Prisma migrations
npx prisma migrate deploy

# (Optional) Seed database
npx prisma db seed
```

### Step 5: Start Services

#### Terminal 1: API Server
```bash
cd api-server
node index.js
# Output: API server Running...9000
```

#### Terminal 2: S3 Reverse Proxy
```bash
cd s3-reverse-proxy
node index.js
# Output: Reverse proxy Running...8000
```

---

## Usage

### Postman/Frontend Testing

#### 1. Create & Deploy Project

**Request:**
```http
POST http://localhost:9000/project
Content-Type: application/json

{
  "name": "my-react-app",
  "gitUrl": "https://github.com/user/react-app.git"
}
```

**Response:**
```json
{
  "deploymentId": "abc-123-xyz",
  "projectSlug": "mystical-penguin",
  "status": "QUEUE",
  "url": "http://mystical-penguin.localhost:8000"
}
```

#### 2. Poll for Logs

**Frontend Implementation (every 5 seconds):**
```javascript
const fetchLogs = async () => {
  try {
    const res = await axios.get(
      `http://localhost:9000/logs/${deploymentId}`
    );
    
    if (res.data && res.data.rawLogs) {
      const logsSorted = res.data.rawLogs.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );
      setLogs(logsSorted.map((l) => l.log));
    }
  } catch (err) {
    console.error("Failed to fetch logs:", err);
  }
};

// Poll every 5 seconds
const interval = setInterval(fetchLogs, 5000);
```

#### 3. Fetch Historical Logs

**Request:**
```http
GET http://localhost:9000/logs/abc-123-xyz
```

**Response:**
```json
{
  "rawLogs": [
    {
      "event_id": "1",
      "deployment_id": "abc-123-xyz",
      "log": "Build Started...",
      "timestamp": "2025-12-10T10:30:00Z"
    },
    {
      "event_id": "2",
      "deployment_id": "abc-123-xyz",
      "log": "npm install...",
      "timestamp": "2025-12-10T10:30:05Z"
    }
  ]
}
```

#### 4. View Deployed App

Open browser:
```
http://mystical-penguin.localhost:8000
```

---

## API Reference

### POST `/project`

Create and deploy a new project.

**Request Body:**
```json
{
  "name": "project-name",
  "gitUrl": "https://github.com/owner/repo.git"
}
```

**Response (201 Created):**
```json
{
  "deploymentId": "uuid",
  "projectSlug": "random-slug",
  "status": "QUEUE",
  "url": "http://random-slug.localhost:8000"
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": "gitUrl is required"
}
```

---

### GET `/logs/:id`

Fetch all logs for a deployment from ClickHouse.

**Parameters:**
- `id` (string) — Deployment ID

**Response (200 OK):**
```json
{
  "rawLogs": [
    {
      "event_id": "1",
      "deployment_id": "abc-123",
      "log": "Build output line 1",
      "timestamp": "2025-12-10T10:30:00Z"
    }
  ]
}
```

---

## Database Schema

### PostgreSQL Tables

#### `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  firstName VARCHAR NOT NULL,
  lastName VARCHAR NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  password VARCHAR NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

#### `projects`
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  gitUrl VARCHAR NOT NULL,
  subdomain VARCHAR UNIQUE,
  customDomain VARCHAR,
  createdBy UUID REFERENCES users(id),
  createdAt TIMESTAMP DEFAULT NOW()
);
```

#### `deployments`
```sql
CREATE TABLE deployments (
  id UUID PRIMARY KEY,
  projectId UUID REFERENCES projects(id),
  status VARCHAR DEFAULT 'QUEUE', -- QUEUE, BUILDING, READY, FAILED
  createdAt TIMESTAMP DEFAULT NOW(),
  completedAt TIMESTAMP
);
```

### ClickHouse Tables

#### `log_events`
```sql
CREATE TABLE log_events (
  event_id UUID,
  deployment_id UUID,
  log String,
  timestamp DateTime
)
ENGINE = MergeTree()
ORDER BY (deployment_id, timestamp);
```

---

## Build Logs

### Architecture



```
Build Server (Docker)
    │
    ├─► Publishes logs to Kafka
    │   Topic: container-logs
    │   Message: { PROJECT_ID, DEPLOYMENT_ID, log: "..." }
    │
    ▼
Kafka Broker
    │
    ├─► API Server consumes
    │   (Kafka Consumer Group: api-server-logs-consumer)
    │
    ├─► Inserts into ClickHouse
    │   table: log_events
    │
    ▼
ClickHouse Database
    │
    ├─► Stores logs with timestamps
    │   for analytics & retrieval
    │
    ▼
API Server /logs/:id Endpoint
    │
    └─► Frontend polls every 5 seconds
        └─► Retrieves latest logs
```

### Log Flow Implementation

**Build Server (build-server/script.js):**
```javascript
async function publishLog(log){
  await producer.send({
    topic: 'container-logs',
    messages: [{
      key: 'log',
      value: JSON.stringify({ PROJECT_ID, DEPLOYMENT_ID, log })
    }]
  })
}
```

**API Server (api-server/index.js):**
```javascript
app.get('/logs/:id', async (req, res) => {
  const id = req.params.id;
  const logs = await client.query({
    query: `SELECT event_id, deployment_id, log, timestamp 
            from log_events 
            where deployment_id = {deployment_id:String}`,
    query_params: { deployment_id: id },
    format: "JSONEachRow"
  })
  
  const rawLogs = await logs.json();
  return res.json({ rawLogs });
})
```

**Frontend (frontend/src/App.jsx):**
```javascript
useEffect(() => {
  if (!deploymentId) return;

  const interval = setInterval(async () => {
    try {
      const res = await axios.get(
        `http://localhost:9000/logs/${deploymentId}`
      );

      if (res.data && res.data.rawLogs) {
        const logsSorted = [...res.data.rawLogs].sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
        setLogs(logsSorted.map((l) => l.log));
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } catch (err) {
      console.error("Polling error:", err);
    }
  }, 5000); // Poll every 5 seconds

  return () => clearInterval(interval);
}, [deploymentId]);
```

---

## Deployment

### Docker Build Server

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /home/app

RUN apk add --no-cache git bash

COPY package*.json ./
RUN npm install

COPY main.sh .
RUN chmod +x main.sh

COPY script.js .

ENTRYPOINT ["./main.sh"]
```

**main.sh:**
```bash
#!/bin/bash
export GIT_REPOSITORY_URL="$GIT_REPOSITORY_URL"
git clone "$GIT_REPOSITORY_URL" /home/app/output
exec node script.js
```

### AWS ECS Task Definition

```json
{
  "family": "buildspace-builder",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "builder-image",
      "image": "XXXXX.dkr.ecr.eu-north-1.amazonaws.com/buildspace-builder:latest",
      "environment": [
        {
          "name": "GIT_REPOSITORY_URL",
          "value": ""
        },
        {
          "name": "PROJECT_ID",
          "value": ""
        },
        {
          "name": "DEPLOYMENT_ID",
          "value": ""
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/buildspace-builder",
          "awslogs-region": "eu-north-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### S3 Bucket Structure

```
buildspace-vercel-clone/
├── __outputs/
│   ├── crimson-elephant/
│   │   ├── index.html
│   │   ├── assets/
│   │   │   ├── app.js
│   │   │   └── style.css
│   │   └── ...
│   ├── mystical-penguin/
│   │   ├── index.html
│   │   └── ...
│   └── ...
```

---

## Project Structure

```
buildspace/
├── api-server/
│   ├── index.js              # Express server + ECS + Kafka consumer
│   ├── package.json
│   ├── prisma/
│   │   └── schema.prisma     # Database schema
│   ├── generated/            # Prisma generated client
│   └── .env
│
├── build-server/
│   ├── script.js             # Build logic + S3 upload + Kafka producer
│   ├── main.sh               # Entry point for Docker container
│   ├── Dockerfile
│   ├── package.json
│   └── .env
│
├── s3-reverse-proxy/
│   ├── index.js              # HTTP proxy + subdomain routing
│   ├── package.json
│   └── .env
│
├── frontend/                 # Next.js dashboard (React)
│   ├── src/
│   │   └── App.jsx           # Main deployment UI
│   └── package.json
│
└── README.md
```

---

## Future Enhancements

- 🔐 **GitHub OAuth** — Direct GitHub repo linking with automatic deployments
- 📊 **Analytics Dashboard** — Deployment metrics, build times, success rates
- 🌍 **Multi-Region Support** — Deploy to multiple AWS regions
- 🔗 **Custom Domains** — CNAME + SSL/TLS management
- 🔄 **Rollback Functionality** — Deploy previous versions
- 📦 **Dependency Caching** — Cache npm packages in Docker layers
- 🚀 **Automatic Scaling** — Auto-scale deployments based on demand
- 🐛 **Deployment Monitoring** — Error tracking & alerts
- 🔐 **GitHub Webhooks** — Trigger builds on git push
- 📈 **Advanced Analytics** — ClickHouse queries for insights
- 🛡️ **Rate Limiting & Auth** — API key management
- 🐳 **Private ECR Images** — Support for private registries

---

## Contributing

Contributions are welcome! Please open issues or submit PRs.

---

## License

MIT License © 2025 Buildspace  
Built by [Chaitanya Rathi](https://github.com/chaitanyarathi29)

---

## Support

For issues, questions, or feedback:
- Open an [Issue](https://github.com/chaitanyarathi29/buildspace/issues)
- Reach out on [Twitter](https://twitter.com/chaitanyarathi29)

---

**Happy Deploying! 🚀**
