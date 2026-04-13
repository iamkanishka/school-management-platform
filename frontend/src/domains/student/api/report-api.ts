import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_KEY = import.meta.env.VITE_API_KEY || 'apikey_123456789';
const BASE_URL = import.meta.env.VITE_REPORT_API_URL || 'http://localhost:8082';

export const reportApi = createApi({
  reducerPath: 'reportApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${BASE_URL}/api/v1`,
    prepareHeaders: (headers) => {
      if (API_KEY) {
        headers.set('authorization', `Bearer ${API_KEY}`);
      }
      return headers;
    }
  }),
  endpoints: (builder) => ({
    generateStudentReport: builder.query<void, { id: string; name: string }>({
      query: ({ id, name }) => ({
        url: `/students/${id}/report`,
        method: 'GET',
        responseHandler: async (response) => {
          if (!response.ok) throw new Error(`Download failed: ${response.status}`);

          const blob = await response.blob();
          const pdfBlob = new Blob([blob], { type: 'application/pdf' });

          const url = window.URL.createObjectURL(pdfBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${name}_student_report.pdf`; // ← name used here
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        }
      })
    })
  })
});

export const { useLazyGenerateStudentReportQuery } = reportApi;
