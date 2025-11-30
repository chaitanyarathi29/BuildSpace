# 🏗️ Buildspace — A Vercel Clone

**Buildspace** is a self-hosted **Vercel clone** built with Node.js, Next.js, AWS ECS, and S3.  
It allows users to deploy web projects directly from GitHub repositories, run builds in containerized environments, and serve the final output via a custom reverse proxy — complete with **real-time build logs** powered by Redis and Socket.io.

---

## ⚙️ Tech Stack

| Layer | Technologies |
|--------|---------------|
| **Frontend** | Next.js |
| **Backend** | Node.js, Express.js |
| **Containerization** | Docker |
| **Orchestration** | AWS ECS (Fargate) |
| **Registry** | AWS ECR |
| **Storage** | AWS S3 |
| **Messaging** | Redis, Kafka (for log streaming & events) |
| **Database** | PostgreSQL |
| **Analytics** | ClickHouse |

---

## 🧩 Architecture Overview

[Architecture Diagram]

<img width="2280" height="878" alt="68747470733a2f2f692e696d6775722e636f6d2f7237515558715a2e706e67" src="https://github.com/user-attachments/assets/1e36bf79-64df-4bd1-bbe4-62a63aa508db" />

### Services and Ports

| Service | Description | Port |
|----------|--------------|------|
| **API Server** | Handles project creation, ECS task spawning, and Redis log subscriptions | `9000` |
| **Socket.io Server** | Real-time WebSocket server for build logs and updates | `9002` |
| **S3 Reverse Proxy** | Serves project build outputs from S3, mapped by subdomain | `8000` |

---

## 🚀 How It Works

### 1. **Project Deployment**
- The **API Server (`:9000`)** receives a POST request to `/project` with a GitHub repo URL.
- It generates a project slug (using `random-word-slugs`) and starts a **Fargate task** on **AWS ECS** with:
  - `GIT_REPOSITORY__URL`
  - `PROJECT_ID`
- The task runs the **Build Server** inside a Docker container.

---

### 2. **Build Server**
File: `build-server/index.js`

- Clones the repo and installs dependencies inside a container.
- Runs the build command (`npm run build`).
- Uploads generated static files (`dist/`, `index.html`, etc.) to:

s3://vercel-clone-outputs/__outputs/{PROJECT_ID}/
- Publishes build logs and progress to Redis:

logs:{PROJECT_ID}
- The **Socket.io server** broadcasts these logs in real time to connected clients.

---

### 3. **Real-Time Logs**
- The **Socket.io Server (`:9002`)** listens for `subscribe` events from the frontend.
- Clients subscribe to their project log channel (e.g., `logs:my-app`).
- The API subscribes to Redis and emits log updates to all connected clients.

Example:
```js
socket.emit('subscribe', 'logs:my-app');

4. Serving the Build Output

File: s3-reverse-proxy/index.js

The Reverse Proxy (:8000) maps subdomains to S3 folders:

- a1.localhost:8000 → s3://vercel-clone-outputs/__outputs/a1
- p1.localhost:8000 → s3://vercel-clone-outputs/__outputs/p1

Requests are proxied to the correct S3 path, appending index.html for root routes.

File Structure

buildspace/
├── api-server/
│   └── index.js          # Express API + Redis + ECS trigger
├── build-server/
│   └── index.js          # Build logic + S3 upload + Redis logs
├── s3-reverse-proxy/
│   └── index.js          # Reverse proxy mapping S3 → local subdomains
├── frontend/
│   └── (Next.js App)     # Dashboard UI for deployments & logs
└── README.md

🧪 Running Locally

⚠️ Requires AWS credentials, Redis, and Docker setup

1. Start API & Socket.io Server
cd api-server
node index.js

2. Start Reverse Proxy
cd s3-reverse-proxy
node index.js

3. Trigger Deployment

Send a POST request:

curl -X POST http://localhost:9000/project \
     -H "Content-Type: application/json" \
     -d '{"gitURL": "https://github.com/user/sample-app.git"}'

4. View Logs

Connect to the Socket.io server at http://localhost:9002
and subscribe to your project channel (e.g., logs:misty-sunset-dawn).

🚀 Features

🔁 GitHub-based auto deployments

🧱 Containerized builds using AWS ECS

☁️ S3-backed hosting for static assets

📡 Real-time build logs via Redis + Socket.io

🧩 Subdomain-based reverse proxy routing

📊 Extendable microservice architecture

🧠 Future Enhancements

GitHub OAuth for direct repo linking

CI/CD status dashboards

Custom domain & SSL management

Deployment cost analytics

Multi-region S3 replication for faster delivery

🧑‍💻 Author

Buildspace — Built as a distributed deployment platform inspired by Vercel, showcasing AWS-based build pipelines, Docker orchestration, and real-time log streaming.

📜 License

MIT License © 2025 Buildspace
