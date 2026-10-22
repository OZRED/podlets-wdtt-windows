package config

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ConnectionProfile — модель профиля подключения
type ConnectionProfile struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Peer           string  `json:"peer"`      // IP:Port VPS
	Password       string  `json:"password"`  // Пароль подключения
	VkHashes       string  `json:"vk_hashes"` // Хеши звонков VK (через запятую)
	Workers        int     `json:"workers"`   // Количество воркеров (по умолчанию 9)
	Port           int     `json:"port"`      // Локальный порт
	DNS            string  `json:"dns"`       // yandex / cloudflare / google / doh-...
	Obfs           string  `json:"obfs"`      // audio / video
	Mode           string  `json:"mode"`      // rawtun / vpn / socks
	Group          string  `json:"group"`     // Название группы
	Notes          string  `json:"notes"`     // Заметки
	TrafficMb      float64 `json:"traffic_mb"` // Использованный трафик
	SubscriptionID string  `json:"subscription_id,omitempty"` // ID подписки
	CreatedAt      int64   `json:"created_at"`
	UpdatedAt      int64   `json:"updated_at"`
}

// AppSettings — глобальные настройки приложения
type AppSettings struct {
	AutoConnect    bool   `json:"auto_connect"`
	CloseToTray    bool   `json:"close_to_tray"`
	DefaultDNS     string `json:"default_dns"`
	DefaultObfs    string `json:"default_obfs"`
	TurnTransport  string `json:"turn_transport"` // "tcp" или "udp" (по умолчанию tcp)
	DefaultWorkers int    `json:"default_workers"`
	BypassRoutes   string `json:"bypass_routes"` // Список подсетей/IP в обход VPN
	VkAnonPath     string `json:"vk_anon_path"`  // vkcalls / legacy
	VkAuthMode     string `json:"vk_auth_mode"`  // anonymous / account
}

// SubscriptionItem — подписка на удалённые конфигурации
type SubscriptionItem struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	URL            string  `json:"url"`
	Description    string  `json:"description"`
	UpdatedAt      string  `json:"updated_at"`
	TrafficUsedMb  float64 `json:"traffic_used_mb"`
	TrafficLimitMb float64 `json:"traffic_limit_mb"`
	Version        int     `json:"version"`
}

// AppConfig — главный конфиг, сохраняемый в config.json рядом с exe
type AppConfig struct {
	ActiveProfileID string              `json:"active_profile_id"`
	Profiles        []ConnectionProfile `json:"profiles"`
	Subscriptions   []SubscriptionItem  `json:"subscriptions"`
	Settings        AppSettings         `json:"settings"`
	mu              sync.Mutex          `json:"-"`
	configPath      string              `json:"-"`
}

const ConfigFileName = "config.json"
const BypassSubnetsFileName = "bypass_subnets.txt"

// GetResourcesDir возвращает путь к папке resources рядом с exe
func GetResourcesDir() string {
	execPath, err := os.Executable()
	dir := "."
	if err == nil {
		dir = filepath.Dir(execPath)
	}
	resDir := filepath.Join(dir, "resources")
	_ = os.MkdirAll(resDir, 0755)
	return resDir
}

// GetConfigPath определяет путь к resources/config.json
func GetConfigPath() string {
	resDir := GetResourcesDir()
	targetPath := filepath.Join(resDir, ConfigFileName)

	// Бесшовный перенос: если в resources/config.json файла ещё нет, а в корне есть старый config.json
	if _, err := os.Stat(targetPath); os.IsNotExist(err) {
		execPath, err2 := os.Executable()
		if err2 == nil {
			oldPath := filepath.Join(filepath.Dir(execPath), ConfigFileName)
			if data, readErr := os.ReadFile(oldPath); readErr == nil {
				if writeErr := os.WriteFile(targetPath, data, 0644); writeErr == nil {
					_ = os.Remove(oldPath)
					log.Printf("[CONFIG] Старый config.json успешно перенесён в %s", targetPath)
				}
			}
		}
	}

	return targetPath
}

// GetBypassSubnetsPath возвращает путь к resources/bypass_subnets.txt
func GetBypassSubnetsPath() string {
	resDir := GetResourcesDir()
	return filepath.Join(resDir, BypassSubnetsFileName)
}

// LoadBypassSubnets читает исключения из resources/bypass_subnets.txt
func LoadBypassSubnets(fallbackRoutes string) string {
	path := GetBypassSubnetsPath()
	data, err := os.ReadFile(path)
	if err == nil {
		content := strings.TrimSpace(string(data))
		if content != "" {
			return content
		}
	}

	defaultContent := strings.TrimSpace(fallbackRoutes)
	if defaultContent == "" {
		defaultContent = "# Подсети и IP-адреса в обход VPN (по одной на строку)\n10.0.0.0/8\n172.16.0.0/12\n192.168.0.0/16"
	}
	_ = os.WriteFile(path, []byte(defaultContent), 0644)
	return defaultContent
}

// SaveBypassSubnets сохраняет подсети в resources/bypass_subnets.txt
func SaveBypassSubnets(routes string) {
	path := GetBypassSubnetsPath()
	_ = os.WriteFile(path, []byte(routes), 0644)
}

// LoadConfig загружает config.json или создаёт дефолтный
func LoadConfig() (*AppConfig, error) {
	path := GetConfigPath()
	cfg := &AppConfig{
		configPath: path,
		Profiles:   make([]ConnectionProfile, 0),
		Subscriptions: make([]SubscriptionItem, 0),
		Settings: AppSettings{
			AutoConnect:    false,
			CloseToTray:    false,
			DefaultDNS:     "yandex",
			DefaultObfs:    "audio",
			TurnTransport:  "tcp",
			DefaultWorkers: 9,
			BypassRoutes:   LoadBypassSubnets("10.0.0.0/8\n172.16.0.0/12\n192.168.0.0/16"),
			VkAnonPath:     "vkcalls",
			VkAuthMode:     "anonymous",
		},
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			_ = cfg.Save()
			log.Printf("[CONFIG] Создан новый конфигурационный файл: %s", path)
			return cfg, nil
		}
		return nil, fmt.Errorf("failed to read config: %w", err)
	}

	if err := json.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config.json: %w", err)
	}

	// Синхронизируем bypass_routes с файлом resources/bypass_subnets.txt
	cfg.Settings.BypassRoutes = LoadBypassSubnets(cfg.Settings.BypassRoutes)

	// Валидация
	if cfg.Settings.DefaultWorkers <= 0 {
		cfg.Settings.DefaultWorkers = 9
	}
	if cfg.Settings.DefaultDNS == "" {
		cfg.Settings.DefaultDNS = "yandex"
	}
	if cfg.Settings.DefaultObfs == "" {
		cfg.Settings.DefaultObfs = "audio"
	}
	if cfg.Settings.TurnTransport == "" {
		cfg.Settings.TurnTransport = "tcp"
	}

	log.Printf("[CONFIG] Успешно загружен конфиг из %s (%d профилей)", path, len(cfg.Profiles))
	return cfg, nil
}

// Save сохраняет текущий конфиг в файл
func (c *AppConfig) Save() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}

	path := c.configPath
	if path == "" {
		path = GetConfigPath()
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return err
	}

	// Синхронизируем с resources/bypass_subnets.txt
	SaveBypassSubnets(c.Settings.BypassRoutes)
	return nil
}

// GetActiveProfile возвращает активный выбранный профиль
func (c *AppConfig) GetActiveProfile() *ConnectionProfile {
	c.mu.Lock()
	defer c.mu.Unlock()

	for i := range c.Profiles {
		if c.Profiles[i].ID == c.ActiveProfileID {
			return &c.Profiles[i]
		}
	}
	if len(c.Profiles) > 0 {
		return &c.Profiles[0]
	}
	return nil
}

// UpsertProfile добавляет или обновляет профиль
func (c *AppConfig) UpsertProfile(p ConnectionProfile) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if p.ID == "" {
		p.ID = uuid.New().String()
		p.CreatedAt = time.Now().Unix()
	}
	p.UpdatedAt = time.Now().Unix()

	for i := range c.Profiles {
		if c.Profiles[i].ID == p.ID {
			c.Profiles[i] = p
			return
		}
	}
	c.Profiles = append(c.Profiles, p)
}

// DeleteProfile удаляет профиль по ID
func (c *AppConfig) DeleteProfile(id string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	newList := make([]ConnectionProfile, 0, len(c.Profiles))
	for _, p := range c.Profiles {
		if p.ID != id {
			newList = append(newList, p)
		}
	}
	c.Profiles = newList
}
