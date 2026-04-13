# School Management Platform

A full-stack application for managing students, teachers, attendance, grades, and reports.

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Node.js / Express
- **PDF Service:** Go
- **Database:** PostgreSQL 15
- **Deployment:** Docker Compose / Kubernetes

## Quick Start (Docker)

```bash
# Clone the repo
git clone https://github.com/iamkanishka/school-management-platform.git
cd school-management-platform/deployments/docker

# Build and run
docker compose build --no-cache
docker compose up
```

Once running, open:

| Service  | URL                    |
|----------|------------------------|
| Frontend | http://localhost:3000  |
| Backend  | http://localhost:5007  |
| PDF      | http://localhost:8082  |

To stop:

```bash
docker compose down        # keeps data
docker compose down -v     # wipes database
```

## Kubernetes (Production)

```bash
cd deployments/k8s

kubectl apply -f secret.yaml
kubectl apply -f configmap.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f hpa.yaml
```

Access the app at `http://<node-ip>:30000`.

## Services

| Service     | Port | Description              |
|-------------|------|--------------------------|
| postgres    | 5432 | Primary database         |
| backend     | 5007 | REST API + auth          |
| pdf-service | 8082 | PDF report generation    |
| frontend    | 3000 | Web UI                   |

## Common Issues

- **Seeder fails** — check if postgres is healthy: `kubectl logs job/seeder`
- **Backend ECONNREFUSED** — postgres not ready yet; check its pod status
- **HPA shows `<unknown>`** — install [metrics-server](https://github.com/kubernetes-sigs/metrics-server)
- **Blank frontend** — rebuild image with correct `VITE_*` build args
- **Port conflicts** — edit `ports` in `docker-compose.yml`

## License

MIT