package services

import (
	"context"
	"errors"
	"testing"

	"github.com/school-mgmt/pdf-service/internal/models"
	"github.com/school-mgmt/pdf-service/internal/observability"
	"github.com/school-mgmt/pdf-service/pkg/pdf"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockStudentFetcher struct {
	mock.Mock
}

func (m *MockStudentFetcher) GetStudent(ctx context.Context, studentID string) (*models.Student, error) {
	args := m.Called(ctx, studentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Student), args.Error(1)
}

var _ StudentFetcher = (*MockStudentFetcher)(nil)

func strPtr(s string) *string {
	return &s
}

func TestPDFService_GenerateStudentReport(t *testing.T) {
	metrics := observability.NewMetrics()

	tests := []struct {
		name           string
		studentID      string
		mockSetup      func(*MockStudentFetcher)
		expectedError  bool
		errorContains  string
		expectedPDFLen int
	}{
		{
			name:      "successful report generation",
			studentID: "1",
			mockSetup: func(m *MockStudentFetcher) {
				m.On("GetStudent", mock.Anything, "1").Return(&models.Student{
					ID:      1,
					Name:    "John Doe",
					Email:   "john@school.com",
					Class:   "Grade 10",
					Section: "A",
					Roll:    1,
				}, nil)
			},
			expectedError:  false,
			expectedPDFLen: 1000,
		},
		{
			name:      "student not found",
			studentID: "999",
			mockSetup: func(m *MockStudentFetcher) {
				m.On("GetStudent", mock.Anything, "999").Return(nil, errors.New("student not found"))
			},
			expectedError: true,
			errorContains: "failed to fetch student data",
		},
		{
			name:      "backend timeout",
			studentID: "2",
			mockSetup: func(m *MockStudentFetcher) {
				m.On("GetStudent", mock.Anything, "2").Return(nil, context.DeadlineExceeded)
			},
			expectedError: true,
			errorContains: "failed to fetch student data",
		},
		{
			name:      "student with complete data",
			studentID: "3",
			mockSetup: func(m *MockStudentFetcher) {
				m.On("GetStudent", mock.Anything, "3").Return(&models.Student{
					ID:               3,
					Name:             "Jane Smith",
					Email:            "jane@school.com",
					SystemAccess:     true,
					Phone:            "555-0123",
					Gender:           "Female",
					DOB:              strPtr("2005-05-15T00:00:00.000Z"),
					Class:            "Grade 12",
					Section:          "A",
					Roll:             15,
					FatherName:       "Robert Smith",
					FatherPhone:      "555-0124",
					MotherName:       "Mary Smith",
					MotherPhone:      "555-0125",
					GuardianName:     nil,
					GuardianPhone:    nil,
					CurrentAddress:   "123 School St",
					PermanentAddress: "123 School St",
					AdmissionDate:    strPtr("2020-06-01T00:00:00.000Z"),
				}, nil)
			},
			expectedError:  false,
			expectedPDFLen: 2000,
		},
		{
			name:      "student with nullable fields",
			studentID: "4",
			mockSetup: func(m *MockStudentFetcher) {
				m.On("GetStudent", mock.Anything, "4").Return(&models.Student{
					ID:            4,
					Name:          "Bob Jones",
					Email:         "bob@school.com",
					SystemAccess:  false,
					Class:         "Grade 8",
					Section:       "B",
					Roll:          5,
					DOB:           nil,
					AdmissionDate: nil,
					GuardianName:  nil,
					GuardianPhone: nil,
					ReporterName:  nil,
				}, nil)
			},
			expectedError:  false,
			expectedPDFLen: 1000,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := new(MockStudentFetcher)
			tt.mockSetup(mockClient)

			service := &PDFService{
				backendClient: mockClient,
				pdfGenerator:  pdf.NewGenerator(),
				metrics:       metrics,
			}

			ctx := context.Background()
			pdfBytes, contentType, err := service.GenerateStudentReport(ctx, tt.studentID)

			if tt.expectedError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorContains)
				assert.Nil(t, pdfBytes)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, pdfBytes)
				assert.GreaterOrEqual(t, len(pdfBytes), tt.expectedPDFLen)
				assert.Equal(t, "application/pdf", contentType)
			}

			mockClient.AssertExpectations(t)
		})
	}
}
