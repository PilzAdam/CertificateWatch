
const CertStatus = {
	ERROR: {
		text: "An internal error occured",
		precedence: 4,
		icon: "icons/cc_16_error.png",
	},

	CHANGED: {
		text: "Certificate differs from stored version",
		precedence: 3,
		icon: "icons/cc_16_changed.png",
	},
	TOFU: {
		text: "New certificate trusted on first use",
		precedence: 2,
		icon: "icons/cc_16_tofu.png",
	},
	STORED: {
		text: "All certificates known",
		precedence: 1,
		icon: "icons/cc_16_stored.png",
	},
	
	NONE: {
		text: "No TLS encrypted request has been made yet",
		precedence: 0,
		icon: "icons/cc_16.png",
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

function logDebug() {
	//var args = Array.prototype.slice.call(arguments);
	//args.unshift("[Certificate Checker] [Debug]");
	//console.log.apply(console, args);
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
		for (let field of ["fingerprint", "issuer", "serialNumber", "subject", "subjectPublicKeyInfoDigest"]) {
			if (cert[field] !== storedCert[field]) {
				changes[field] = {
					stored: storedCert[field],
					got: cert[field],
				}
			}
		}
		
		if (cert.validity.start !== storedCert.validity.start
				|| cert.validity.end !== storedCert.validity.end) {
			changes["validity"] = {
				stored: "start=" + convertDate(storedCert.validity.start) +", end=" + convertDate(storedCert.validity.end),
				got: "start=" + convertDate(cert.validity.start) +", end=" + convertDate(cert.validity.end),
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

async function onHeadersReceived(details) {
	const match = new RegExp("(https|wss)://([^/]+)").exec(details.url);
	const baseUrl = match[0];
	const host = match[2];
	
	if (details.tabId === -1) {
		logDebug("Request to", details.url, "not made in a tab", details);
		// TODO: what to do with requests not attached to tabs?
		return;
	}
	
	const securityInfo = await browser.webRequest.getSecurityInfo(details.requestId, {});
	
	if (securityInfo.state === "secure" || securityInfo.state === "weak") {
		const result = {
			status: CertStatus.ERROR,
			baseUrl: baseUrl,
			host: host,
		};
		await analyzeCert(host, securityInfo, result);
		
		logDebug(host, result.status.text);
		
		if (!tabs[details.tabId]) {
			// this shouldn't happen, but just in case create an empty tabAdded
			tabs[details.tabId] = {
				highestStatus: CertStatus.NONE,
				results: [],
			};
		}
		
		tabs[details.tabId].results.push(result);
		if (result.status.precedence > tabs[details.tabId].highestStatus.precedence) {
			tabs[details.tabId].highestStatus = result.status;
		}
		updateTabIcon(details.tabId);
	}
}

browser.webRequest.onHeadersReceived.addListener(
	onHeadersReceived,
	{urls: [
		"https://*/*",
		"wss://*/*"
	]},
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
		title: "Certificate Checker\n" + status.text,
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
