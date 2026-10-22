package vpn

import (
	"bufio"
	"fmt"
	"log"
	"net"
	"os/exec"
	"strings"
	"sync"
	"syscall"
)

// RouteManager управляет маршрутами Windows
type RouteManager struct {
	OriginalGateway string
	OriginalIface   string
	AddedRoutes     []string // список добавленных маршрутов для очистки
	mu              sync.Mutex
}

// NewRouteManager находит текущий основной шлюз по умолчанию
func NewRouteManager() (*RouteManager, error) {
	gw, iface, err := findDefaultGateway()
	if err != nil {
		return nil, fmt.Errorf("failed to detect default gateway: %w", err)
	}
	log.Printf("[ROUTE] Основной шлюз: %s (интерфейс: %s)", gw, iface)
	return &RouteManager{
		OriginalGateway: gw,
		OriginalIface:   iface,
		AddedRoutes:     make([]string, 0),
	}, nil
}

// runHiddenCmd запускает команду без всплывающего черного консольного окна
func runHiddenCmd(name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}
	out, err := cmd.CombinedOutput()
	return string(out), err
}

func findDefaultGateway() (string, string, error) {
	out, err := runHiddenCmd("route", "print", "0.0.0.0")
	if err != nil {
		return "", "", err
	}

	scanner := bufio.NewScanner(strings.NewReader(out))
	var bestGw, bestIface string
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "0.0.0.0") {
			fields := strings.Fields(line)
			if len(fields) >= 4 && fields[0] == "0.0.0.0" && fields[1] == "0.0.0.0" {
				gw := fields[2]
				iface := fields[3]
				lowGw := strings.ToLower(gw)
				// Пропускаем On-link или петли
				if !strings.Contains(lowGw, "link") && !strings.Contains(lowGw, "постоян") {
					ip := net.ParseIP(gw)
					if ip != nil && !ip.IsLoopback() && !ip.IsUnspecified() {
						// Если найден не-виртуальный шлюз (например 192.168.x.x или 10.x.x.x), отдаем предпочтение
						bestGw = gw
						bestIface = iface
						if !strings.HasPrefix(gw, "172.19.") {
							return bestGw, bestIface, nil
						}
					}
				}
			}
		}
	}
	if bestGw != "" {
		return bestGw, bestIface, nil
	}
	return "", "", fmt.Errorf("default gateway not found in route print")
}

// AddBypassHost добавляет маршрут к конкретному IP через основной шлюз (для обхода VPN)
func (rm *RouteManager) AddBypassHost(ipStr string) error {
	ip := strings.TrimSpace(ipStr)
	if ip == "" || net.ParseIP(ip) == nil {
		return nil
	}

	rm.mu.Lock()
	defer rm.mu.Unlock()

	for _, added := range rm.AddedRoutes {
		if added == ip {
			return nil
		}
	}

	// route add <IP> mask 255.255.255.255 <OriginalGateway> metric 1
	out, err := runHiddenCmd("route", "add", ip, "mask", "255.255.255.255", rm.OriginalGateway, "metric", "1")
	if err != nil && !strings.Contains(out, "already exists") && !strings.Contains(out, "уже существует") {
		log.Printf("[ROUTE] Ошибка добавления обхода для %s: %s (%v)", ip, out, err)
		return err
	}
	rm.AddedRoutes = append(rm.AddedRoutes, ip)
	log.Printf("[ROUTE] Добавлен обход узла %s через %s", ip, rm.OriginalGateway)
	return nil
}

// AddBypassSubnet добавляет маршрут к подсети/CIDR через основной шлюз
func (rm *RouteManager) AddBypassSubnet(cidrStr string) error {
	cidrStr = strings.TrimSpace(cidrStr)
	if cidrStr == "" {
		return nil
	}
	if !strings.Contains(cidrStr, "/") {
		return rm.AddBypassHost(cidrStr)
	}

	ip, ipNet, err := net.ParseCIDR(cidrStr)
	if err != nil {
		return err
	}

	// Защита: не добавляем подсеть туннеля (10.70.0.0/16) в обход через физический роутер
	if ipNet.Contains(net.ParseIP("10.70.0.1")) || ipNet.Contains(net.ParseIP("10.70.66.1")) {
		log.Printf("[ROUTE] Пропуск подсети обхода %s (пересекается с VPN-подсетью 10.70.0.0/16)", cidrStr)
		return nil
	}

	rm.mu.Lock()
	defer rm.mu.Unlock()

	mask := net.IP(ipNet.Mask)
	maskStr := fmt.Sprintf("%d.%d.%d.%d", mask[0], mask[1], mask[2], mask[3])
	networkStr := ip.Mask(ipNet.Mask).String()

	for _, added := range rm.AddedRoutes {
		if added == networkStr {
			return nil
		}
	}

	out, err := runHiddenCmd("route", "add", networkStr, "mask", maskStr, rm.OriginalGateway, "metric", "1")
	if err != nil && !strings.Contains(out, "already exists") && !strings.Contains(out, "уже существует") {
		log.Printf("[ROUTE] Ошибка добавления обхода подсети %s: %s", cidrStr, out)
		return err
	}
	rm.AddedRoutes = append(rm.AddedRoutes, networkStr)
	log.Printf("[ROUTE] Добавлен обход подсети %s (%s) через %s", networkStr, maskStr, rm.OriginalGateway)
	return nil
}

// CleanupRoutes удаляет все добавленные туннельные и обходные маршруты
func (rm *RouteManager) CleanupRoutes() {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	runHiddenCmd("route", "delete", "0.0.0.0", "mask", "128.0.0.0")
	runHiddenCmd("route", "delete", "128.0.0.0", "mask", "128.0.0.0")

	for _, ip := range rm.AddedRoutes {
		runHiddenCmd("route", "delete", ip)
	}
	rm.AddedRoutes = nil
	_, _ = runHiddenCmd("ipconfig", "/flushdns")
	log.Println("[ROUTE] Все маршруты очищены")
}
