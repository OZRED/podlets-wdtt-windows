package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"podlets-wdtt/config"
	"podlets-wdtt/core"
	"podlets-wdtt/tray"
	"podlets-wdtt/vpn"
)

// HashCheckResult — результат проверки VK-хеша
type HashCheckResult struct {
	Index   int    `json:"index"`
	Hash    string `json:"hash"`
	Status  string `json:"status"` // ok, captcha, dead, limited, network, error
	Message string `json:"message"`
}

// RemoteSubscription — результат загрузки подписки
type RemoteSubscription struct {
	Profiles         []config.ConnectionProfile `json:"profiles"`
	SubscriptionName string                     `json:"subscription_name"`
	Description      string                     `json:"description"`
	TrafficUsedMb    float64                    `json:"traffic_used_mb"`
	TrafficLimitMb   float64                    `json:"traffic_limit_mb"`
	UpdatedAt        string                     `json:"updated_at"`
	Version          int                        `json:"version"`
}

// LogCollector перехватывает логи и сохраняет последние N записей
type LogCollector struct {
	mu     sync.Mutex
	logs   []string
	max    int
	appCtx context.Context
}

func (lc *LogCollector) Write(p []byte) (int, error) {
	msg := string(p)
	lc.mu.Lock()
	lc.logs = append(lc.logs, msg)
	if len(lc.logs) > lc.max {
		lc.logs = lc.logs[len(lc.logs)-lc.max:]
	}
	ctx := lc.appCtx
	lc.mu.Unlock()

	// Выводим в стандартный вывод
	os.Stdout.Write(p)

	// Эмитим событие на фронтенд
	if ctx != nil {
		runtime.EventsEmit(ctx, "log", strings.TrimSpace(msg))
	}
	return len(p), nil
}

// App struct
type App struct {
	ctx          context.Context
	cfg          *config.AppConfig
	tunnel       *vpn.TunnelController
	logCollector *LogCollector
	lastStats    vpn.TunnelStats
	statsMu      sync.Mutex
}

// NewApp creates a new App application struct
func NewApp() *App {
	lc := &LogCollector{
		logs: make([]string, 0, 500),
		max:  500,
	}
	// Дублируем стандартный логгер в наш коллектор
	log.SetOutput(lc)

	app := &App{
		logCollector: lc,
	}

	app.tunnel = vpn.NewTunnelController(
		func(state vpn.TunnelState, err string) {
			if app.ctx != nil {
				runtime.EventsEmit(app.ctx, "tunnel-state", map[string]interface{}{
					"state": state,
					"error": err,
				})
			}
			if state == vpn.StateConnected {
				tray.SetTrayConnected(true)
				tray.SetTrayTooltip("Podlets WDTT — Подключено")
			} else {
				tray.SetTrayConnected(false)
				tray.SetTrayTooltip("Podlets WDTT — Отключено")
			}
		},
		func(stats vpn.TunnelStats) {
			app.statsMu.Lock()
			app.lastStats = stats
			app.statsMu.Unlock()

			if app.ctx != nil {
				runtime.EventsEmit(app.ctx, "tunnel-stats", stats)
			}
		},
	)

	return app
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.logCollector.appCtx = ctx

	// Загружаем конфиг
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Printf("[APP] Ошибка загрузки конфига: %v", err)
	} else {
		a.cfg = cfg
	}

	// Задаем путь к папке ресурсов в ядре
	core.SetResourcesDir(config.GetResourcesDir())

	// Гарантируем наличие драйвера в resources/wintun.dll
	_ = vpn.EnsureWintunLoaded()

	// Заранее кэшируем основной шлюз, чтобы ускорить подключение
	vpn.InitDefaultRoute()

	// Колбэк капчи VK — отправляем событие на фронтенд для показа WebView
	core.OnCaptchaRequired = func(mode, redirectURI, sessionToken string) {
		log.Printf("[APP] Требуется решение капчи VK (%s)", mode)
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "captcha-required", map[string]string{
				"mode":         mode,
				"redirect_uri": redirectURI,
				"session_token": sessionToken,
			})
		}
	}

	log.Println("[APP] Podlets WDTT запущен и готов к работе")
}

// GetConfig возвращает текущий конфиг
func (a *App) GetConfig() (*config.AppConfig, error) {
	if a.cfg == nil {
		var err error
		a.cfg, err = config.LoadConfig()
		if err != nil {
			return nil, err
		}
	}
	return a.cfg, nil
}

// SaveConfig сохраняет конфиг
func (a *App) SaveConfig(cfg *config.AppConfig) error {
	a.cfg = cfg
	return a.cfg.Save()
}

// Connect запускает подключение по ID профиля
func (a *App) Connect(profileID string) error {
	if a.cfg == nil {
		return fmt.Errorf("config not loaded")
	}

	var target *config.ConnectionProfile
	for i := range a.cfg.Profiles {
		if a.cfg.Profiles[i].ID == profileID {
			target = &a.cfg.Profiles[i]
			break
		}
	}
	if target == nil {
		return fmt.Errorf("profile not found: %s", profileID)
	}

	a.cfg.ActiveProfileID = target.ID
	_ = a.cfg.Save()

	// Парсим исключения (маршруты обхода)
	var bypassRoutes []string
	lines := strings.Split(a.cfg.Settings.BypassRoutes, "\n")
	for _, l := range lines {
		l = strings.TrimSpace(l)
		if l != "" && !strings.HasPrefix(l, "#") {
			bypassRoutes = append(bypassRoutes, l)
		}
	}

	turnTransport := a.cfg.Settings.TurnTransport
	if turnTransport == "" {
		turnTransport = "tcp"
	}
	defaultObfs := a.cfg.Settings.DefaultObfs
	if defaultObfs == "" {
		defaultObfs = "audio"
	}

	return a.tunnel.Start(target, bypassRoutes, turnTransport, defaultObfs)
}

// Disconnect останавливает текущее подключение
func (a *App) Disconnect() error {
	a.tunnel.Stop()
	return nil
}

// GetTunnelStats возвращает последнюю статистику туннеля
func (a *App) GetTunnelStats() vpn.TunnelStats {
	a.statsMu.Lock()
	defer a.statsMu.Unlock()
	return a.lastStats
}

// SubmitCaptcha передает полученный токен капчи в ядро
func (a *App) SubmitCaptcha(token string) {
	token = strings.TrimSpace(token)
	if strings.Contains(token, "success_token=") {
		if u, err := url.Parse(token); err == nil {
			if qToken := u.Query().Get("success_token"); qToken != "" {
				token = qToken
			}
		}
	}
	log.Printf("[APP] Получен токен капчи от пользователя: %s...", token[:min(10, len(token))])
	core.SubmitCaptchaToken(token)
}

// CheckHashes проверяет список VK-хешей
func (a *App) CheckHashes(hashes []string) []HashCheckResult {
	results := make([]HashCheckResult, 0, len(hashes))
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	for i, hash := range hashes {
		hash = strings.TrimSpace(hash)
		if hash == "" {
			continue
		}

		checkCtx, cCancel := context.WithTimeout(ctx, 45*time.Second)
		_, _, turnURLs, err := core.GetCreds(checkCtx, hash, 9000+i)
		cCancel()

		status := "ok"
		message := fmt.Sprintf("TURN серверов: %d", len(turnURLs))

		if err != nil {
			status = classifyCheckError(err)
			message = err.Error()
		}

		results = append(results, HashCheckResult{
			Index:   i + 1,
			Hash:    hash,
			Status:  status,
			Message: message,
		})
	}
	return results
}

func classifyCheckError(err error) string {
	if err == nil {
		return "ok"
	}
	text := strings.ToLower(err.Error())
	switch {
	case strings.Contains(text, "captcha_required") || strings.Contains(text, "captcha_wait_required"):
		return "captcha"
	case strings.Contains(text, "call not found") || strings.Contains(text, "missing turn_server") || strings.Contains(text, "callunavailable"):
		return "dead"
	case strings.Contains(text, "flood") || strings.Contains(text, "rate limit"):
		return "limited"
	case strings.Contains(text, "timeout") || strings.Contains(text, "deadline") || strings.Contains(text, "network"):
		return "network"
	default:
		return "error"
	}
}

// FetchSubscription загружает удалённую подписку по URL
func (a *App) FetchSubscription(subURL string) (*RemoteSubscription, error) {
	subURL = strings.TrimSpace(subURL)
	if !strings.HasPrefix(strings.ToLower(subURL), "http://") && !strings.HasPrefix(strings.ToLower(subURL), "https://") {
		return nil, fmt.Errorf("URL должен начинаться с http:// или https://")
	}

	req, err := http.NewRequest("GET", subURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Podlets-WDTT-Windows/0.1.5")

	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("HTTP error: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	rawText := strings.TrimSpace(string(body))
	if !strings.HasPrefix(rawText, "{") && !strings.HasPrefix(rawText, "[") {
		if decoded, decErr := base64.StdEncoding.DecodeString(rawText); decErr == nil {
			rawText = strings.TrimSpace(string(decoded))
		}
	}

	var parsed RemoteSubscription
	if strings.HasPrefix(rawText, "{") {
		var root map[string]interface{}
		if err := json.Unmarshal([]byte(rawText), &root); err == nil {
			if name, ok := root["subscriptionName"].(string); ok {
				parsed.SubscriptionName = name
			} else if name, ok := root["groupName"].(string); ok {
				parsed.SubscriptionName = name
			}
			if desc, ok := root["description"].(string); ok {
				parsed.Description = desc
			} else if desc, ok := root["info"].(string); ok {
				parsed.Description = desc
			}
			if upd, ok := root["updatedAt"].(string); ok {
				parsed.UpdatedAt = upd
			} else if upd, ok := root["updated"].(string); ok {
				parsed.UpdatedAt = upd
			}
			if tu, ok := root["trafficUsedMb"].(float64); ok {
				parsed.TrafficUsedMb = tu
			} else if tu, ok := root["trafficMb"].(float64); ok {
				parsed.TrafficUsedMb = tu
			}
			if tl, ok := root["trafficLimitMb"].(float64); ok {
				parsed.TrafficLimitMb = tl
			} else if tl, ok := root["trafficLimit"].(float64); ok {
				parsed.TrafficLimitMb = tl
			}
			if v, ok := root["version"].(float64); ok {
				parsed.Version = int(v)
			}

			// Профили: проверяем "profiles" или "servers"
			if arr, ok := root["profiles"].([]interface{}); ok {
				parsed.Profiles = parseProfilesFromRaw(arr)
			} else if arr, ok := root["servers"].([]interface{}); ok {
				parsed.Profiles = parseProfilesFromRaw(arr)
			}
		}
	} else if strings.HasPrefix(rawText, "[") {
		var arr []interface{}
		if err := json.Unmarshal([]byte(rawText), &arr); err == nil {
			parsed.Profiles = parseProfilesFromRaw(arr)
		}
	}

	log.Printf("[APP] Подписка %s успешно загружена: %d профилей", subURL, len(parsed.Profiles))
	return &parsed, nil
}

func parseProfilesFromRaw(arr []interface{}) []config.ConnectionProfile {
	var list []config.ConnectionProfile
	for _, item := range arr {
		m, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		name, _ := m["name"].(string)
		if name == "" {
			name = "Сервер"
		}

		peer, _ := m["peer"].(string)
		peer = strings.TrimSpace(peer)
		if peer == "" {
			continue
		}
		// Если порт не указан, подставляем стандартный порт сервера :56003
		if !strings.Contains(peer, ":") {
			peer = peer + ":56003"
		}

		// Пароль: проверяем password или pass
		pass, _ := m["password"].(string)
		if pass == "" {
			pass, _ = m["pass"].(string)
		}

		// Хеши: проверяем hashes, vk_hashes или vkHashes
		hashes, _ := m["hashes"].(string)
		if hashes == "" {
			hashes, _ = m["vk_hashes"].(string)
		}
		if hashes == "" {
			hashes, _ = m["vkHashes"].(string)
		}

		// Воркеры: workers или workersPerHash
		workers := 9
		if w, ok := m["workers"].(float64); ok && w > 0 {
			workers = int(w)
		} else if w, ok := m["workersPerHash"].(float64); ok && w > 0 {
			workers = int(w)
		}

		// Локальный порт
		port := 9000
		if p, ok := m["port"].(float64); ok && p > 0 {
			port = int(p)
		} else if p, ok := m["listenPort"].(float64); ok && p > 0 {
			port = int(p)
		}

		dns, _ := m["dns"].(string)
		if dns == "" {
			dns = "yandex"
		}

		obfs, _ := m["obfs"].(string)
		if obfs == "" {
			obfs = "audio"
		}

		mode, _ := m["mode"].(string)
		if mode == "" {
			mode = "rawtun"
		}

		group, _ := m["group"].(string)
		if group == "" {
			group, _ = m["groupName"].(string)
		}

		notes, _ := m["notes"].(string)

		var trafficMb float64
		if t, ok := m["trafficMb"].(float64); ok {
			trafficMb = t
		} else if t, ok := m["trafficUsedMb"].(float64); ok {
			trafficMb = t
		}

		list = append(list, config.ConnectionProfile{
			ID:        uuid.New().String(),
			Name:      name,
			Peer:      peer,
			Password:  pass,
			VkHashes:  hashes,
			Workers:   workers,
			Port:      port,
			DNS:       dns,
			Obfs:      obfs,
			Mode:      mode,
			Group:     group,
			Notes:     notes,
			TrafficMb: trafficMb,
			CreatedAt: time.Now().Unix(),
			UpdatedAt: time.Now().Unix(),
		})
	}
	return list
}

// ImportUri разбирает ссылку wdtt://config?... или qwdtt://config?... или JSON/Base64
func (a *App) ImportUri(uriStr string) (*config.ConnectionProfile, error) {
	trimmed := strings.TrimSpace(uriStr)

	// Если передан Base64, пробуем декодировать
	if !strings.Contains(trimmed, "://") && !strings.HasPrefix(trimmed, "{") {
		if decoded, err := base64.StdEncoding.DecodeString(trimmed); err == nil {
			trimmed = strings.TrimSpace(string(decoded))
		}
	}

	// Проверяем, может это JSON
	if strings.HasPrefix(trimmed, "{") {
		var pMap map[string]interface{}
		if err := json.Unmarshal([]byte(trimmed), &pMap); err == nil {
			peer, _ := pMap["peer"].(string)
			if peer != "" {
				if !strings.Contains(peer, ":") {
					peer = peer + ":56003"
				}
				name, _ := pMap["name"].(string)
				if name == "" {
					name = "Импортированный профиль"
				}
				pass, _ := pMap["password"].(string)
				if pass == "" {
					pass, _ = pMap["pass"].(string)
				}
				hashes, _ := pMap["hashes"].(string)
				if hashes == "" {
					hashes, _ = pMap["vk_hashes"].(string)
				}
				workers := 9
				if w, ok := pMap["workers"].(float64); ok && w > 0 {
					workers = int(w)
				}
				return &config.ConnectionProfile{
					ID:        uuid.New().String(),
					Name:      name,
					Peer:      peer,
					Password:  pass,
					VkHashes:  hashes,
					Workers:   workers,
					Port:      9000,
					DNS:       "yandex",
					Obfs:      "audio",
					Mode:      "rawtun",
					CreatedAt: time.Now().Unix(),
					UpdatedAt: time.Now().Unix(),
				}, nil
			}
		}
	}

	// Нормализуем URI схемы
	trimmed = strings.Replace(trimmed, "qwdtt:config", "wdtt://config", 1)
	trimmed = strings.Replace(trimmed, "wdtt:config", "wdtt://config", 1)
	trimmed = strings.Replace(trimmed, "qwdtt://config", "wdtt://config", 1)

	if !strings.HasPrefix(trimmed, "wdtt://") {
		return nil, fmt.Errorf("неизвестный формат: ссылка должна начинаться с wdtt:// или qwdtt://")
	}

	u, err := url.Parse(trimmed)
	if err != nil {
		return nil, err
	}

	q := u.Query()
	peer := q.Get("peer")
	if peer == "" {
		return nil, fmt.Errorf("в ссылке отсутствует параметр сервера (peer)")
	}
	if !strings.Contains(peer, ":") {
		peer = peer + ":56003"
	}

	name := q.Get("name")
	if name == "" {
		name = "Импортированный профиль"
	}

	workers, _ := strconv.Atoi(q.Get("workers"))
	if workers <= 0 {
		workers = 9
	}
	port, _ := strconv.Atoi(q.Get("port"))
	if port <= 0 {
		port = 9000
	}

	pass := q.Get("pass")
	if pass == "" {
		pass = q.Get("password")
	}

	p := &config.ConnectionProfile{
		ID:        uuid.New().String(),
		Name:      name,
		Peer:      peer,
		Password:  pass,
		VkHashes:  q.Get("hashes"),
		Workers:   workers,
		Port:      port,
		DNS:       "yandex",
		Obfs:      "audio",
		Mode:      "rawtun",
		CreatedAt: time.Now().Unix(),
		UpdatedAt: time.Now().Unix(),
	}
	return p, nil
}

// ExportUri формирует ссылку wdtt://config?...
func (a *App) ExportUri(p config.ConnectionProfile) string {
	q := url.Values{}
	q.Set("name", p.Name)
	q.Set("peer", p.Peer)
	if p.Password != "" {
		q.Set("pass", p.Password)
	}
	if p.VkHashes != "" {
		q.Set("hashes", p.VkHashes)
	}
	q.Set("workers", strconv.Itoa(p.Workers))
	q.Set("port", strconv.Itoa(p.Port))
	return fmt.Sprintf("wdtt://config?%s", q.Encode())
}

// GetLogs возвращает накопленные логи
func (a *App) GetLogs() []string {
	a.logCollector.mu.Lock()
	defer a.logCollector.mu.Unlock()
	cpy := make([]string, len(a.logCollector.logs))
	copy(cpy, a.logCollector.logs)
	return cpy
}

// ClearLogs очищает логи
func (a *App) ClearLogs() {
	a.logCollector.mu.Lock()
	defer a.logCollector.mu.Unlock()
	a.logCollector.logs = make([]string, 0, 500)
}
