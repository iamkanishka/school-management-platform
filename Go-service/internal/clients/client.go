package clients

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"time"

	"github.com/hashicorp/go-retryablehttp"
	"github.com/rs/zerolog/log"
	"github.com/school-mgmt/pdf-service/internal/models"
	"github.com/school-mgmt/pdf-service/internal/observability"
	"github.com/school-mgmt/pdf-service/internal/resilience"
)

type HTTPClient struct {
	client      *retryablehttp.Client
	cb          *resilience.CircuitBreaker
	retryConfig resilience.RetryConfig
	timeout     time.Duration
}

func NewResilientHTTPClient(timeout time.Duration, cb *resilience.CircuitBreaker, retryConfig resilience.RetryConfig) *HTTPClient {
	transport := &http.Transport{
		DialContext: (&net.Dialer{
			Timeout:   5 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		TLSClientConfig:       &tls.Config{MinVersion: tls.VersionTLS12},
		TLSHandshakeTimeout:   5 * time.Second,
		ResponseHeaderTimeout: 10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   10,
		MaxConnsPerHost:       100,
		IdleConnTimeout:       90 * time.Second,
		ForceAttemptHTTP2:     true,
	}

	client := retryablehttp.NewClient()
	client.RetryMax = 0
	client.HTTPClient = &http.Client{
		Transport: transport,
		Timeout:   timeout,
	}
	client.Logger = nil

	return &HTTPClient{
		client:      client,
		cb:          cb,
		retryConfig: retryConfig,
		timeout:     timeout,
	}
}

func (c *HTTPClient) Do(req *retryablehttp.Request) (*http.Response, error) {
	result, cbErr := c.cb.Execute(func() (interface{}, error) {
		var resp *http.Response
		retryErr := resilience.Retry(req.Context(), c.retryConfig, func() error {
			var doErr error
			resp, doErr = c.client.Do(req)
			return doErr
		})
		return resp, retryErr
	})

	if cbErr != nil {
		return nil, cbErr
	}

	return result.(*http.Response), nil
}

type NodeJSClient struct {
	baseURL      string
	httpClient   *HTTPClient
	nodejsAPIKey string
	apiKey       string
}

func NewNodeJSClient(baseURL string, httpClient *HTTPClient, nodejsAPIKey string, apiKey string) *NodeJSClient {
	return &NodeJSClient{
		baseURL:      baseURL,
		httpClient:   httpClient,
		nodejsAPIKey: nodejsAPIKey,
		apiKey:       apiKey,
	}
}

func (c *NodeJSClient) GetStudent(ctx context.Context, studentID string) (*models.Student, error) {
	tracer := observability.Tracer()
	ctx, span := tracer.Start(ctx, "nodejs-client.get-student")
	defer span.End()

	// fix 1: internal route protected by API key, not user-auth route
	endpoint := fmt.Sprintf("/api/v1/students/internal/%s", studentID)
	url, err := url.JoinPath(c.baseURL, endpoint)
	if err != nil {
		return nil, fmt.Errorf("failed to construct URL: %w", err)
	}

	req, err := retryablehttp.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.nodejsAPIKey))
	req.Header.Set("API_KEY", c.apiKey)
	req.Header.Set("Accept", "application/json")

	// fix 2: safe extraction — no panic if request_id missing from context
	if reqID, ok := ctx.Value("request_id").(string); ok {
		req.Header.Set("X-Request-ID", reqID)
	}

	start := time.Now()
	resp, err := c.httpClient.Do(req)
	duration := time.Since(start)

	if err != nil {
		observability.RecordBackendCall(endpoint, "error", duration)
		log.Error().Err(err).Str("student_id", studentID).Msg("Failed to fetch student")
		return nil, fmt.Errorf("backend request failed: %w", err)
	}
	defer resp.Body.Close()

	status := fmt.Sprintf("%d", resp.StatusCode)
	observability.RecordBackendCall(endpoint, status, duration)

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Error().
			Int("status", resp.StatusCode).
			Str("body", string(body)).
			Str("student_id", studentID).
			Msg("Backend returned error")
		return nil, fmt.Errorf("backend returned status %d: %s", resp.StatusCode, string(body))
	}

	var student models.Student
	if err := json.NewDecoder(resp.Body).Decode(&student); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &student, nil
}
