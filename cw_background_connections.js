'use strict';

/*
 * Background script that intercepts and checks all TLS connections.
 */

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
					CW.logDebug("Ignoring domain", host, "because it matches", filter);
					return true;
				}
			}
		}
	}

	return false;
}

function analyzeCert(host, securityInfo, result) {
	if (!securityInfo.certificates || securityInfo.certificates.length !== 1) {
		result.status = CW.CERT_ERROR;
		return;
	}

	const cert = CW.Certificate.fromBrowserCert(securityInfo.certificates[0]);
	const storedCert = CW.Certificate.fromStorage(host);

	if (!storedCert) {
		result.status = CW.CERT_TOFU;
		cert.store(host);

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
			result.status = CW.CERT_CHANGED;
			result.changes = changes;
			result.stored = storedCert;
			result.got = cert;

		} else {
			result.status = CW.CERT_STORED;
		}
	}
}

async function checkConnection(url, securityInfo, tabId) {
	if (CW.enabled === false) {
		return;
	}

	const match = new RegExp("(https|wss)://([^/]+)").exec(url);
	//const baseUrl = match[0];
	const host = match[2];

	if (tabId === -1) {
		CW.logDebug("Request to", url, "not made in a tab");
		// TODO: what to do with requests not attached to tabs?
		return;
	}

	const certChecksSetting = CW.getSetting("certChecks");
	if (certChecksSetting === "domain") {
		const tab = await browser.tabs.get(tabId);
		const tabHost = new RegExp("://([^/]+)").exec(tab.url)[1];
		if (host !== tabHost) {
			CW.logDebug("Ignoring request to", host, "from tab with host", tabHost,
					"(setting is", certChecksSetting, ")");
			return;
		}
	}

	const ignoredDomains = CW.getSetting("ignoredDomains", []);
	if (isIgnoredDomain(host, ignoredDomains)) {
		return;
	}

	if (securityInfo.state === "secure" || securityInfo.state === "weak") {
		const result = new CW.CheckResult(host);
		await analyzeCert(host, securityInfo, result);

		CW.logDebug(host, result.status.text);

		let tab = CW.getTab(tabId);
		tab.addResult(result);
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
