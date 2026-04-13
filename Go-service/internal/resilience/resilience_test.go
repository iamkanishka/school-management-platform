package resilience

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestRetry(t *testing.T) {
	tests := []struct {
		name          string
		maxRetries    int
		initialDelay  time.Duration
		maxDelay      time.Duration
		multiplier    float64
		jitter        bool
		operation     func() error
		expectedError bool
		expectedCalls int
	}{
		{
			name:         "success on first attempt",
			maxRetries:   3,
			initialDelay: 10 * time.Millisecond,
			maxDelay:     100 * time.Millisecond,
			multiplier:   2.0,
			jitter:       false,
			operation: func() func() error {
				calls := 0
				return func() error {
					calls++
					return nil
				}
			}(),
			expectedError: false,
			expectedCalls: 1,
		},
		{
			name:         "success after retries",
			maxRetries:   3,
			initialDelay: 10 * time.Millisecond,
			maxDelay:     100 * time.Millisecond,
			multiplier:   2.0,
			jitter:       false,
			operation: func() func() error {
				calls := 0
				return func() error {
					calls++
					if calls < 3 {
						return errors.New("transient error")
					}
					return nil
				}
			}(),
			expectedError: false,
			expectedCalls: 3,
		},
		{
			name:         "exhausted retries",
			maxRetries:   2,
			initialDelay: 10 * time.Millisecond,
			maxDelay:     100 * time.Millisecond,
			multiplier:   2.0,
			jitter:       false,
			operation: func() func() error {
				return func() error {
					return errors.New("persistent error")
				}
			}(),
			expectedError: true,
			expectedCalls: 3,
		},
		{
			name:          "context cancellation",
			maxRetries:    3,
			initialDelay:  100 * time.Millisecond,
			maxDelay:      1 * time.Second,
			multiplier:    2.0,
			jitter:        false,
			operation:     func() error { return context.Canceled },
			expectedError: true,
			expectedCalls: 1,
		},
		{
			name:         "zero retries",
			maxRetries:   0,
			initialDelay: 10 * time.Millisecond,
			maxDelay:     100 * time.Millisecond,
			multiplier:   2.0,
			jitter:       false,
			operation: func() func() error {
				calls := 0
				return func() error {
					calls++
					return nil
				}
			}(),
			expectedError: false,
			expectedCalls: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := RetryConfig{
				MaxRetries:   tt.maxRetries,
				InitialDelay: tt.initialDelay,
				MaxDelay:     tt.maxDelay,
				Multiplier:   tt.multiplier,
				Jitter:       tt.jitter,
			}

			ctx := context.Background()
			err := Retry(ctx, config, tt.operation)

			if tt.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestCalculateBackoff(t *testing.T) {
	tests := []struct {
		name         string
		attempt      int
		initialDelay time.Duration
		maxDelay     time.Duration
		multiplier   float64
		jitter       bool
		minExpected  time.Duration
		maxExpected  time.Duration
	}{
		{
			name:         "first attempt no jitter",
			attempt:      0,
			initialDelay: 100 * time.Millisecond,
			maxDelay:     1 * time.Second,
			multiplier:   2.0,
			jitter:       false,
			minExpected:  100 * time.Millisecond,
			maxExpected:  100 * time.Millisecond,
		},
		{
			name:         "second attempt no jitter",
			attempt:      1,
			initialDelay: 100 * time.Millisecond,
			maxDelay:     1 * time.Second,
			multiplier:   2.0,
			jitter:       false,
			minExpected:  200 * time.Millisecond,
			maxExpected:  200 * time.Millisecond,
		},
		{
			name:         "max delay cap",
			attempt:      10,
			initialDelay: 100 * time.Millisecond,
			maxDelay:     1 * time.Second,
			multiplier:   2.0,
			jitter:       false,
			minExpected:  1 * time.Second,
			maxExpected:  1 * time.Second,
		},
		{
			name:         "with jitter range",
			attempt:      1,
			initialDelay: 100 * time.Millisecond,
			maxDelay:     1 * time.Second,
			multiplier:   2.0,
			jitter:       true,
			minExpected:  100 * time.Millisecond,
			maxExpected:  200 * time.Millisecond,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := RetryConfig{
				InitialDelay: tt.initialDelay,
				MaxDelay:     tt.maxDelay,
				Multiplier:   tt.multiplier,
				Jitter:       tt.jitter,
			}

			result := calculateBackoff(tt.attempt, config)

			assert.GreaterOrEqual(t, result, tt.minExpected)
			assert.LessOrEqual(t, result, tt.maxExpected)
		})
	}
}

func TestIsRetryableError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "nil error",
			err:      nil,
			expected: false,
		},
		{
			name:     "context deadline exceeded",
			err:      context.DeadlineExceeded,
			expected: true,
		},
		{
			name:     "context canceled",
			err:      context.Canceled,
			expected: false,
		},
		{
			name:     "regular error",
			err:      errors.New("some error"),
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsRetryableError(tt.err)
			assert.Equal(t, tt.expected, result)
		})
	}
}
