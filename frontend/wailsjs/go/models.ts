export namespace config {
	
	export class AppSettings {
	    auto_connect: boolean;
	    close_to_tray: boolean;
	    default_dns: string;
	    default_obfs: string;
	    turn_transport: string;
	    default_workers: number;
	    bypass_routes: string;
	    vk_anon_path: string;
	    vk_auth_mode: string;
	
	    static createFrom(source: any = {}) {
	        return new AppSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.auto_connect = source["auto_connect"];
	        this.close_to_tray = source["close_to_tray"];
	        this.default_dns = source["default_dns"];
	        this.default_obfs = source["default_obfs"];
	        this.turn_transport = source["turn_transport"];
	        this.default_workers = source["default_workers"];
	        this.bypass_routes = source["bypass_routes"];
	        this.vk_anon_path = source["vk_anon_path"];
	        this.vk_auth_mode = source["vk_auth_mode"];
	    }
	}
	export class SubscriptionItem {
	    id: string;
	    name: string;
	    url: string;
	    description: string;
	    updated_at: string;
	    traffic_used_mb: number;
	    traffic_limit_mb: number;
	    version: number;
	
	    static createFrom(source: any = {}) {
	        return new SubscriptionItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.url = source["url"];
	        this.description = source["description"];
	        this.updated_at = source["updated_at"];
	        this.traffic_used_mb = source["traffic_used_mb"];
	        this.traffic_limit_mb = source["traffic_limit_mb"];
	        this.version = source["version"];
	    }
	}
	export class ConnectionProfile {
	    id: string;
	    name: string;
	    peer: string;
	    password: string;
	    vk_hashes: string;
	    workers: number;
	    port: number;
	    dns: string;
	    obfs: string;
	    mode: string;
	    group: string;
	    notes: string;
	    traffic_mb: number;
	    subscription_id?: string;
	    created_at: number;
	    updated_at: number;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.peer = source["peer"];
	        this.password = source["password"];
	        this.vk_hashes = source["vk_hashes"];
	        this.workers = source["workers"];
	        this.port = source["port"];
	        this.dns = source["dns"];
	        this.obfs = source["obfs"];
	        this.mode = source["mode"];
	        this.group = source["group"];
	        this.notes = source["notes"];
	        this.traffic_mb = source["traffic_mb"];
	        this.subscription_id = source["subscription_id"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class AppConfig {
	    active_profile_id: string;
	    profiles: ConnectionProfile[];
	    subscriptions: SubscriptionItem[];
	    settings: AppSettings;
	
	    static createFrom(source: any = {}) {
	        return new AppConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.active_profile_id = source["active_profile_id"];
	        this.profiles = this.convertValues(source["profiles"], ConnectionProfile);
	        this.subscriptions = this.convertValues(source["subscriptions"], SubscriptionItem);
	        this.settings = this.convertValues(source["settings"], AppSettings);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	

}

export namespace main {
	
	export class HashCheckResult {
	    index: number;
	    hash: string;
	    status: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new HashCheckResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.index = source["index"];
	        this.hash = source["hash"];
	        this.status = source["status"];
	        this.message = source["message"];
	    }
	}
	export class RemoteSubscription {
	    profiles: config.ConnectionProfile[];
	    subscription_name: string;
	    description: string;
	    traffic_used_mb: number;
	    traffic_limit_mb: number;
	    updated_at: string;
	    version: number;
	
	    static createFrom(source: any = {}) {
	        return new RemoteSubscription(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.profiles = this.convertValues(source["profiles"], config.ConnectionProfile);
	        this.subscription_name = source["subscription_name"];
	        this.description = source["description"];
	        this.traffic_used_mb = source["traffic_used_mb"];
	        this.traffic_limit_mb = source["traffic_limit_mb"];
	        this.updated_at = source["updated_at"];
	        this.version = source["version"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace vpn {
	
	export class TunnelStats {
	    state: string;
	    error_message: string;
	    bytes_up: number;
	    bytes_down: number;
	    speed_up: number;
	    speed_down: number;
	    ping_ms: number;
	    active_relays: number;
	    connected_at: number;
	
	    static createFrom(source: any = {}) {
	        return new TunnelStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.state = source["state"];
	        this.error_message = source["error_message"];
	        this.bytes_up = source["bytes_up"];
	        this.bytes_down = source["bytes_down"];
	        this.speed_up = source["speed_up"];
	        this.speed_down = source["speed_down"];
	        this.ping_ms = source["ping_ms"];
	        this.active_relays = source["active_relays"];
	        this.connected_at = source["connected_at"];
	    }
	}

}

