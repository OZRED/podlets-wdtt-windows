package vpn

import (
	_ "embed"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"syscall"
)

//go:embed wintun_amd64.dll
var wintunAmd64 []byte

var (
	loadOnce sync.Once
	loadErr  error
)

// EnsureWintunLoaded гарантирует, что wintun.dll существует в resources/wintun.dll и загружен
func EnsureWintunLoaded() error {
	loadOnce.Do(func() {
		execPath, err := os.Executable()
		if err == nil {
			dir := filepath.Dir(execPath)
			resDir := filepath.Join(dir, "resources")
			resDll := filepath.Join(resDir, "wintun.dll")

			// 1. Проверяем наличие в resources/wintun.dll
			if _, statErr := os.Stat(resDll); statErr == nil {
				if _, lErr := syscall.LoadLibrary(resDll); lErr == nil {
					log.Printf("[WINTUN] Успешно загружен драйвер: %s", resDll)
					return
				}
			}

			// 2. Если файла нет в resources/wintun.dll — самовосстанавливаем его!
			_ = os.MkdirAll(resDir, 0755)
			if writeErr := os.WriteFile(resDll, wintunAmd64, 0644); writeErr == nil {
				log.Printf("[WINTUN] Драйвер автоматически восстановлен в: %s", resDll)
				if _, lErr := syscall.LoadLibrary(resDll); lErr == nil {
					log.Printf("[WINTUN] Успешно загружен восстановленный драйвер: %s", resDll)
					return
				}
			}

			// 3. Запасной вариант: проверяем в текущей папке рядом с exe
			rootDll := filepath.Join(dir, "wintun.dll")
			if _, statErr := os.Stat(rootDll); statErr == nil {
				if _, lErr := syscall.LoadLibrary(rootDll); lErr == nil {
					log.Printf("[WINTUN] Успешно загружен драйвер из корня: %s", rootDll)
					return
				}
			}
		}

		// 4. Проверяем системный PATH
		if _, lErr := syscall.LoadLibrary("wintun.dll"); lErr == nil {
			log.Printf("[WINTUN] Успешно загружен системный wintun.dll")
			return
		}

		loadErr = fmt.Errorf("не удалось загрузить wintun.dll")
		log.Printf("[WINTUN] Ошибка: %v", loadErr)
	})

	return loadErr
}

// CheckWintunAvailable проверяет доступность Wintun
func CheckWintunAvailable() bool {
	return EnsureWintunLoaded() == nil
}
