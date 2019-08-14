/*
 * The main background script.
 * - Intercepts all HTTPS network requests and examines the certificates.
 * - Sets the browserAction icons for the tabs.
 * - Contains the tabs state (this accessed by other scripts).
 */

const CertStatus = {
	ERROR: {
		text: "An internal error occured",
		precedence: 4,
		icon: "icons/cw_16_error.png",
	},

	CHANGED: {
		text: "Certificate differs from stored version",
		precedence: 3,
		icon: "icons/cw_16_changed.png",
	},
	TOFU: {
		text: "New certificate trusted on first use",
		precedence: 2,
		icon: "icons/cw_16_tofu.png",
	},
	STORED: {
		text: "All certificates known",
		precedence: 1,
		icon: "icons/cw_16_stored.png",
	},
	
	NONE: {
		text: "No TLS encrypted request has been made yet",
		precedence: 0,
		icon: "icons/cw_16.png",
	},
}
// make this enum unmodifiable
Object.freeze(CertStatus);
for (var element in CertStatus) {
	Object.freeze(element);
}

const tabs = {};

// access for popup script
function getTabs() {
	return tabs;
}
function getCertStati() {
	return CertStatus;
}

function convertCert(browserCert) {
	return {
		fingerprint: browserCert.fingerprint.sha256,
		issuer: browserCert.issuer,
		serialNumber: browserCert.serialNumber,
		subject: browserCert.subject,
		subjectPublicKeyInfoDigest: browserCert.subjectPublicKeyInfoDigest.sha256,
		validity: browserCert.validity,
	};
}

function convertDate(unix){
	var date = new Date(unix);
	return date.getFullYear() + "-"
			+ date.getMonth().toString().padStart(2, "0")
			+ "-" + date.getDate().toString().padStart(2, "0")
			+ " " + date.getHours().toString().padStart(2, "0")
			+ ":" + date.getMinutes().toString().padStart(2, "0")
			+ ":" + date.getSeconds().toString().padStart(2, "0");
}

function isIgnoredDomain(host, ignoredDomains) {
	let hostParts = host.split(".");
	for (let filter of ignoredDomains) {
		filter = filter.trim();
		if (filter.length > 0) {
			let filterParts = filter.split(".");
			if (filterParts.length === hostParts.length) {
				let match = true;
				for (let i = 0; i < filterParts.length; i++) {
					if (filterParts[i] !== "*" && filterParts[i] !== hostParts[i]) {
						match = false;
						break;
					}
				}
				
				if (match) {
					logDebug("Ignoring domain", host, "because it matches", filter);
					return true;
				}
			}
		}
	}
	
	return false;
}

async function analyzeCert(host, securityInfo, result) {
	if (!securityInfo.certificates || securityInfo.certificates.length !== 1) {
		result.status = CertStatus.ERROR;
		return;
	}
	
	const cert = convertCert(securityInfo.certificates[0]);
	const storedCert = (await browser.storage.local.get(host))[host];
	
	if (!storedCert) {
		result.status = CertStatus.TOFU;
		
		browser.storage.local.set({
			[host]: cert
		});

	} else {
		let changes = {};
		// fields are roughly sorted by importance
		for (let field of ["subject", "issuer", "validity", "subjectPublicKeyInfoDigest", "serialNumber", "fingerprint"]) {
			if (field === "validity") {
				// validity needs extra comparison logic
				if (cert.validity.start !== storedCert.validity.start
						|| cert.validity.end !== storedCert.validity.end) {
					changes["validity"] = {
						stored: "start: " + convertDate(storedCert.validity.start) +", end: " + convertDate(storedCert.validity.end),
						got: "start: " + convertDate(cert.validity.start) +", end: " + convertDate(cert.validity.end),
					}
				}
			} else {
				if (cert[field] !== storedCert[field]) {
					changes[field] = {
						stored: storedCert[field],
						got: cert[field],
					}
				}
			}
		}
		
		if (Object.keys(changes).length > 0) {
			result.status = CertStatus.CHANGED;
			result.changes = changes;
			result.stored = storedCert;
			result.got = cert;
			
		} else {
			result.status = CertStatus.STORED;
		}
	}
}

async function checkConnection(url, securityInfo, tabId) {
	const match = new RegExp("(https|wss)://([^/]+)").exec(url);
	const baseUrl = match[0];
	const host = match[2];
	
	if (tabId === -1) {
		logDebug("Request to", url, "not made in a tab");
		// TODO: what to do with requests not attached to tabs?
		return;
	}
	
	const certChecksSetting = await getSetting("certChecks");
	if (certChecksSetting === "domain") {
		const tab = await browser.tabs.get(tabId);
		const tabHost = new RegExp("://([^/]+)").exec(tab.url)[1];
		if (host !== tabHost) {
			logDebug("Ignoring request to", host, "from tab with host", tabHost,
					"(setting is", certChecksSetting, ")");
			return;
		}
	}
	
	const ignoredDomains = await getSetting("ignoredDomains", []);
	if (isIgnoredDomain(host, ignoredDomains)) {
		return;
	}
	
	if (securityInfo.state === "secure" || securityInfo.state === "weak") {
		const result = {
			status: CertStatus.ERROR,
			baseUrl: baseUrl,
			host: host,
		};
		await analyzeCert(host, securityInfo, result);
		
		logDebug(host, result.status.text);
		
		if (!tabs[tabId]) {
			// this shouldn't happen, but just in case create an empty tabAdded
			tabs[tabId] = {
				highestStatus: CertStatus.NONE,
				results: [],
			};
		}
		
		tabs[tabId].results.push(result);
		if (result.status.precedence > tabs[tabId].highestStatus.precedence) {
			tabs[tabId].highestStatus = result.status;
		}
		updateTabIcon(tabId);
	}
}

async function onHeadersReceived(details) {
	// only query securityInfo and then quickly return
	// checkConnection() is executed async
	// this makes blocking the request as short as possible
	const securityInfo = await browser.webRequest.getSecurityInfo(details.requestId, {});
	checkConnection(details.url, securityInfo, details.tabId);
	return;
}

browser.webRequest.onHeadersReceived.addListener(
	onHeadersReceived,
	{urls: [
		"https://*/*",
		"wss://*/*"
	]},
	// we have to set the option "blocking" for browser.webRequest.getSecurityInfo
	["blocking"]
);

function updateTabIcon(tabId) {
	if (!tabs[tabId] || !tabs[tabId].highestStatus) {
		return;
	}
	
	let status = tabs[tabId].highestStatus;
	browser.browserAction.setIcon({
		tabId: tabId,
		path: {
			16: status.icon,
		}
	});
	browser.browserAction.setTitle({
		tabId: tabId,
		title: "Certificate Watch\n" + status.text,
	});
}

function tabAdded(tab) {
	tabs[tab.id] = {
		highestStatus: CertStatus.NONE,
		results: [],
	};
}
browser.tabs.onCreated.addListener(tabAdded);

function tabRemoved(tabId) {
	delete tabs[tabId];
}
browser.tabs.onRemoved.addListener(tabRemoved);

function tabUpdated(tabId, changeInfo, tab) {
	if (!tabs[tabId]) {
		tabs[tabId] = {
			highestStatus: CertStatus.NONE,
			results: [],
		};
	}

	if (changeInfo.status === "loading") {
		// only use the first "loading" state until the next complete comes through
		// this is because there is another "loading" event when the first request went through
		if (!tabs[tabId].lastState || tabs[tabId].lastState === "complete") {
			logDebug("Clearing tab", tabId);
			tabs[tabId] = {
				highestStatus: CertStatus.NONE,
				results: [],
			};
			updateTabIcon(tabId);
		}
		tabs[tabId].lastState = "loading";
		
	} else if (changeInfo.status === "complete") {
		tabs[tabId].lastState = "complete";
	}
}
browser.tabs.onUpdated.addListener(tabUpdated);

// migrate from old settings key
(function() {
	const oldSettingsKey = "certificate_checker:settings";
	browser.storage.local.get(oldSettingsKey).then(
		(result) => {
			let oldSettings = result[oldSettingsKey];
			if (oldSettings) {
				// we found old settings, delete and store as new one
				browser.storage.local.set({[SETTING_KEY]: oldSettings});
				browser.storage.local.remove(oldSettingsKey);
				logInfo("Migrated old storage");
			}
		}
	);
})();
