package observability

import (
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
	oteltrace "go.opentelemetry.io/otel/trace"
)

func InitLogger() {
	zerolog.TimeFieldFormat = time.RFC3339
	log.Logger = zerolog.New(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339}).
		With().
		Timestamp().
		Caller().
		Logger()
}

func InitTracer(endpoint string) (*sdktrace.TracerProvider, error) {
	if endpoint == "" {
		return nil, fmt.Errorf("jaeger endpoint not configured")
	}

	exp, err := jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(endpoint)))
	if err != nil {
		return nil, fmt.Errorf("failed to create jaeger exporter: %w", err)
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp),
		sdktrace.WithResource(resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceNameKey.String("pdf-service"),
			attribute.String("version", "1.0.0"),
		)),
	)

	otel.SetTracerProvider(tp)
	return tp, nil
}

func Tracer() oteltrace.Tracer {
	return otel.Tracer("pdf-service")
}

type Metrics struct {
	requestDuration *prometheus.HistogramVec
	requestTotal    *prometheus.CounterVec
	activeRequests  prometheus.Gauge
	pdfGenerated    prometheus.Counter
	pdfErrors       prometheus.Counter
	pdfSize         prometheus.Histogram
	backendCalls    *prometheus.CounterVec
	backendDuration *prometheus.HistogramVec
}

func NewMetrics() *Metrics {
	m := &Metrics{
		requestDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "http_request_duration_seconds",
				Help:    "HTTP request duration in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"method", "path", "status"},
		),
		requestTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "http_requests_total",
				Help: "Total HTTP requests",
			},
			[]string{"method", "path", "status"},
		),
		activeRequests: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "http_active_requests",
				Help: "Number of active HTTP requests",
			},
		),
		pdfGenerated: prometheus.NewCounter(
			prometheus.CounterOpts{
				Name: "pdf_generated_total",
				Help: "Total PDFs generated successfully",
			},
		),
		pdfErrors: prometheus.NewCounter(
			prometheus.CounterOpts{
				Name: "pdf_errors_total",
				Help: "Total PDF generation errors",
			},
		),
		pdfSize: prometheus.NewHistogram(
			prometheus.HistogramOpts{
				Name:    "pdf_size_bytes",
				Help:    "PDF file size in bytes",
				Buckets: prometheus.ExponentialBuckets(1024, 2, 10),
			},
		),
		backendCalls: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "backend_calls_total",
				Help: "Total calls to Node.js backend",
			},
			[]string{"endpoint", "status"},
		),
		backendDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "backend_call_duration_seconds",
				Help:    "Backend call duration in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"endpoint"},
		),
	}

	prometheus.MustRegister(
		m.requestDuration,
		m.requestTotal,
		m.activeRequests,
		m.pdfGenerated,
		m.pdfErrors,
		m.pdfSize,
		m.backendCalls,
		m.backendDuration,
	)

	return m
}

func (m *Metrics) Handler() http.HandlerFunc {
	return promhttp.Handler().ServeHTTP
}

func (m *Metrics) RecordRequest(method, path, status string, duration time.Duration) {
	m.requestDuration.WithLabelValues(method, path, status).Observe(duration.Seconds())
	m.requestTotal.WithLabelValues(method, path, status).Inc()
}

func (m *Metrics) IncActiveRequests() {
	m.activeRequests.Inc()
}

func (m *Metrics) DecActiveRequests() {
	m.activeRequests.Dec()
}

func (m *Metrics) RecordPDFGenerated(size int64) {
	m.pdfGenerated.Inc()
	m.pdfSize.Observe(float64(size))
}

func (m *Metrics) RecordPDFError() {
	m.pdfErrors.Inc()
}

func RecordBackendCall(endpoint, status string, duration time.Duration) {
	// This would need to be called from the client with access to metrics instance
}
