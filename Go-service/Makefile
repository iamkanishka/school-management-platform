.PHONY: build test lint clean docker-build docker-push deploy

BINARY_NAME=pdf-service
DOCKER_REGISTRY=school-mgmt
VERSION=$(shell git describe --tags --always --dirty)
BUILD_TIME=$(shell date -u '+%Y-%m-%d_%H:%M:%S')
LDFLAGS=-ldflags "-X main.Version=$(VERSION) -X main.BuildTime=$(BUILD_TIME) -w -s"

build:
	go build $(LDFLAGS) -o bin/$(BINARY_NAME) ./cmd/server

test:
	go test -v -race -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

lint:
	golangci-lint run ./...

clean:
	rm -rf bin/
	rm -f coverage.out coverage.html

docker-build:
	docker build -t $(DOCKER_REGISTRY)/$(BINARY_NAME):$(VERSION) -f deployments/docker/Dockerfile .
	docker tag $(DOCKER_REGISTRY)/$(BINARY_NAME):$(VERSION) $(DOCKER_REGISTRY)/$(BINARY_NAME):latest

docker-push:
	docker push $(DOCKER_REGISTRY)/$(BINARY_NAME):$(VERSION)
	docker push $(DOCKER_REGISTRY)/$(BINARY_NAME):latest

deploy:
	kubectl apply -f deployments/k8s/configmap.yaml
	kubectl apply -f deployments/k8s/secret.yaml
	kubectl apply -f deployments/k8s/deployment.yaml
	kubectl apply -f deployments/k8s/service.yaml
	kubectl apply -f deployments/k8s/hpa.yaml

run:
	go run ./cmd/server

mocks:
	go generate ./...

deps:
	go mod download
	go mod tidy

security-scan:
	gosec -fmt sarif -out security-report.sarif ./...

.DEFAULT_GOAL := build