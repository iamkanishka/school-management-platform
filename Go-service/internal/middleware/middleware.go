package middleware

import (
	"context"
	"fmt"
	"net/http"
	"runtime/debug"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"github.com/school-mgmt/pdf-service/internal/observability"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func newResponseWriter(w http.ResponseWriter) *responseWriter {
	return &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func Recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Error().
					Interface("error", err).
					Str("stack", string(debug.Stack())).
					Str("path", r.URL.Path).
					Msg("Panic recovered")

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				fmt.Fprintln(w, `{"error":"INTERNAL_ERROR","details":"Internal server error"}`)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		requestID := r.Header.Get("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}

		ctx := context.WithValue(r.Context(), "request_id", requestID)
		r = r.WithContext(ctx)

		w.Header().Set("X-Request-ID", requestID)

		wrapped := newResponseWriter(w)

		next.ServeHTTP(wrapped, r)

		duration := time.Since(start)

		logger := log.Info()
		if wrapped.statusCode >= 500 {
			logger = log.Error()
		} else if wrapped.statusCode >= 400 {
			logger = log.Warn()
		}

		logger.
			Str("request_id", requestID).
			Str("method", r.Method).
			Str("path", r.URL.Path).
			Int("status", wrapped.statusCode).
			Dur("duration", duration).
			Str("ip", r.RemoteAddr).
			Str("user_agent", r.UserAgent()).
			Msg("HTTP request")
	})
}

func Metrics(metrics *observability.Metrics) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			metrics.IncActiveRequests()
			defer metrics.DecActiveRequests()

			next.ServeHTTP(w, r)
		})
	}
}

func Tracing(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tracer := observability.Tracer()

		ctx, span := tracer.Start(r.Context(), "http.request",
			trace.WithAttributes(
				attribute.String("http.method", r.Method),
				attribute.String("http.url", r.URL.Path),
				attribute.String("http.user_agent", r.UserAgent()),
			),
		)
		defer span.End()

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func Auth(apiKey string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/health" || r.URL.Path == "/ready" || r.URL.Path == "/metrics" {
				next.ServeHTTP(w, r)
				return
			}

			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				fmt.Fprintln(w, `{"error":"UNAUTHORIZED","details":"Missing authorization header"}`)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				fmt.Fprintln(w, `{"error":"UNAUTHORIZED","details":"Invalid authorization format"}`)
				return
			}

			if parts[1] != apiKey {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				fmt.Fprintln(w, `{"error":"UNAUTHORIZED","details":"Invalid API key"}`)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func RateLimit(requestsPerSecond int) func(http.Handler) http.Handler {
	type client struct {
		tokens    float64
		lastCheck time.Time
	}

	var (
		clients = make(map[string]*client)
		mu      sync.RWMutex
	)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.RemoteAddr

			mu.Lock()
			c, exists := clients[ip]
			if !exists {
				c = &client{tokens: float64(requestsPerSecond), lastCheck: time.Now()}
				clients[ip] = c
			}

			now := time.Now()
			elapsed := now.Sub(c.lastCheck).Seconds()
			c.lastCheck = now
			c.tokens += elapsed * float64(requestsPerSecond)
			if c.tokens > float64(requestsPerSecond) {
				c.tokens = float64(requestsPerSecond)
			}

			if c.tokens < 1 {
				mu.Unlock()
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Retry-After", "1")
				w.WriteHeader(http.StatusTooManyRequests)
				fmt.Fprintln(w, `{"error":"RATE_LIMITED","details":"Too many requests"}`)
				return
			}

			c.tokens--
			mu.Unlock()

			next.ServeHTTP(w, r)
		})
	}
}

func CORS(allowedOrigin string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", allowedOrigin) // specific origin, not *
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID, X-CSRF-Token")
			w.Header().Set("Access-Control-Allow-Credentials", "true")

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self'")

		next.ServeHTTP(w, r)
	})
}
