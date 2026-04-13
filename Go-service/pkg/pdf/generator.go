package pdf

import (
	"bytes"
	"fmt"
	"time"

	"github.com/jung-kurt/gofpdf"
	"github.com/school-mgmt/pdf-service/internal/models"
)

type Generator struct {
	margin float64
}

func NewGenerator() *Generator {
	return &Generator{
		margin: 10,
	}
}

func (g *Generator) GenerateStudentReport(student *models.Student) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(g.margin, g.margin, g.margin)
	pdf.AddPage()

	// Title
	pdf.SetFont("Helvetica", "B", 24)
	pdf.SetTextColor(41, 128, 185)
	pdf.Cell(0, 15, "Student Report")
	pdf.Ln(20)

	// Student Information
	g.drawSectionHeader(pdf, "Student Information")
	infoData := []struct{ label, value string }{
		{"Name:", student.Name},
		{"Email:", student.Email},
		{"Student ID:", fmt.Sprintf("%d", student.ID)},
		{"Status:", map[bool]string{true: "Active", false: "Inactive"}[student.SystemAccess]},
		{"Class:", student.Class},
		{"Section:", student.Section},
		{"Roll Number:", fmt.Sprintf("%d", student.Roll)},
	}
	for _, item := range infoData {
		g.drawInfoRow(pdf, item.label, item.value)
	}
	pdf.Ln(10)

	// Personal Information
	g.drawSectionHeader(pdf, "Personal Information")
	personalData := []struct{ label, value string }{
		{"Gender:", student.Gender},
		{"Phone:", student.Phone},
		{"Date of Birth:", formatStringDate(student.DOB)},
		{"Admission Date:", formatStringDate(student.AdmissionDate)},
		{"Current Address:", student.CurrentAddress},
		{"Permanent Address:", student.PermanentAddress},
	}
	for _, item := range personalData {
		g.drawInfoRow(pdf, item.label, item.value)
	}
	pdf.Ln(10)

	// Guardian Information
	g.drawSectionHeader(pdf, "Guardian Information")
	guardianData := []struct{ label, value string }{
		{"Father:", fmt.Sprintf("%s (%s)", student.FatherName, student.FatherPhone)},
		{"Mother:", fmt.Sprintf("%s (%s)", student.MotherName, student.MotherPhone)},
		{"Guardian:", fmt.Sprintf("%s (%s)", formatNullable(student.GuardianName), formatNullable(student.GuardianPhone))},
	}
	for _, item := range guardianData {
		g.drawInfoRow(pdf, item.label, item.value)
	}

	// Footer
	pdf.SetY(-30)
	pdf.SetFont("Helvetica", "I", 8)
	pdf.SetTextColor(128, 128, 128)
	pdf.Cell(0, 10, fmt.Sprintf("Generated on %s | School Management System", time.Now().Format("2006-01-02 15:04:05")))

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("failed to generate PDF: %w", err)
	}

	return buf.Bytes(), nil
}

func (g *Generator) drawSectionHeader(pdf *gofpdf.Fpdf, title string) {
	pdf.SetFillColor(52, 73, 94)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFont("Helvetica", "B", 12)
	pdf.CellFormat(0, 10, "  "+title, "", 1, "L", true, 0, "")
	pdf.SetTextColor(0, 0, 0)
	pdf.Ln(2)
}

func (g *Generator) drawInfoRow(pdf *gofpdf.Fpdf, label, value string) {
	pdf.SetFont("Helvetica", "B", 10)
	pdf.SetTextColor(52, 73, 94)
	pdf.Cell(50, 8, label)

	pdf.SetFont("Helvetica", "", 10)
	pdf.SetTextColor(0, 0, 0)
	pdf.Cell(0, 8, value)
	pdf.Ln(6)
}

func formatStringDate(s *string) string {
	if s == nil {
		return "N/A"
	}
	t, err := time.Parse(time.RFC3339, *s)
	if err != nil {
		return *s
	}
	return t.Format("2006-01-02")
}

func formatNullable(s *string) string {
	if s == nil {
		return "N/A"
	}
	return *s
}
