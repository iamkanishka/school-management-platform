import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '5m', target: 10 },
    { duration: '2m', target: 20 },
    { duration: '5m', target: 20 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    errors: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'test-api-key';

export default function () {
  const studentId = Math.floor(Math.random() * 100) + 1;
  
  const response = http.get(`${BASE_URL}/api/v1/students/${studentId}/report`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Accept': 'application/pdf',
    },
    timeout: '30s',
  });

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'content-type is pdf': (r) => r.headers['Content-Type'] === 'application/pdf',
    'response time < 5s': (r) => r.timings.duration < 5000,
  });

  errorRate.add(!success);
  
  sleep(1);
}