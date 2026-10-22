package main

import (
	"context"
	"embed"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"podlets-wdtt/tray"
	"podlets-wdtt/vpn"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()

	userDataDir := filepath.Join(os.Getenv("LOCALAPPDATA"), "PodletsWDTT", "webview")
	_ = os.MkdirAll(userDataDir, 0755)

	err := wails.Run(&options.App{
		Title:     "Podlets WDTT",
		Width:     840,
		Height:    580,
		MinWidth:  780,
		MinHeight: 520,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 2, G: 6, B: 23, A: 1}, // slate-950
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)

			// Инициализируем значок в системном трее Windows
			_ = tray.StartTray("Podlets WDTT",
				func() {
					runtime.WindowShow(ctx)
					runtime.WindowUnminimise(ctx)
				},
				func() {
					// Клик "Подключиться" в трее
					go func() {
						cfg, err := app.GetConfig()
						if err == nil && len(cfg.Profiles) > 0 {
							_ = app.Connect(cfg.Profiles[0].ID)
						}
					}()
				},
				func() {
					// Клик "Отключиться" в трее
					go func() {
						_ = app.Disconnect()
					}()
				},
				func() {
					_ = app.Disconnect()
					tray.RemoveTray()
					vpn.CleanupWintunAdapter()
					runtime.Quit(ctx)
				},
			)
		},
		OnBeforeClose: func(ctx context.Context) bool {
			// Если включено "Сворачивать в трей при закрытии"
			if app.cfg != nil && app.cfg.Settings.CloseToTray {
				runtime.WindowHide(ctx)
				return true // окно скрывается, трей остаётся
			}
			tray.RemoveTray()
			vpn.CleanupWintunAdapter()
			return false // нормальный выход
		},
		OnShutdown: func(ctx context.Context) {
			tray.RemoveTray()
			_ = app.Disconnect()
			vpn.CleanupWintunAdapter()
		},
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId: "podlets-wdtt-single-instance-lock",
			OnSecondInstanceLaunch: func(data options.SecondInstanceData) {
				if app.ctx != nil {
					runtime.WindowShow(app.ctx)
					runtime.WindowUnminimise(app.ctx)
				}
			},
		},
		Windows: &windows.Options{
			WebviewUserDataPath: userDataDir,
			Theme:               windows.Dark,
		},
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
