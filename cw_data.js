'use strict';

/*
 * A backgound script that holds the common data structures and state used
 * throughout all other scripts.
 * Access from non-background scripts via
 * (await browser.runtime.getBackgroundPage()).getCW()
 * or
 * browser.runtime.getBackgroundPage().then((bg) => {
 * const CW = bg.getCW();
 * 
 * //script content
 * 
 * });
 */

const CW = {};
// access for non-background scripts
function getCW() {
	return CW;
}

CW.CertStatus = class {
	//text;
	//precedence;
	//icon;
	
	constructor(text, precedence, icon) {
		this.text = text;
		this.precedence = precedence;
		this.icon = icon;
	}
};
CW.CERT_ERROR = new CW.CertStatus("An internal error occured", 4, "icons/cw_16_error.png");
CW.CERT_CHANGED = new CW.CertStatus("Certificate differs from stored version", 3, "icons/cw_16_changed.png");
CW.CERT_TOFU = new CW.CertStatus("New certificate trusted on first use", 2, "icons/cw_16_tofu.png");
CW.CERT_STORED = new CW.CertStatus("All certificates known", 1, "icons/cw_16_stored.png");
CW.CERT_NONE = new CW.CertStatus("No TLS encrypted request has been made yet", 0, "icons/cw_16.png");


CW.CheckResult = class {
	//host;
	//status = CW.CERT_ERROR;
	//if (status === CW.CERT_CHANGED)
	//    changes = {
	//        [key]: {stored: "", got: ""}
	//    };
	//    stored = <CW.Certificate>;
	//    got = <CW.Certificate>;
	
	constructor(host) {
		this.host = host;
		this.status = CW.CERT_ERROR;
	}
}


CW.Tab = class {
	//tabId;
	//results = [];
	//highestStatus = CW.CERT_NONE;
	//lastState = undefined;
	
	constructor(tabId) {
		this.tabId = tabId;
		this.results = [];
		this.highestStatus = CW.CERT_NONE;
	}
	
	static async getActiveTab() {
		let activeTabs = await browser.tabs.query({active: true, currentWindow: true});
		if (activeTabs.length === 0) {
			return;
		}
		let tabId = activeTabs[0].id;
		return CW.getTab(tabId);
	}
	
	addResult(/*CheckResult*/ result) {
		this.results.push(result);
		if (result.status.precedence > this.highestStatus.precedence) {
			this.highestStatus = result.status;
		}
	}
	
	clear() {
		this.results = [];
		this.highestStatus = CW.CERT_NONE;
	}
};

CW.tabs = {
	// [tabId]: Tab
};

CW.getTab = function(tabId) {
	if (CW.tabs[tabId]) {
		return CW.tabs[tabId];
	} else {
		let tab = new CW.Tab(tabId);
		CW.tabs[tabId] = tab;
		return tab;
	}
}

CW.Certificate = class {
	//subject;
	//issuer;
	//validity;
	//subjectPublicKeyInfoDigest;
	//serialNumber;
	//fingerprint;

	constructor(subject, issuer, validity, subjectPublicKeyInfoDigest, serialNumber, fingerprint) {
		this.subject = subject;
		this.issuer = issuer;
		this.validity = validity;
		this.subjectPublicKeyInfoDigest = subjectPublicKeyInfoDigest;
		this.serialNumber = serialNumber;
		this.fingerprint = fingerprint;
	}
	
	static fromBrowserCert(browserCert) {
		return new CW.Certificate(
			browserCert.subject,
			browserCert.issuer,
			browserCert.validity,
			browserCert.subjectPublicKeyInfoDigest.sha256,
			browserCert.serialNumber,
			browserCert.fingerprint.sha256
		);
	}
	
	static async fromStorage(host) {
		let stored = (await browser.storage.local.get(host))[host];
		
		if (stored) {
			return new CW.Certificate(
				stored.subject,
				stored.issuer,
				stored.validity,
				stored.subjectPublicKeyInfoDigest,
				stored.serialNumber,
				stored.fingerprint
			);
		}
	}
	
	async store(host) {
		await browser.storage.local.set({
			[host]: this
		});
	}
	
}
