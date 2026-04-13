package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/school-mgmt/pdf-service/internal/clients"
	"github.com/school-mgmt/pdf-service/internal/config"
	"github.com/school-mgmt/pdf-service/internal/handlers"
	"github.com/school-mgmt/pdf-service/internal/middleware"
	"github.com/school-mgmt/pdf-service/internal/observability"
	"github.com/school-mgmt/pdf-service/internal/resilience"
	"github.com/school-mgmt/pdf-service/internal/services"
)

func main() {
	observability.InitLogger()

	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	tracerProvider, err := observability.InitTracer(cfg.JaegerEndpoint)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to initialize tracer")
	} else {
		defer func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			tracerProvider.Shutdown(ctx)
		}()
	}

	metrics := observability.NewMetrics()

	cb := resilience.NewCircuitBreaker("nodejs-backend", resilience.CircuitBreakerConfig{
		MaxRequests:      3,
		Interval:         30 * time.Second,
		Timeout:          60 * time.Second,
		FailureThreshold: 0.5,
		MinRequests:      5,
	})

	retryConfig := resilience.RetryConfig{
		MaxRetries:   3,
		InitialDelay: 500 * time.Millisecond,
		MaxDelay:     10 * time.Second,
		Multiplier:   2.0,
		Jitter:       true,
	}

	httpClient := clients.NewResilientHTTPClient(cfg.NodeJSTimeout, cb, retryConfig)
	backendClient := clients.NewNodeJSClient(cfg.NodeJSBaseURL, httpClient, cfg.NodeJSAPIKey, cfg.APIKey)
	pdfService := services.NewPDFService(backendClient, metrics)
	reportHandler := handlers.NewReportHandler(pdfService, metrics)

	router := setupRouter(reportHandler, metrics, cfg)

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	serverErrCh := make(chan error, 1)
	go func() {
		log.Info().Str("addr", server.Addr).Msg("Starting PDF service server")
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErrCh <- err
		}
	}()

	select {
	case err := <-serverErrCh:
		log.Fatal().Err(err).Msg("Server error")
	case <-ctx.Done():
		log.Info().Msg("Shutdown signal received")
		stop()
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("Graceful shutdown failed")
		server.Close()
	}

	log.Info().Msg("Server stopped gracefully")
}

func setupRouter(reportHandler *handlers.ReportHandler, metrics *observability.Metrics, cfg *config.Config) http.Handler {
	router := http.NewServeMux()
	router.HandleFunc("/health", handlers.HealthHandler)
	router.HandleFunc("/ready", handlers.ReadinessHandler)
	router.HandleFunc("/metrics", metrics.Handler())

	apiRouter := http.NewServeMux()
	apiRouter.HandleFunc("/api/v1/students/", reportHandler.GenerateReport)

	var handler http.Handler = apiRouter
	handler = middleware.Recovery(handler)
	handler = middleware.Logging(handler)
	handler = middleware.Metrics(metrics)(handler)
	handler = middleware.Tracing(handler)
	handler = middleware.Auth(cfg.APIKey)(handler)
	handler = middleware.RateLimit(cfg.RateLimit)(handler)
	handler = middleware.CORS(cfg.AllowedOrigin)(handler)
	handler = middleware.SecurityHeaders(handler)

	router.Handle("/api/v1/", handler)
	return router
}
