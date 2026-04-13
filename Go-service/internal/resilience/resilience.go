package resilience

import (
	"context"
	"errors"
	"fmt"
	"math"
	"math/rand"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/sony/gobreaker"
)

type CircuitBreakerConfig struct {
	MaxRequests      uint32
	Interval         time.Duration
	Timeout          time.Duration
	FailureThreshold float64
	MinRequests      uint32
}

type CircuitBreaker struct {
	cb     *gobreaker.CircuitBreaker
	name   string
	config CircuitBreakerConfig
}

func NewCircuitBreaker(name string, config CircuitBreakerConfig) *CircuitBreaker {
	settings := gobreaker.Settings{
		Name:        name,
		MaxRequests: config.MaxRequests,
		Interval:    config.Interval,
		Timeout:     config.Timeout,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.Requests >= config.MinRequests && failureRatio >= config.FailureThreshold
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			log.Warn().
				Str("circuit_breaker", name).
				Str("from_state", from.String()).
				Str("to_state", to.String()).
				Msg("Circuit breaker state changed")
		},
		IsSuccessful: func(err error) bool {
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				return true
			}
			return err == nil
		},
	}

	return &CircuitBreaker{
		cb:     gobreaker.NewCircuitBreaker(settings),
		name:   name,
		config: config,
	}
}

func (cb *CircuitBreaker) Execute(req func() (interface{}, error)) (interface{}, error) {
	return cb.cb.Execute(req)
}

func (cb *CircuitBreaker) State() gobreaker.State {
	return cb.cb.State()
}

type RetryConfig struct {
	MaxRetries   int
	InitialDelay time.Duration
	MaxDelay     time.Duration
	Multiplier   float64
	Jitter       bool
}

func Retry(ctx context.Context, config RetryConfig, operation func() error) error {
	if config.MaxRetries <= 0 {
		return operation()
	}

	var lastErr error
	for attempt := 0; attempt <= config.MaxRetries; attempt++ {
		if err := operation(); err != nil {
			lastErr = err

			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				return err
			}

			if attempt < config.MaxRetries {
				delay := calculateBackoff(attempt, config)

				log.Debug().
					Int("attempt", attempt+1).
					Int("max_retries", config.MaxRetries).
					Dur("delay", delay).
					Msg("Retrying after error")

				select {
				case <-time.After(delay):
					continue
				case <-ctx.Done():
					return ctx.Err()
				}
			}
		} else {
			if attempt > 0 {
				log.Info().
					Int("attempts", attempt+1).
					Msg("Operation succeeded after retries")
			}
			return nil
		}
	}

	return fmt.Errorf("exhausted %d retries: %w", config.MaxRetries, lastErr)
}

func calculateBackoff(attempt int, config RetryConfig) time.Duration {
	backoff := float64(config.InitialDelay) * math.Pow(config.Multiplier, float64(attempt))
	if backoff > float64(config.MaxDelay) {
		backoff = float64(config.MaxDelay)
	}

	if config.Jitter {
		halfBackoff := backoff / 2
		jitter := rand.Float64() * halfBackoff
		backoff = halfBackoff + jitter
	}

	return time.Duration(backoff)
}

func IsRetryableError(err error) bool {
	if err == nil {
		return false
	}

	var netErr interface {
		Timeout() bool
		Temporary() bool
	}

	if errors.As(err, &netErr) {
		return netErr.Timeout() || netErr.Temporary()
	}

	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}

	return false
}
