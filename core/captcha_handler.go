package core

import (
	"strings"
	"sync/atomic"
)

// CaptchaResultChan — канал для получения токена капчи из внешнего решателя (WebView2)
var CaptchaResultChan = make(chan string, 1)

// OnCaptchaRequired — колбэк для уведомления UI о необходимости показать окно капчи
var OnCaptchaRequired func(mode, redirectURI, sessionToken string)

var captchaModeValue atomic.Value

func init() {
	captchaModeValue.Store("auto")
}

func normalizeCaptchaMode(mode string) string {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "auto", "rjs", "wv":
		return strings.ToLower(strings.TrimSpace(mode))
	default:
		return "auto"
	}
}

func SetCaptchaMode(mode string) string {
	normalized := normalizeCaptchaMode(mode)
	captchaModeValue.Store(normalized)
	return normalized
}

func getCaptchaMode() string {
	mode, _ := captchaModeValue.Load().(string)
	if mode == "" {
		return "auto"
	}
	return mode
}

// drainCaptchaResult удаляет устаревший результат капчи из канала
func drainCaptchaResult() {
	select {
	case <-CaptchaResultChan:
	default:
	}
}

// SubmitCaptchaToken передаёт полученный токен капчи в канал
func SubmitCaptchaToken(token string) {
	drainCaptchaResult()
	select {
	case CaptchaResultChan <- token:
	default:
	}
}
