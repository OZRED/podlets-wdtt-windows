package core

import (
	"encoding/json"
	"log"
	"math/rand"
	"os"
	"path/filepath"
	"sync"
)

// Profile holds consistent browser fingerprint headers for TLS+HTTP requests.
type Profile struct {
	UserAgent       string `json:"user_agent"`
	SecChUa         string `json:"sec_ch_ua"`
	SecChUaMobile   string `json:"sec_ch_ua_mobile"`
	SecChUaPlatform string `json:"sec_ch_ua_platform"`
}

// SavedProfile is a saved real browser profile loaded from disk.
type SavedProfile struct {
	Profile
	DeviceJSON string `json:"device_json"`
	BrowserFp  string `json:"browser_fp"`
}

const (
	profileFile          = "vk_profile.json"
	captchaBrowserFpFile = "captcha_browser_fp"
)

var (
	resDirMu     sync.RWMutex
	customResDir string
)

// SetResourcesDir задает путь к папке resources
func SetResourcesDir(dir string) {
	resDirMu.Lock()
	defer resDirMu.Unlock()
	customResDir = dir
}

func getResourcesDir() string {
	resDirMu.RLock()
	dir := customResDir
	resDirMu.RUnlock()

	if dir != "" {
		_ = os.MkdirAll(dir, 0755)
		return dir
	}

	execPath, err := os.Executable()
	baseDir := "."
	if err == nil {
		baseDir = filepath.Dir(execPath)
	}
	resDir := filepath.Join(baseDir, "resources")
	_ = os.MkdirAll(resDir, 0755)
	return resDir
}

func getProfilePath() string {
	resDir := getResourcesDir()
	target := filepath.Join(resDir, profileFile)

	// Бесшовный перенос: если файл существует в корне рядом с exe, переносим его в resources/
	if _, err := os.Stat(target); os.IsNotExist(err) {
		if execPath, err2 := os.Executable(); err2 == nil {
			oldPath := filepath.Join(filepath.Dir(execPath), profileFile)
			if data, readErr := os.ReadFile(oldPath); readErr == nil {
				if writeErr := os.WriteFile(target, data, 0644); writeErr == nil {
					_ = os.Remove(oldPath)
				}
			}
		}
	}
	return target
}

func getCaptchaBrowserFpPath() string {
	resDir := getResourcesDir()
	target := filepath.Join(resDir, captchaBrowserFpFile)

	// Бесшовный перенос: если файл существует в корне рядом с exe, переносим его в resources/
	if _, err := os.Stat(target); os.IsNotExist(err) {
		if execPath, err2 := os.Executable(); err2 == nil {
			oldPath := filepath.Join(filepath.Dir(execPath), captchaBrowserFpFile)
			if data, readErr := os.ReadFile(oldPath); readErr == nil {
				if writeErr := os.WriteFile(target, data, 0644); writeErr == nil {
					_ = os.Remove(oldPath)
				}
			}
		}
	}
	return target
}

func LoadProfileFromDisk() (*SavedProfile, error) {
	data, err := os.ReadFile(getProfilePath())
	if err != nil {
		return nil, err
	}
	var sp SavedProfile
	if err := json.Unmarshal(data, &sp); err != nil {
		return nil, err
	}
	return &sp, nil
}

// rotateCaptchaBrowserFP — полная ротация профиля капчи (fp + UA + device_json).
func rotateCaptchaBrowserFP() (*SavedProfile, error) {
	return rotateCaptchaProfile()
}

func rotateCaptchaProfile() (*SavedProfile, error) {
	fp, err := captchaV2BrowserFP()
	if err != nil {
		return nil, err
	}
	p := getRandomProfile()
	deviceJSON := captchaV2VariedDeviceJSON(captchaV2DeviceInfo)
	sp := &SavedProfile{
		Profile:    p,
		DeviceJSON: deviceJSON,
		BrowserFp:  fp,
	}
	data, err := json.Marshal(sp)
	if err != nil {
		return nil, err
	}
	if err := os.WriteFile(getProfilePath(), data, 0644); err != nil {
		return nil, err
	}
	if err := os.WriteFile(getCaptchaBrowserFpPath(), []byte(fp), 0644); err != nil {
		return nil, err
	}
	log.Printf("[КАПЧА] captcha profile rotated (fp=%s...)", fp[:8])
	return sp, nil
}

// profileList contains paired User-Agent and Client Hints strings.
var profileList = []Profile{
	// Windows Chrome
	{
		UserAgent:       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
		SecChUa:         `"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"`,
		SecChUaMobile:   "?0",
		SecChUaPlatform: `"Windows"`,
	},
	{
		UserAgent:       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
		SecChUa:         `"Chromium";v="145", "Not-A.Brand";v="99", "Google Chrome";v="145"`,
		SecChUaMobile:   "?0",
		SecChUaPlatform: `"Windows"`,
	},
	{
		UserAgent:       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
		SecChUa:         `"Chromium";v="144", "Not-A.Brand";v="8", "Google Chrome";v="144"`,
		SecChUaMobile:   "?0",
		SecChUaPlatform: `"Windows"`,
	},

	// Windows Edge
	{
		UserAgent:       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0",
		SecChUa:         `"Chromium";v="146", "Not-A.Brand";v="24", "Microsoft Edge";v="146"`,
		SecChUaMobile:   "?0",
		SecChUaPlatform: `"Windows"`,
	},
	{
		UserAgent:       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0",
		SecChUa:         `"Chromium";v="145", "Not-A.Brand";v="99", "Microsoft Edge";v="145"`,
		SecChUaMobile:   "?0",
		SecChUaPlatform: `"Windows"`,
	},

	// macOS Chrome
	{
		UserAgent:       "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
		SecChUa:         `"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"`,
		SecChUaMobile:   "?0",
		SecChUaPlatform: `"macOS"`,
	},
	{
		UserAgent:       "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
		SecChUa:         `"Chromium";v="145", "Not-A.Brand";v="99", "Google Chrome";v="145"`,
		SecChUaMobile:   "?0",
		SecChUaPlatform: `"macOS"`,
	},

	// Linux Chrome
	{
		UserAgent:       "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
		SecChUa:         `"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"`,
		SecChUaMobile:   "?0",
		SecChUaPlatform: `"Linux"`,
	},
	{
		UserAgent:       "Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
		SecChUa:         `"Chromium";v="144", "Not-A.Brand";v="8", "Google Chrome";v="144"`,
		SecChUaMobile:   "?0",
		SecChUaPlatform: `"Linux"`,
	},
}

// getRandomProfile returns a paired User-Agent and Client Hints profile.
func getRandomProfile() Profile {
	return profileList[rand.Intn(len(profileList))]
}
