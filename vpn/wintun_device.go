package vpn

import (
	"errors"
	"fmt"
	"io"
	"log"
	"net/netip"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/sys/windows"
	"golang.zx2c4.com/wireguard/windows/tunnel/winipcfg"
	"golang.zx2c4.com/wintun"
)

// WintunDevice реализует io.ReadWriteCloser поверх wintun.Session
type WintunDevice struct {
	Adapter    *wintun.Adapter
	Session    wintun.Session
	closeEvent windows.Handle
	closeOnce  sync.Once
	closed     bool
	mu         sync.Mutex
}

const (
	AdapterName = "PodletsWDTT"
	TunnelType  = "PodletsWDTT"
)

// GUID для Wintun адаптера PodletsWDTT
var adapterGUID = windows.GUID{
	Data1: 0x9a8b7c6d,
	Data2: 0x1234,
	Data3: 0x5678,
	Data4: [8]byte{0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0},
}

func removeStaleWintunAdapter() {
	if adapter, err := wintun.OpenAdapter(AdapterName); err == nil {
		_ = adapter.Close()
		log.Printf("[WINTUN] Найден и удалён залипший адаптер %s", AdapterName)
		time.Sleep(250 * time.Millisecond)
	}
}

// NewWintunDevice инициализирует и поднимает Wintun адаптер
func NewWintunDevice() (*WintunDevice, error) {
	if err := EnsureWintunLoaded(); err != nil {
		return nil, fmt.Errorf("wintun driver not available: %w", err)
	}

	removeStaleWintunAdapter()

	var adapter *wintun.Adapter
	var err error

	adapter, err = wintun.OpenAdapter(AdapterName)
	if err != nil {
		adapter, err = wintun.CreateAdapter(AdapterName, TunnelType, &adapterGUID)
		if err != nil {
			removeStaleWintunAdapter()
			time.Sleep(300 * time.Millisecond)
			adapter, err = wintun.CreateAdapter(AdapterName, TunnelType, &adapterGUID)
			if err != nil {
				return nil, fmt.Errorf("failed to create wintun adapter: %w", err)
			}
		}
	}

	session, err := adapter.StartSession(0x800000)
	if err != nil {
		log.Printf("[WINTUN] Не удалось запустить сессию Wintun (%v), пересоздаём адаптер...", err)
		_ = adapter.Close()
		removeStaleWintunAdapter()
		time.Sleep(300 * time.Millisecond)

		adapter, err = wintun.CreateAdapter(AdapterName, TunnelType, &adapterGUID)
		if err != nil {
			removeStaleWintunAdapter()
			time.Sleep(300 * time.Millisecond)
			adapter, err = wintun.CreateAdapter(AdapterName, TunnelType, &adapterGUID)
			if err != nil {
				return nil, fmt.Errorf("failed to recreate wintun adapter: %w", err)
			}
		}

		session, err = adapter.StartSession(0x800000)
		if err != nil {
			_ = adapter.Close()
			removeStaleWintunAdapter()
			return nil, fmt.Errorf("failed to start wintun session: %w", err)
		}
	}

	closeEvent, err := windows.CreateEvent(nil, 1, 0, nil)
	if err != nil {
		session.End()
		_ = adapter.Close()
		removeStaleWintunAdapter()
		return nil, fmt.Errorf("failed to create close event: %w", err)
	}

	log.Printf("[WINTUN] Адаптер %s успешно инициализирован", AdapterName)
	return &WintunDevice{
		Adapter:    adapter,
		Session:    session,
		closeEvent: closeEvent,
	}, nil
}

// Configure настраивает IP, MTU, DNS и маршруты интерфейса Wintun через WinIPCfg (native Win32 API)
func (d *WintunDevice) Configure(tunIP, dnsCSV, mtuStr string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.Adapter == nil {
		return fmt.Errorf("wintun adapter is nil")
	}

	luid := winipcfg.LUID(d.Adapter.LUID())

	cleanTunIP := strings.TrimSpace(tunIP)
	ip, err := netip.ParseAddr(cleanTunIP)
	if err != nil {
		return fmt.Errorf("invalid tun IP %q: %w", tunIP, err)
	}

	prefix := netip.PrefixFrom(ip, 16)
	if err := luid.SetIPAddresses([]netip.Prefix{prefix}); err != nil {
		return fmt.Errorf("failed to set IP address %s: %w", prefix, err)
	}
	log.Printf("[WINTUN] IP-адрес %s успешно назначен на адаптер", prefix)

	mtu := 1300
	if parsedMTU, err := strconv.Atoi(strings.TrimSpace(mtuStr)); err == nil && parsedMTU > 0 {
		mtu = parsedMTU
	}

	if ipif, err := luid.IPInterface(windows.AF_INET); err == nil {
		ipif.NLMTU = uint32(mtu)
		ipif.UseAutomaticMetric = false
		ipif.Metric = 0
		if err := ipif.Set(); err != nil {
			log.Printf("[WINTUN] Предупреждение: ошибка обновления IPInterface: %v", err)
		} else {
			log.Printf("[WINTUN] Параметры интерфейса: MTU=%d, Metric=0 установлены", mtu)
		}
	} else {
		log.Printf("[WINTUN] Предупреждение: IPInterface недоступен: %v", err)
	}

	if dnsCSV != "" {
		var dnsAddrs []netip.Addr
		for _, part := range strings.Split(dnsCSV, ",") {
			part = strings.TrimSpace(part)
			if addr, err := netip.ParseAddr(part); err == nil {
				dnsAddrs = append(dnsAddrs, addr)
			}
		}
		if len(dnsAddrs) > 0 {
			if err := luid.SetDNS(windows.AF_INET, dnsAddrs, nil); err != nil {
				log.Printf("[WINTUN] Предупреждение при установке DNS: %v", err)
			} else {
				log.Printf("[WINTUN] DNS серверы %v успешно назначены", dnsAddrs)
			}
		}
	}

	_ = luid.FlushRoutes(windows.AF_INET)

	if err := luid.AddRoute(netip.MustParsePrefix("0.0.0.0/1"), netip.IPv4Unspecified(), 0); err != nil {
		log.Printf("[WINTUN] Предупреждение: AddRoute 0.0.0.0/1: %v", err)
	} else {
		log.Println("[WINTUN] Маршрут 0.0.0.0/1 (metric 0) добавлен")
	}

	if err := luid.AddRoute(netip.MustParsePrefix("128.0.0.0/1"), netip.IPv4Unspecified(), 0); err != nil {
		log.Printf("[WINTUN] Предупреждение: AddRoute 128.0.0.0/1: %v", err)
	} else {
		log.Println("[WINTUN] Маршрут 128.0.0.0/1 (metric 0) добавлен")
	}

	go func() {
		_, _ = runHiddenCmd("ipconfig", "/flushdns")
	}()
	return nil
}

// Read читает один входящий IP-пакет из сессии Wintun с ожиданием событий
func (d *WintunDevice) Read(b []byte) (int, error) {
	for {
		d.mu.Lock()
		if d.closed {
			d.mu.Unlock()
			return 0, io.EOF
		}
		d.mu.Unlock()

		pkt, err := d.Session.ReceivePacket()
		if err == nil {
			n := copy(b, pkt)
			d.Session.ReleaseReceivePacket(pkt)
			return n, nil
		}

		if errors.Is(err, windows.ERROR_NO_MORE_ITEMS) {
			handles := []windows.Handle{d.Session.ReadWaitEvent(), d.closeEvent}
			res, waitErr := windows.WaitForMultipleObjects(handles, false, windows.INFINITE)
			if waitErr != nil || res == windows.WAIT_OBJECT_0+1 {
				return 0, io.EOF
			}
			continue
		}

		return 0, err
	}
}

// Write отправляет один исходящий IP-пакет в сессию Wintun
func (d *WintunDevice) Write(b []byte) (int, error) {
	d.mu.Lock()
	if d.closed {
		d.mu.Unlock()
		return 0, io.EOF
	}
	d.mu.Unlock()

	pkt, err := d.Session.AllocateSendPacket(len(b))
	if err != nil {
		return 0, err
	}
	copy(pkt, b)
	d.Session.SendPacket(pkt)
	return len(b), nil
}

// Close закрывает сессию туннеля и сбрасывает IP/DNS/маршруты Wintun,
// оставляя адаптер зарегистрированным в системе для мгновенного повторного подключения.
func (d *WintunDevice) Close() error {
	d.closeOnce.Do(func() {
		d.mu.Lock()
		d.closed = true
		d.mu.Unlock()

		if d.closeEvent != 0 {
			_ = windows.SetEvent(d.closeEvent)
		}

		if d.Adapter != nil {
			luid := winipcfg.LUID(d.Adapter.LUID())
			_ = luid.FlushRoutes(windows.AF_INET)
			_ = luid.FlushDNS(windows.AF_INET)
			_ = luid.FlushIPAddresses(windows.AF_INET)
		}

		d.Session.End()

		if d.closeEvent != 0 {
			_ = windows.CloseHandle(d.closeEvent)
			d.closeEvent = 0
		}
		log.Printf("[WINTUN] Сессия адаптера %s остановлена (адаптер сохранён для мгновенного реконнекта)", AdapterName)
	})
	return nil
}

// CleanupWintunAdapter полностью удаляет адаптер из системы Windows (вызывается при выходе из программы)
func CleanupWintunAdapter() {
	if adapter, err := wintun.OpenAdapter(AdapterName); err == nil {
		_ = adapter.Close()
		log.Printf("[WINTUN] Адаптер %s полностью удалён из системы", AdapterName)
	}
}
