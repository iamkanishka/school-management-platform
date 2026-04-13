package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/school-mgmt/pdf-service/internal/models"
	"github.com/school-mgmt/pdf-service/internal/observability"
	"github.com/school-mgmt/pdf-service/internal/services"
)

type ReportHandler struct {
	pdfService *services.PDFService
	metrics    *observability.Metrics
}

func NewReportHandler(pdfService *services.PDFService, metrics *observability.Metrics) *ReportHandler {
	return &ReportHandler{
		pdfService: pdfService,
		metrics:    metrics,
	}
}

func (h *ReportHandler) GenerateReport(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	ctx := r.Context()

	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 5 {
		h.respondError(w, http.StatusBadRequest, "INVALID_PATH", "Invalid request path")
		h.recordMetrics(r, "400", start)
		return
	}

	studentID := pathParts[4]
	if studentID == "" || studentID == "report" {
		h.respondError(w, http.StatusBadRequest, "MISSING_ID", "Student ID is required")
		h.recordMetrics(r, "400", start)
		return
	}

	if _, err := strconv.Atoi(studentID); err != nil {
		h.respondError(w, http.StatusBadRequest, "INVALID_ID", "Student ID must be numeric")
		h.recordMetrics(r, "400", start)
		return
	}

	if !strings.HasSuffix(r.URL.Path, "/report") {
		h.respondError(w, http.StatusNotFound, "NOT_FOUND", "Endpoint not found")
		h.recordMetrics(r, "404", start)
		return
	}

	log.Info().Str("student_id", studentID).Str("method", r.Method).Msg("Report generation requested")

	pdfBytes, contentType, err := h.pdfService.GenerateStudentReport(ctx, studentID)
	if err != nil {
		status := http.StatusInternalServerError
		code := "INTERNAL_ERROR"

		if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
			code = "STUDENT_NOT_FOUND"
		} else if strings.Contains(err.Error(), "circuit breaker") {
			status = http.StatusServiceUnavailable
			code = "SERVICE_UNAVAILABLE"
		}

		h.respondError(w, status, code, err.Error())
		h.recordMetrics(r, fmt.Sprintf("%d", status), start)
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"student_%s_report.pdf\"", studentID))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(pdfBytes)))
	w.Header().Set("Cache-Control", "private, no-cache")
	w.Header().Set("X-Content-Type-Options", "nosniff")

	w.WriteHeader(http.StatusOK)
	if _, err := w.Write(pdfBytes); err != nil {
		log.Error().Err(err).Str("student_id", studentID).Msg("Failed to write response")
	}

	h.recordMetrics(r, "200", start)
}

func (h *ReportHandler) respondError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	response := models.ErrorResponse{
		Error:   code,
		Details: message,
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Error().Err(err).Msg("Failed to encode error response")
	}
}

func (h *ReportHandler) recordMetrics(r *http.Request, status string, start time.Time) {
	duration := time.Since(start)
	h.metrics.RecordRequest(r.Method, r.URL.Path, status, duration)
}

func HealthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status": "healthy",
		"time":   time.Now().Format(time.RFC3339),
	})
}

func ReadinessHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ready",
		"time":   time.Now().Format(time.RFC3339),
	})
}
