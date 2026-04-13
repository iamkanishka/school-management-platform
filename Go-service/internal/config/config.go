package config

import (
	"fmt"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Port           int           `mapstructure:"PORT"`
	NodeJSBaseURL  string        `mapstructure:"NODEJS_BASE_URL"`
	NodeJSAPIKey   string        `mapstructure:"NODEJS_API_KEY"`
	NodeJSTimeout  time.Duration `mapstructure:"NODEJS_TIMEOUT"`
	APIKey         string        `mapstructure:"API_KEY"`
	AllowedOrigin  string        `mapstructure:"ALLOWED_ORIGIN"`
	RateLimit      int           `mapstructure:"RATE_LIMIT"`
	JaegerEndpoint string        `mapstructure:"JAEGER_ENDPOINT"`
	LogLevel       string        `mapstructure:"LOG_LEVEL"`
	PDFOutputDir   string        `mapstructure:"PDF_OUTPUT_DIR"`
	MaxPDFSize     int64         `mapstructure:"MAX_PDF_SIZE"`
}

func Load() (*Config, error) {
	viper.SetDefault("PORT", 8080)
	viper.SetDefault("NODEJS_TIMEOUT", "10s")
	viper.SetDefault("RATE_LIMIT", 100)
	viper.SetDefault("LOG_LEVEL", "info")
	viper.SetDefault("PDF_OUTPUT_DIR", "/tmp/pdfs")
	viper.SetDefault("MAX_PDF_SIZE", 10485760)
	viper.SetDefault("ALLOWED_ORIGIN", "http://localhost:3000")

	viper.AutomaticEnv()

	// 🔥 IMPORTANT FIXES
	viper.SetTypeByDefaultValue(true)

	viper.BindEnv("PORT")
	viper.BindEnv("NODEJS_BASE_URL")
	viper.BindEnv("NODEJS_API_KEY")

	viper.BindEnv("NODEJS_TIMEOUT")
	viper.BindEnv("API_KEY")
	viper.BindEnv("RATE_LIMIT")
	viper.BindEnv("JAEGER_ENDPOINT")
	viper.BindEnv("LOG_LEVEL")
	viper.BindEnv("PDF_OUTPUT_DIR")
	viper.BindEnv("MAX_PDF_SIZE")
	viper.BindEnv("ALLOWED_ORIGIN")

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	if cfg.NodeJSBaseURL == "" {
		return nil, fmt.Errorf("NODEJS_BASE_URL is required")
	}
	if cfg.NodeJSAPIKey == "" {
		return nil, fmt.Errorf("NODEJS_API_KEY is required")
	}

	if cfg.APIKey == "" {
		return nil, fmt.Errorf("API_KEY is required")
	}

	if cfg.AllowedOrigin == "" {
		return nil, fmt.Errorf("ALLOWED_ORIGIN is required")
	}

	return &cfg, nil
}
