package tray

import (
	"fmt"
	"os"
	"runtime"
	"sync/atomic"
	"syscall"
	"unsafe"
)

var (
	user32   = syscall.NewLazyDLL("user32.dll")
	shell32  = syscall.NewLazyDLL("shell32.dll")
	kernel32 = syscall.NewLazyDLL("kernel32.dll")

	pRegisterClassExW    = user32.NewProc("RegisterClassExW")
	pCreateWindowExW     = user32.NewProc("CreateWindowExW")
	pDefWindowProcW      = user32.NewProc("DefWindowProcW")
	pGetMessageW         = user32.NewProc("GetMessageW")
	pTranslateMessage    = user32.NewProc("TranslateMessage")
	pDispatchMessageW    = user32.NewProc("DispatchMessageW")
	pPostQuitMessage     = user32.NewProc("PostQuitMessage")
	pCreatePopupMenu     = user32.NewProc("CreatePopupMenu")
	pAppendMenuW         = user32.NewProc("AppendMenuW")
	pTrackPopupMenu      = user32.NewProc("TrackPopupMenu")
	pSetForegroundWindow = user32.NewProc("SetForegroundWindow")
	pDestroyMenu         = user32.NewProc("DestroyMenu")
	pGetCursorPos        = user32.NewProc("GetCursorPos")
	pLoadIconW           = user32.NewProc("LoadIconW")
	pGetModuleHandleW    = kernel32.NewProc("GetModuleHandleW")
	pShell_NotifyIconW   = shell32.NewProc("Shell_NotifyIconW")
	pExtractIconExW      = shell32.NewProc("ExtractIconExW")
)

const (
	WM_USER          = 0x0400
	WM_TRAYICON      = WM_USER + 100
	WM_COMMAND       = 0x0111
	WM_LBUTTONUP     = 0x0202
	WM_LBUTTONDBLCLK = 0x0203
	WM_RBUTTONUP     = 0x0205

	NIM_ADD    = 0x00000000
	NIM_MODIFY = 0x00000001
	NIM_DELETE = 0x00000002

	NIF_MESSAGE = 0x00000001
	NIF_ICON    = 0x00000002
	NIF_TIP     = 0x00000004

	MF_STRING    = 0x00000000
	MF_GRAYED    = 0x00000001
	MF_DISABLED  = 0x00000002
	MF_SEPARATOR = 0x00000800

	TPM_BOTTOMALIGN = 0x0020
	TPM_LEFTALIGN   = 0x0000

	IDI_APPLICATION = 32512

	CMD_OPEN       = 1001
	CMD_CONNECT    = 1002
	CMD_DISCONNECT = 1003
	CMD_QUIT       = 1004
)

type POINT struct {
	X, Y int32
}

type WNDCLASSEXW struct {
	CbSize        uint32
	Style         uint32
	LpfnWndProc   uintptr
	CbClsExtra    int32
	CbWndExtra    int32
	HInstance     uintptr
	HIcon         uintptr
	HCursor       uintptr
	HbrBackground uintptr
	LpszMenuName  *uint16
	LpszClassName *uint16
	HIconSm       uintptr
}

type NOTIFYICONDATAW struct {
	CbSize           uint32
	HWnd             uintptr
	UID              uint32
	UFlags           uint32
	UCallbackMessage uint32
	HIcon            uintptr
	SzTip            [128]uint16
}

type MSG struct {
	HWnd    uintptr
	Message uint32
	WParam  uintptr
	LParam  uintptr
	Time    uint32
	Pt      POINT
}

var (
	trayHWnd       uintptr
	nid            NOTIFYICONDATAW
	onOpenCb       func()
	onConnectCb    func()
	onDisconnectCb func()
	onQuitCb       func()
	isConnected    atomic.Bool
)

// SetTrayConnected переключает состояние подключения для меню трея
func SetTrayConnected(connected bool) {
	isConnected.Store(connected)
}

// SetTrayTooltip обновляет всплывающую подсказку иконки
func SetTrayTooltip(tip string) {
	if trayHWnd == 0 {
		return
	}
	titleUTF16, _ := syscall.UTF16FromString(tip)
	var newNid NOTIFYICONDATAW
	newNid.CbSize = uint32(unsafe.Sizeof(NOTIFYICONDATAW{}))
	newNid.HWnd = trayHWnd
	newNid.UID = 1
	newNid.UFlags = NIF_TIP
	copy(newNid.SzTip[:], titleUTF16)
	pShell_NotifyIconW.Call(NIM_MODIFY, uintptr(unsafe.Pointer(&newNid)))
}

func wndProc(hWnd uintptr, msg uint32, wParam, lParam uintptr) uintptr {
	switch msg {
	case WM_TRAYICON:
		switch lParam {
		case WM_LBUTTONUP, WM_LBUTTONDBLCLK:
			if onOpenCb != nil {
				go onOpenCb()
			}
		case WM_RBUTTONUP:
			showContextMenu(hWnd)
		}
		return 0

	case WM_COMMAND:
		switch wParam & 0xFFFF {
		case CMD_OPEN:
			if onOpenCb != nil {
				go onOpenCb()
			}
		case CMD_CONNECT:
			if onConnectCb != nil {
				go onConnectCb()
			}
		case CMD_DISCONNECT:
			if onDisconnectCb != nil {
				go onDisconnectCb()
			}
		case CMD_QUIT:
			if onQuitCb != nil {
				go onQuitCb()
			}
		}
		return 0
	}

	ret, _, _ := pDefWindowProcW.Call(hWnd, uintptr(msg), wParam, lParam)
	return ret
}

func showContextMenu(hWnd uintptr) {
	hMenu, _, _ := pCreatePopupMenu.Call()
	if hMenu == 0 {
		return
	}
	defer pDestroyMenu.Call(hMenu)

	connected := isConnected.Load()

	titleOpen, _ := syscall.UTF16PtrFromString("Открыть Podlets WDTT")
	titleConnect, _ := syscall.UTF16PtrFromString("Подключиться")
	titleDisconnect, _ := syscall.UTF16PtrFromString("Отключиться")
	titleQuit, _ := syscall.UTF16PtrFromString("Выход")

	var connectFlags uintptr = MF_STRING
	var disconnectFlags uintptr = MF_STRING
	if connected {
		connectFlags |= MF_GRAYED | MF_DISABLED
	} else {
		disconnectFlags |= MF_GRAYED | MF_DISABLED
	}

	pAppendMenuW.Call(hMenu, MF_STRING, CMD_OPEN, uintptr(unsafe.Pointer(titleOpen)))
	pAppendMenuW.Call(hMenu, MF_SEPARATOR, 0, 0)
	pAppendMenuW.Call(hMenu, connectFlags, CMD_CONNECT, uintptr(unsafe.Pointer(titleConnect)))
	pAppendMenuW.Call(hMenu, disconnectFlags, CMD_DISCONNECT, uintptr(unsafe.Pointer(titleDisconnect)))
	pAppendMenuW.Call(hMenu, MF_SEPARATOR, 0, 0)
	pAppendMenuW.Call(hMenu, MF_STRING, CMD_QUIT, uintptr(unsafe.Pointer(titleQuit)))

	var pt POINT
	pGetCursorPos.Call(uintptr(unsafe.Pointer(&pt)))

	pSetForegroundWindow.Call(hWnd)
	pTrackPopupMenu.Call(hMenu, TPM_BOTTOMALIGN|TPM_LEFTALIGN, uintptr(pt.X), uintptr(pt.Y), 0, hWnd, 0)
}

// StartTray запускает системный трей в отдельной горутине Windows
func StartTray(title string, onOpen, onConnect, onDisconnect, onQuit func()) error {
	onOpenCb = onOpen
	onConnectCb = onConnect
	onDisconnectCb = onDisconnect
	onQuitCb = onQuit

	ready := make(chan error, 1)

	go func() {
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()

		hInstance, _, _ := pGetModuleHandleW.Call(0)
		className, _ := syscall.UTF16PtrFromString("PodletsWdttTrayClass")

		// Извлекаем иконку приложения прямо из запущенного podlets-wdtt.exe
		var hIcon uintptr
		if exePath, err := os.Executable(); err == nil {
			exePathW, _ := syscall.UTF16PtrFromString(exePath)
			var hIconLarge, hIconSmall uintptr
			ret, _, _ := pExtractIconExW.Call(
				uintptr(unsafe.Pointer(exePathW)),
				0,
				uintptr(unsafe.Pointer(&hIconLarge)),
				uintptr(unsafe.Pointer(&hIconSmall)),
				1,
			)
			if int32(ret) > 0 {
				if hIconSmall != 0 {
					hIcon = hIconSmall
				} else {
					hIcon = hIconLarge
				}
			}
		}

		if hIcon == 0 {
			hIcon, _, _ = pLoadIconW.Call(hInstance, uintptr(IDI_APPLICATION))
			if hIcon == 0 {
				hIcon, _, _ = pLoadIconW.Call(0, uintptr(IDI_APPLICATION))
			}
		}

		wndClass := WNDCLASSEXW{
			CbSize:        uint32(unsafe.Sizeof(WNDCLASSEXW{})),
			LpfnWndProc:   syscall.NewCallback(wndProc),
			HInstance:     hInstance,
			HIcon:         hIcon,
			LpszClassName: className,
		}

		ret, _, err := pRegisterClassExW.Call(uintptr(unsafe.Pointer(&wndClass)))
		if ret == 0 && err != syscall.Errno(0) {
			// Класс может уже быть зарегистрирован
		}

		hWnd, _, err := pCreateWindowExW.Call(
			0,
			uintptr(unsafe.Pointer(className)),
			uintptr(unsafe.Pointer(className)),
			0, 0, 0, 0, 0,
			0, 0, hInstance, 0,
		)
		if hWnd == 0 {
			ready <- fmt.Errorf("CreateWindowExW failed: %v", err)
			return
		}
		trayHWnd = hWnd

		// Инициализация Shell_NotifyIcon
		nid = NOTIFYICONDATAW{
			CbSize:           uint32(unsafe.Sizeof(NOTIFYICONDATAW{})),
			HWnd:             hWnd,
			UID:              1,
			UFlags:           NIF_ICON | NIF_MESSAGE | NIF_TIP,
			UCallbackMessage: WM_TRAYICON,
			HIcon:            hIcon,
		}

		titleUTF16, _ := syscall.UTF16FromString(title)
		copy(nid.SzTip[:], titleUTF16)

		pShell_NotifyIconW.Call(NIM_ADD, uintptr(unsafe.Pointer(&nid)))
		ready <- nil

		// Message loop
		var msg MSG
		for {
			r, _, _ := pGetMessageW.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
			if int32(r) <= 0 {
				break
			}
			pTranslateMessage.Call(uintptr(unsafe.Pointer(&msg)))
			pDispatchMessageW.Call(uintptr(unsafe.Pointer(&msg)))
		}

		pShell_NotifyIconW.Call(NIM_DELETE, uintptr(unsafe.Pointer(&nid)))
	}()

	return <-ready
}

// RemoveTray удаляет значок из системного трея
func RemoveTray() {
	if trayHWnd != 0 {
		pShell_NotifyIconW.Call(NIM_DELETE, uintptr(unsafe.Pointer(&nid)))
		pPostQuitMessage.Call(0)
		trayHWnd = 0
	}
}
