package vpn

import (
	"context"
	"fmt"
	"log"
	"net"
	"strings"
	"sync"
	"time"

	"podlets-wdtt/config"
	"podlets-wdtt/core"
)

type TunnelState string

const (
	StateDisconnected  TunnelState = "DISCONNECTED"
	StateConnecting    TunnelState = "CONNECTING"
	StateConnected     TunnelState = "CONNECTED"
	StateDisconnecting TunnelState = "DISCONNECTING"
	StateError         TunnelState = "ERROR"
)

type TunnelStats struct {
	State        TunnelState `json:"state"`
	ErrorMessage string      `json:"error_message"`
	BytesUp      int64       `json:"bytes_up"`
	BytesDown    int64       `json:"bytes_down"`
	SpeedUp      int64       `json:"speed_up"`   // байт/сек
	SpeedDown    int64       `json:"speed_down"` // байт/сек
	PingMs       int64       `json:"ping_ms"`
	ActiveRelays int         `json:"active_relays"`
	ConnectedAt  int64       `json:"connected_at"`
}

type TunnelController struct {
	mu           sync.Mutex
	ctx          context.Context
	cancel       context.CancelFunc
	state        TunnelState
	errorMsg     string
	wintunDev    *WintunDevice
	routeMgr     *RouteManager
	stats        *core.Stats
	lastBytesUp  int64
	lastBytesDown int64
	connectedAt  int64
	pingMs       int64
	onStateChange func(state TunnelState, err string)
	onStatsUpdate func(stats TunnelStats)
}

func NewTunnelController(
	onStateChange func(state TunnelState, err string),
	onStatsUpdate func(stats TunnelStats),
) *TunnelController {
	return &TunnelController{
		state:         StateDisconnected,
		onStateChange: onStateChange,
		onStatsUpdate: onStatsUpdate,
	}
}

func (tc *TunnelController) GetState() TunnelState {
	tc.mu.Lock()
	defer tc.mu.Unlock()
	return tc.state
}

func (tc *TunnelController) setState(s TunnelState, err string) {
	tc.mu.Lock()
	tc.state = s
	tc.errorMsg = err
	callback := tc.onStateChange
	tc.mu.Unlock()

	if callback != nil {
		callback(s, err)
	}
}

// Start запускает подключение к серверу через VK TURN и поднимает Wintun
func (tc *TunnelController) Start(p *config.ConnectionProfile, bypassRoutes []string, turnTransport string, defaultObfs string) error {
	tc.mu.Lock()
	if tc.state == StateConnecting || tc.state == StateConnected {
		tc.mu.Unlock()
		return fmt.Errorf("tunnel already active")
	}

	tc.ctx, tc.cancel = context.WithCancel(context.Background())
	tc.state = StateConnecting
	tc.errorMsg = ""
	tc.lastBytesUp = 0
	tc.lastBytesDown = 0
	tc.connectedAt = 0
	tc.mu.Unlock()

	tc.setState(StateConnecting, "")
	if turnTransport == "" {
		turnTransport = "tcp"
	}
	log.Printf("[TUNNEL] Запуск подключения к %s (%s) [Транспорт: %s]...", p.Name, p.Peer, strings.ToUpper(turnTransport))

	go tc.run(tc.ctx, p, bypassRoutes, turnTransport, defaultObfs)
	return nil
}

func (tc *TunnelController) run(ctx context.Context, p *config.ConnectionProfile, bypassRoutes []string, turnTransport string, defaultObfs string) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[TUNNEL] Паника в туннеле: %v", r)
			tc.setState(StateError, fmt.Sprintf("Panic: %v", r))
		}
	}()

	// 1. Инициализация DNS и режима
	core.SetupGlobalResolver(p.DNS)
	core.SetCaptchaMode("auto")

	hashes := core.ParseHashes(p.VkHashes)
	if len(hashes) == 0 {
		tc.setState(StateError, "Не указаны хеши VK-звонков")
		return
	}

	peer, err := net.ResolveUDPAddr("udp", p.Peer)
	if err != nil {
		tc.setState(StateError, fmt.Sprintf("Ошибка адреса сервера %s: %v", p.Peer, err))
		return
	}

	wrapKey, err := core.DeriveWrapKey(p.Password)
	if err != nil {
		tc.setState(StateError, fmt.Sprintf("Ошибка WRAP ключа: %v", err))
		return
	}

	// 2. Инициализация менеджера маршрутизации
	rm, err := NewRouteManager()
	if err != nil {
		log.Printf("[TUNNEL] Предупреждение: не удалось получить шлюз по умолчанию: %v", err)
	} else {
		tc.mu.Lock()
		tc.routeMgr = rm
		tc.mu.Unlock()

		// Защищаем IP сервера от зацикливания через VPN
		_ = rm.AddBypassHost(peer.IP.String())

		// Добавляем DNS Яндекса (используемый для VK) в обход
		_ = rm.AddBypassHost("77.88.8.8")
		_ = rm.AddBypassHost("77.88.8.1")

		// Добавляем исключения (split tunneling)
		for _, route := range bypassRoutes {
			_ = rm.AddBypassSubnet(route)
		}

		// Автоматически добавляем все полученные TURN серверы в обход через физический шлюз
		core.SetTurnURLCallback(func(urls []string) {
			go func() {
				for _, u := range urls {
					host, _, err := net.SplitHostPort(u)
					if err == nil {
						_ = rm.AddBypassHost(host)
					}
				}
			}()
		})
	}

	// 3. Параметры TURN
	numWorkers := p.Workers
	if numWorkers < 1 {
		numWorkers = 9
	}

	obfs := p.Obfs
	if obfs == "" {
		obfs = defaultObfs
	}
	if obfs == "" {
		obfs = "audio"
	}

	useTCP := strings.ToLower(turnTransport) != "udp"

	tp := &core.TurnParams{
		Hashes:       hashes,
		WrapKey:      wrapKey,
		ObfsMode:     core.NormalizeObfsMode(obfs),
		RawMode:      true, // Режим rawtun (сырые IP-пакеты в Wintun)
		TCPTransport: useTCP,
	}

	tc.stats = core.NewStats()
	shutdownStats := make(chan struct{})
	go func() {
		<-ctx.Done()
		close(shutdownStats)
	}()
	go tc.stats.RunLoop(shutdownStats)

	// Запускаем фоновый таймер сбора статистики для UI
	go tc.statsTicker(ctx)

	disp := core.NewDispatcherPendingTUN(ctx, tc.stats)
	defer disp.Shutdown()

	// Предварительная асинхронная инициализация Wintun адаптера (в параллель с запросами к VK/TURN)
	type wintunInitRes struct {
		dev *WintunDevice
		err error
	}
	wintunCh := make(chan wintunInitRes, 1)
	go func() {
		dev, devErr := NewWintunDevice()
		wintunCh <- wintunInitRes{dev: dev, err: devErr}
	}()

	configCh := make(chan string, 1)

	// Ожидание конфига от сервера и применение настроек Wintun
	go func() {
		select {
		case rawConf, ok := <-configCh:
			if !ok || rawConf == "" {
				// Конфиг не получен: если Wintun успел создаться в фоне — закрываем сессию
				go func() {
					res := <-wintunCh
					if res.dev != nil {
						_ = res.dev.Close()
					}
				}()
				return
			}
			log.Printf("[TUNNEL] Получен конфиг от сервера: %s", rawConf)

			if strings.HasPrefix(rawConf, "RAWCONF:") {
				parts := strings.Split(strings.TrimPrefix(rawConf, "RAWCONF:"), "|")
				if len(parts) >= 3 {
					tunIP, dnsCSV, mtuStr := parts[0], parts[1], parts[2]

					// Забираем уже созданный в параллельном потоке Wintun адаптер
					wintunRes := <-wintunCh
					if wintunRes.err != nil {
						log.Printf("[TUNNEL] Ошибка создания Wintun: %v", wintunRes.err)
						tc.setState(StateError, fmt.Sprintf("Wintun error: %v", wintunRes.err))
						return
					}
					dev := wintunRes.dev

					// Настраиваем IP, MTU, DNS и глобальную маршрутизацию через WinIPCfg
					if confErr := dev.Configure(tunIP, dnsCSV, mtuStr); confErr != nil {
						log.Printf("[TUNNEL] Ошибка настройки Wintun: %v", confErr)
						tc.setState(StateError, fmt.Sprintf("Wintun config error: %v", confErr))
						_ = dev.Close()
						return
					}

					tc.mu.Lock()
					tc.wintunDev = dev
					tc.connectedAt = time.Now().Unix()
					tc.mu.Unlock()

					// Подключаем поток пакетов к диспетчеру
					disp.AttachTUN(dev)
					tc.setState(StateConnected, "")
					log.Printf("[TUNNEL] Системный VPN успешно поднят (IP: %s, MTU: %s)", tunIP, mtuStr)
				}
			}
		case <-ctx.Done():
			// Отмена контекста: закрываем фоновый Wintun если успел создаться
			go func() {
				res := <-wintunCh
				if res.dev != nil {
					_ = res.dev.Close()
				}
			}()
			return
		}
	}()

	// 4. Запуск групп воркеров
	var pauseFlag int32
	workerIDCounter := 1
	numGroups := (numWorkers + 8) / 9
	var wg sync.WaitGroup

	for g := 0; g < numGroups; g++ {
		isFirst := (g == 0)
		startIdx := g * 9
		endIdx := startIdx + 9
		if endIdx > numWorkers {
			endIdx = numWorkers
		}
		groupSize := endIdx - startIdx
		if groupSize <= 0 {
			continue
		}

		ids := make([]int, groupSize)
		for i := range ids {
			ids[i] = workerIDCounter
			workerIDCounter++
		}

		var cc chan<- string
		if isFirst {
			cc = configCh
		}

		wg.Add(1)
		go func(gID int, isFirstGroup bool, cCh chan<- string, wIds []int, startHash int) {
			defer wg.Done()
			core.WorkerGroup(ctx, gID, startHash, tp, peer, disp, fmt.Sprintf("%d", p.Port),
				isFirstGroup, cCh, wIds, &pauseFlag, "windows-pc", p.Password, tc.stats, nil, nil)
		}(g+1, isFirst, cc, ids, g)
	}

	wg.Wait()
	close(configCh)

	tc.cleanup()
	tc.setState(StateDisconnected, "")
	log.Println("[TUNNEL] Туннель остановлен")
}

func (tc *TunnelController) statsTicker(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			tc.mu.Lock()
			if tc.stats == nil || tc.state != StateConnected {
				tc.mu.Unlock()
				continue
			}

			curUp := tc.stats.TotalBytesUp.Load()
			curDown := tc.stats.TotalBytesDown.Load()

			speedUp := curUp - tc.lastBytesUp
			speedDown := curDown - tc.lastBytesDown
			if speedUp < 0 {
				speedUp = 0
			}
			if speedDown < 0 {
				speedDown = 0
			}

			tc.lastBytesUp = curUp
			tc.lastBytesDown = curDown

			info := TunnelStats{
				State:        tc.state,
				ErrorMessage: tc.errorMsg,
				BytesUp:      curUp,
				BytesDown:    curDown,
				SpeedUp:      speedUp,
				SpeedDown:    speedDown,
				PingMs:       tc.pingMs,
				ActiveRelays: int(tc.stats.ActiveConnections.Load()),
				ConnectedAt:  tc.connectedAt,
			}
			callback := tc.onStatsUpdate
			tc.mu.Unlock()

			if callback != nil {
				callback(info)
			}
		}
	}
}

// Stop останавливает туннель и очищает все маршруты
func (tc *TunnelController) Stop() {
	tc.mu.Lock()
	if tc.state == StateDisconnected {
		tc.mu.Unlock()
		return
	}
	tc.state = StateDisconnected
	if tc.cancel != nil {
		tc.cancel()
	}
	tc.mu.Unlock()

	tc.setState(StateDisconnected, "")
	go tc.cleanup()
}

func (tc *TunnelController) cleanup() {
	core.SetTurnURLCallback(nil)

	tc.mu.Lock()
	defer tc.mu.Unlock()

	if tc.wintunDev != nil {
		_ = tc.wintunDev.Close()
		tc.wintunDev = nil
	}

	if tc.routeMgr != nil {
		tc.routeMgr.CleanupRoutes()
		tc.routeMgr = nil
	}
}
