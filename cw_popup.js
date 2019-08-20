'use strict';

/*
 * The script for the browser action popup.
 */

browser.runtime.getBackgroundPage().then((bg) => {
const CW = bg.getCW();

const changed = new Set();
const tofu = new Set();
const stored = new Set();

function addResult(result) {
	function insertToList(listId, host) {
		let list = document.getElementById(listId);
		let li = document.createElement("li");
		li.textContent = host;
		list.appendChild(li);
	}

	if (result.status === CW.CERT_TOFU) {
		if (!tofu.has(result.host)) {
			tofu.add(result.host);
			insertToList("tofuList", result.host);
		}
	} else if (result.status === CW.CERT_STORED) {
		// there may be the case that a TOFU certificate was re-used in a later connection
		// because of this, we remove it from stored UI since it is new for this "page"
		if (!stored.has(result.host) && !tofu.has(result.host)) {
			stored.add(result.host);
			insertToList("storedList", result.host);
		}
	} else if (result.status === CW.CERT_CHANGED) {
		if (!changed.has(result.host)) {
			changed.add(result.host);

			let list = document.getElementById("changedList");
			let li = document.createElement("li");
			li.textContent = result.host;
			list.appendChild(li);

			let ul = document.createElement("ul");
			for (var field in result.changes) {
				let nestedLi = document.createElement("li");
				let b = document.createElement("b");
				if (field === "subject") {
					b.textContent = browser.i18n.getMessage("popupChangedFieldSubject");
				} else if (field === "issuer") {
					b.textContent = browser.i18n.getMessage("popupChangedFieldIssuer");
				} else if (field === "validity") {
					b.textContent = browser.i18n.getMessage("popupChangedFieldValidity")
				} else if (field === "subjectPublicKeyInfoDigest") {
					b.textContent = browser.i18n.getMessage("popupChangedFieldPublicKey");
				} else if (field === "fingerprint") {
					b.textContent = browser.i18n.getMessage("popupChangedFieldFingerprint")
				} else if (field === "serialNumber") {
					b.textContent = browser.i18n.getMessage("popupChangedFieldSerialNumber");
				} else {
					b.textContent = field;
				}
				nestedLi.appendChild(b);

				if (field === "subject" || field === "issuer" || field === "validity") {
					nestedLi.appendChild(document.createTextNode(" " + browser.i18n.getMessage("popupChanged")));

					let table = document.createElement("table");
					let r1 = document.createElement("tr");
					let r2 = document.createElement("tr");
					let e11 = document.createElement("td");
					let e12 = document.createElement("td");
					let e21 = document.createElement("td");
					let e22 = document.createElement("td");

					e11.textContent = browser.i18n.getMessage("popupChangedStored");
					e12.textContent = result.changes[field].stored;
					e12.style.color = "blue";

					e21.textContent = browser.i18n.getMessage("popupChangedNew");
					e22.textContent = result.changes[field].got;
					e22.style.color = "orange";

					r1.appendChild(e11);
					r1.appendChild(e12);
					r2.appendChild(e21);
					r2.appendChild(e22);
					table.appendChild(r1);
					table.appendChild(r2);
					nestedLi.appendChild(table);
				} else {
					nestedLi.appendChild(document.createTextNode(" " + browser.i18n.getMessage("popupChanged")));
				}

				ul.appendChild(nestedLi);
			}
			li.appendChild(ul);

			let button = document.createElement("input");
			button.setAttribute("type", "button");
			button.setAttribute("value", browser.i18n.getMessage("popupAddChanged"));
			button.addEventListener("click", function() {
				button.disabled = true;
				CW.logInfo("Storing new certificate for", result.host);

				result.got.store(result.host);

				button.setAttribute("value", browser.i18n.getMessage("popupAddedChanged"));
			});
			li.appendChild(button);
		}
	} else {
		CW.logDebug("Got result that has no known type", result);
	}
}

function updateCounts() {
	document.getElementById("numChanged").textContent = changed.size;
	document.getElementById("numTofu").textContent = tofu.size;
	document.getElementById("numStored").textContent = stored.size;
}

function clearResults() {
	for (let name of ["tofuList", "storedList", "changedList"]) {
		let list = document.getElementById(name);
		while (list.firstChild) {
			list.removeChild(list.firstChild);
		}
	}
}

async function init() {
	let settingsLink = document.getElementById("settingsLink");
	settingsLink.addEventListener("click", function(event) {
		browser.runtime.openOptionsPage();
	});

	let storageLink = document.getElementById("storageLink");
	storageLink.addEventListener("click", function(event) {
		browser.tabs.create({
			active: true,
			url: "cw_storage.html"
		});
	});

	let state = document.getElementById("state");
	function updateStateText() {
		if (CW.enabled) {
			state.setAttribute("value", browser.i18n.getMessage("popupStateEnabled"));
			state.style.color = "";
			state.setAttribute("title", browser.i18n.getMessage("popupStateEnabledTooltip"));
		} else {
			state.setAttribute("value", browser.i18n.getMessage("popupStateDisabled"));
			state.style.color = "var(--color-red)";
			state.setAttribute("title", browser.i18n.getMessage("popupStateDisabledTooltip"));
		}
	}
	updateStateText();
	state.addEventListener("click", function(event) {
		event.preventDefault();
		CW.toggleEnabled();
		updateStateText();
	});

	let currentTab = await CW.Tab.getActiveTab();
	if (!currentTab) {
		return;
	}

	for (let result of currentTab.results) {
		addResult(result);
	}
	updateCounts();

	browser.runtime.onMessage.addListener((message) => {
		if (message.type === "tab.newResult" && message.tabId === currentTab.tabId) {
			addResult(currentTab.results[message.resultIndex]);
			updateCounts();
		} else if (message.type === "tab.resultsCleared" && message.tabId === currentTab.tabId) {
			changed.clear();
			tofu.clear();
			stored.clear();

			clearResults();
			updateCounts();
		}
	});
}
init();

}); // CW getter
