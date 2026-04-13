# School Management Platform — Usage Guide

![Platform](https://img.shields.io/badge/platform-Docker%20%7C%20Kubernetes-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Stack](https://img.shields.io/badge/stack-Node.js%20%7C%20Go%20%7C%20React%20%7C%20PostgreSQL-orange)

---

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start — Docker Compose](#quick-start--docker-compose)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Build Images](#2-build-images)
  - [3. Run the Stack](#3-run-the-stack)
  - [4. Access the Application](#4-access-the-application)
  - [5. Stop the Stack](#5-stop-the-stack)
- [Production Scaling — Kubernetes](#production-scaling--kubernetes)
  - [Prerequisites](#kubernetes-prerequisites)
  - [1. Apply Secrets](#1-apply-secrets)
  - [2. Apply ConfigMap](#2-apply-configmap)
  - [3. Apply Deployments](#3-apply-deployments)
  - [4. Apply Services](#4-apply-services)
  - [5. Apply HPA (Autoscaling)](#5-apply-hpa-autoscaling)
  - [6. Verify the Cluster](#6-verify-the-cluster)
- [Service Architecture](#service-architecture)
- [Environment Variables Reference](#environment-variables-reference)
- [Troubleshooting](#troubleshooting)

---

## Overview

The School Management Platform is a full-stack application for managing students, teachers, attendance, grades, and reports. It consists of five services that work together:

| Service | Technology | Port | Description |
|---|---|---|---|
| `postgres` | PostgreSQL 15 | 5432 | Primary database |
| `seeder` | Node.js / Docker | — | One-time database seeder (runs on startup) |
| `backend` | Node.js / Express | 5007 | REST API + auth |
| `pdf-service` | Go | 8082 | PDF report generation |
| `frontend` | React + Vite | 3000 | Web UI |

---

## Prerequisites

Make sure the following tools are installed before proceeding:

- [Git](https://git-scm.com/)
- [Docker](https://docs.docker.com/get-docker/) (v24+) and [Docker Compose](https://docs.docker.com/compose/) (v2+)
- [kubectl](https://kubernetes.io/docs/tasks/tools/) (for Kubernetes deployment)
- A running Kubernetes cluster — [minikube](https://minikube.sigs.k8s.io/docs/start/), [kind](https://kind.sigs.k8s.io/), or a managed cloud cluster (GKE, EKS, AKS)

---

## Quick Start — Docker Compose

### 1. Clone the Repository

```bash
git clone https://github.com/iamkanishka/school-management-platform.git
```

### 2. Navigate to the Docker deployment directory

```bash
cd school-management-platform/deployments/docker
```

### 3. Build Images

Build all service images from source with no cache to ensure a clean build:

```bash
docker compose build --no-cache
```

> This step downloads base images and compiles all services. It may take 3–8 minutes on first run depending on your internet connection and machine speed.

### 4. Run the Stack

Start all services in the background:

```bash
docker compose up
```

To run in detached (background) mode:

```bash
docker compose up -d
```

The startup order is managed automatically:
1. `postgres` starts and becomes healthy
2. `seeder` runs and seeds the database, then exits
3. `backend` starts and connects to postgres
4. `pdf-service` starts and connects to backend
5. `frontend` starts

### 4. Access the Application

Once all services are running, open your browser:

| Service | URL |
|---|---|
| Frontend (Web UI) | http://localhost:3000 |
| Backend API | http://localhost:5007 |
| PDF Service | http://localhost:8082 |

### 5. Stop the Stack

```bash
# Stop and remove containers (keeps volumes / database data)
docker compose down

# Stop and remove containers AND volumes (wipes database)
docker compose down -v
```

---

## Production Scaling — Kubernetes

Use Kubernetes for production deployments that require high availability, autoscaling, and rolling updates.

### Kubernetes Prerequisites

- `kubectl` configured and pointing to your target cluster
- Your container images pushed to a container registry (Docker Hub, GHCR, ECR, GCR, etc.)
- Update image fields in `deployment.yaml` to reference your registry, e.g.:
  ```yaml
  image: ghcr.io/your-org/backend:latest
  ```
- [metrics-server](https://github.com/kubernetes-sigs/metrics-server) installed in your cluster (required for HPA):
  ```bash
  kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
  ```

### Navigate to the Kubernetes directory

```bash
cd deployments/k8s
```

---

### 1. Apply Secrets

Secrets store sensitive credentials (passwords, API keys, JWT secrets). Apply these first.

```bash
kubectl apply -f secret.yaml
```

> **Security note:** Before applying to production, replace all placeholder values in `secret.yaml` with real credentials. Consider using [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets) or a secrets manager (HashiCorp Vault, AWS Secrets Manager) instead of committing raw secret files to version control.

---

### 2. Apply ConfigMap

ConfigMaps store non-sensitive environment configuration (URLs, ports, feature flags).

```bash
kubectl apply -f configmap.yaml
```

---

### 3. Apply Deployments

This single file contains the PersistentVolumeClaim for the database, the seeder Job, and all service Deployments.

```bash
kubectl apply -f deployment.yaml
```

> `deployment.yaml` includes:
> - `PersistentVolumeClaim` — postgres data volume
> - `Job` (seeder) — seeds the database once on startup
> - `Deployment` for postgres, backend, pdf-service, and frontend
> - `initContainers` in each deployment to wait for dependencies before starting

---

### 4. Apply Services

Services expose each deployment internally (ClusterIP) or externally (NodePort).

```bash
kubectl apply -f service.yaml
```

| Service | Type | Exposed Port |
|---|---|---|
| `postgres-service` | ClusterIP | 5432 (internal only) |
| `backend-service` | ClusterIP | 5007 (internal only) |
| `pdf-service` | NodePort | 30082 |
| `frontend-service` | NodePort | 30000 |

Access the app at `http://<your-node-ip>:30000` after services are applied.

---

### 5. Apply HPA (Autoscaling)

Horizontal Pod Autoscalers automatically scale deployments based on CPU and memory utilisation.

```bash
kubectl apply -f hpa.yaml
```

| Deployment | Min Replicas | Max Replicas | CPU Target |
|---|---|---|---|
| `backend` | 2 | 8 | 70% |
| `pdf-service` | 2 | 6 | 65% |
| `frontend` | 2 | 6 | 70% |

> PostgreSQL is excluded from autoscaling — it is a stateful single-replica deployment backed by a PVC.

---

### 6. Verify the Cluster

Check that all pods are running and ready:

```bash
# View all pods
kubectl get pods

# View all services
kubectl get services

# View HPA status
kubectl get hpa

# View seeder job status
kubectl get jobs

# Tail backend logs
kubectl logs -f deployment/backend

# Describe a pod for event details
kubectl describe pod <pod-name>
```

Expected output for `kubectl get pods`:

```
NAME                           READY   STATUS      RESTARTS   AGE
postgres-xxxx                  1/1     Running     0          2m
seeder-xxxx                    0/1     Completed   0          2m
backend-xxxx                   1/1     Running     0          90s
backend-yyyy                   1/1     Running     0          90s
pdf-service-xxxx               1/1     Running     0          80s
pdf-service-yyyy               1/1     Running     0          80s
frontend-xxxx                  1/1     Running     0          75s
frontend-yyyy                  1/1     Running     0          75s
```

---

## Service Architecture

```
Browser
   │
   ▼
frontend-service :30000
   │
   ├──► backend-service :5007
   │         │
   │         ├──► postgres-service :5432
   │         └──► (seeder connects on startup only)
   │
   └──► pdf-service :30082
             │
             └──► backend-service :5007
```

---

## Environment Variables Reference

Key variables are split across `configmap.yaml` (non-sensitive) and `secret.yaml` (sensitive).

### Backend

| Variable | Where | Description |
|---|---|---|
| `DATABASE_URL` | ConfigMap | PostgreSQL connection string |
| `PORT` | ConfigMap | API server port (5007) |
| `UI_URL` | ConfigMap | Frontend URL for CORS / redirects |
| `API_URL` | ConfigMap | Backend self-reference URL |
| `COOKIE_DOMAIN` | ConfigMap | Domain for auth cookies |
| `MAIL_FROM_USER` | ConfigMap | Sender email address |
| `JWT_ACCESS_TOKEN_SECRET` | Secret | JWT signing key (access tokens) |
| `JWT_REFRESH_TOKEN_SECRET` | Secret | JWT signing key (refresh tokens) |
| `CSRF_TOKEN_SECRET` | Secret | CSRF token signing key |
| `RESEND_API_KEY` | Secret | Resend transactional email API key |
| `API_KEY` | Secret | Internal API key |
| `NODEJS_API_KEY` | Secret | Key used by pdf-service to call backend |

### PDF Service

| Variable | Where | Description |
|---|---|---|
| `NODEJS_BASE_URL` | ConfigMap | Backend base URL |
| `ALLOWED_ORIGIN` | ConfigMap | CORS allowed origin |
| `RATE_LIMIT` | ConfigMap | Max requests per minute |
| `PDF_OUTPUT_DIR` | ConfigMap | Directory for generated PDFs |
| `MAX_PDF_SIZE` | ConfigMap | Max PDF file size in bytes (10 MB) |

### Frontend

| Variable | Where | Description |
|---|---|---|
| `VITE_API_URL` | ConfigMap | Backend API URL (runtime) |
| `VITE_REPORT_API_URL` | ConfigMap | PDF service URL (runtime) |
| `VITE_API_KEY` | Secret | Internal API key for frontend requests |

> **Note:** `VITE_*` variables are baked into the frontend bundle at build time via Docker `--build-arg`. Runtime environment variables only take effect if your container entrypoint performs `envsubst`. Rebuild the frontend image for each target environment.

---

## Troubleshooting

**Seeder job fails or keeps restarting**
```bash
kubectl logs job/seeder
```
Usually caused by postgres not being ready yet. The seeder has a built-in `initContainer` that waits — check if postgres itself is healthy first.

**Backend crashes with `ECONNREFUSED`**
Postgres is not yet accepting connections. Check postgres pod status:
```bash
kubectl get pods -l component=postgres
kubectl logs deployment/postgres
```

**HPA shows `<unknown>` for metrics**
The metrics-server is not installed or not running. Install it:
```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

**Frontend shows blank page or API errors**
`VITE_*` vars are build-time. Ensure the frontend image was built with the correct `--build-arg` values for your environment. Check your Docker build command:
```bash
docker build \
  --build-arg VITE_API_URL=http://your-api-host:5007 \
  --build-arg VITE_REPORT_API_URL=http://your-pdf-host:8082 \
  --build-arg VITE_API_KEY=your-key \
  -t frontend:latest ../../frontend
```

**Port conflicts on Docker Compose**
If ports 3000, 5007, or 8082 are in use locally, edit the `ports` mapping in `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"   # host:container
```

---

*For issues or contributions, open a GitHub issue at [github.com/iamkanishka/school-management-platform](https://github.com/iamkanishka/school-management-platform).*
