package services

import (
	"context"
	"fmt"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/school-mgmt/pdf-service/internal/models"
	"github.com/school-mgmt/pdf-service/internal/observability"
	"github.com/school-mgmt/pdf-service/pkg/pdf"
)

// StudentFetcher defines the interface for fetching student data
type StudentFetcher interface {
	GetStudent(ctx context.Context, studentID string) (*models.Student, error)
}

// PDFService handles PDF generation business logic
type PDFService struct {
	backendClient StudentFetcher
	pdfGenerator  *pdf.Generator
	metrics       *observability.Metrics
}

// NewPDFService creates a new PDF service
func NewPDFService(backendClient StudentFetcher, metrics *observability.Metrics) *PDFService {
	return &PDFService{
		backendClient: backendClient,
		pdfGenerator:  pdf.NewGenerator(),
		metrics:       metrics,
	}
}

// GenerateStudentReport generates a PDF report for a student
func (s *PDFService) GenerateStudentReport(ctx context.Context, studentID string) ([]byte, string, error) {
	tracer := observability.Tracer()
	ctx, span := tracer.Start(ctx, "pdf-service.generate-report")
	defer span.End()

	start := time.Now()

	student, err := s.backendClient.GetStudent(ctx, studentID)
	if err != nil {
		s.metrics.RecordPDFError()
		log.Error().Err(err).Str("student_id", studentID).Msg("Failed to fetch student data")
		return nil, "", fmt.Errorf("failed to fetch student data: %w", err)
	}

	// Generate PDF
	log.Info().Str("student_name", student.Name).Msg("Generating PDF report")

	pdfBytes, err := s.pdfGenerator.GenerateStudentReport(student)
	if err != nil {
		s.metrics.RecordPDFError()
		log.Error().Err(err).Str("student_id", studentID).Msg("Failed to generate PDF")
		return nil, "", fmt.Errorf("failed to generate PDF: %w", err)
	}

	duration := time.Since(start)
	s.metrics.RecordPDFGenerated(int64(len(pdfBytes)))

	log.Info().
		Str("student_id", studentID).
		Str("student_name", student.Name).
		Int("pdf_size", len(pdfBytes)).
		Dur("duration", duration).
		Msg("PDF report generated successfully")

	return pdfBytes, "application/pdf", nil
}
