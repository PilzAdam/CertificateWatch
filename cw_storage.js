/*
 * Copyright 2019 PilzAdam
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";
/* global convertDate, timeDiffToToday, formatBytes */

/*
 * The script for the storage display page.
 */

browser.runtime.getBackgroundPage().then((bg) => {
const CW = bg.getCW();

function removeEntry(event) {
	const host = event.target.getAttribute("host");
	if (host) {
		CW.logInfo("Removing stored certificate for", host);
		CW.Certificate.removeFromStorage(host);
		// this generates an event that will trigger the update
	}
}

function addSubjectHtml(subject, parent) {
	const split = subject.match(new RegExp("[A-Z]+=([^,\"]+|\"[^\"]+\")", "g"));
	if (split) {
		// common format: CN=something.com, OU="Some Org Inc."
		// move each element of that to its own line, by adding <br /> tags
		let lastBr;
		for (const part of split) {
			parent.appendChild(document.createTextNode(part));
			lastBr = document.createElement("br");
			parent.appendChild(lastBr);
		}
		// remove trailing <br>
		if (lastBr) {
			parent.removeChild(lastBr);
		}

	} else {
		// if somehow the subject does not match the common format, just add
		// the subject content
		parent.appendChild(document.createTextNode(subject));
	}
}

let rows = [];

function updateTable() {
	const storageTable = document.getElementById("storageTable");
	const domainFilter = document.getElementById("domainFilter");

	// clear any old entries
	while (storageTable.firstChild) {
		storageTable.removeChild(storageTable.firstChild);
	}
	rows = [];

	const certs = CW.Certificate.getAllFromStorage();
	const hosts = Object.keys(certs);

	const numSpan = document.getElementById("numDomains");
	while (numSpan.firstChild) {
		numSpan.removeChild(numSpan.firstChild);
	}

	const numElement = document.createElement("b");
	numElement.textContent = hosts.length;
	if (hosts.length === 1) {
		addMessageNested(numSpan, "storageNumStoredDomains-single", numElement);
	} else {
		addMessageNested(numSpan, "storageNumStoredDomains-many", numElement);
	}

	// sort by rightmost domain first
	hosts.sort((h1, h2) => {
		const h1p = h1.split(".");
		const h2p = h2.split(".");
		let i1, i2;
		for (i1 = h1p.length, i2 = h2p.length; i1 >= 0 && i2 >= 0; i1--, i2--) {
			if (h1p[i1] !== h2p[i2]) {
				if (h1p[i1] < h2p[i2]) {
					return -1;
				} else {
					return 1;
				}
			}
		}
		if (i1 >= 0) {
			// h2 is shorter
			return 1;
		} else if (i2 >= 0) {
			// h1 is shorter
			return -1;
		} else {
			// equal
			return 0;
		}
	});

	const size = [0, 0];

	for (const host of hosts) {
		const cert = certs[host];

		const certSize = cert.estimateSize();
		size[0] += certSize[0];
		size[1] += certSize[1];

		if (host.indexOf(domainFilter.value) === -1) {
			continue;
		}

		const tr = document.createElement("tr");

		// host
		let td = document.createElement("td");
		td.textContent = host;
		tr.appendChild(td);

		// subject
		td = document.createElement("td");
		addSubjectHtml(cert.subject, td);
		tr.appendChild(td);

		// issuer
		td = document.createElement("td");
		addSubjectHtml(cert.issuer, td);
		tr.appendChild(td);

		// valid from
		td = document.createElement("td");
		td.appendChild(document.createTextNode(convertDate(cert.validity.start)));
		td.appendChild(document.createElement("br"));
		td.appendChild(document.createTextNode("(" + timeDiffToToday(cert.validity.start) + ")"));
		if (new Date().getTime() < cert.validity.start) {
			td.style.color = "var(--color-text-warning)";
		}
		tr.appendChild(td);

		// valid until
		td = document.createElement("td");
		td.appendChild(document.createTextNode(convertDate(cert.validity.end)));
		td.appendChild(document.createElement("br"));
		td.appendChild(document.createTextNode("(" + timeDiffToToday(cert.validity.end) + ")"));
		if (new Date().getTime() > cert.validity.end) {
			td.style.color = "var(--color-text-warning)";
		}
		tr.appendChild(td);

		// last seen
		td = document.createElement("td");
		if (cert.lastSeen) {
			td.appendChild(document.createTextNode(convertDate(cert.lastSeen)));
			td.appendChild(document.createElement("br"));
			td.appendChild(document.createTextNode("(" + timeDiffToToday(cert.lastSeen) + ")"));
		} else {
			td.textContent = browser.i18n.getMessage("storageCertUnknown");
		}
		tr.appendChild(td);

		// remove button
		td = document.createElement("td");
		td.setAttribute("class", "remove");
		const removeButton = document.createElement("input");
		removeButton.setAttribute("type", "button");
		removeButton.setAttribute("value", browser.i18n.getMessage("storageRemoveHost"));
		removeButton.setAttribute("host", host);
		removeButton.addEventListener("click", removeEntry);
		td.appendChild(removeButton);
		tr.appendChild(td);

		rows.push(tr);
		storageTable.appendChild(tr);
	}

	const storageSize = document.getElementById("storageSize");
	storageSize.textContent = browser.i18n.getMessage("storageSize", [formatBytes(size[0]), formatBytes(size[1])]);
}

browser.runtime.onMessage.addListener((message) => {
	if (message.type === "storage.newHost" ||
			message.type === "storage.certChanged" ||
			message.type === "storage.removedHost" ||
			message.type === "storage.initialized") {
		updateTable();
	}
});

function clearStorage() {
	CW.logInfo("Clearing all hosts");
	const certs = CW.Certificate.getAllFromStorage();
	for (const host of Object.keys(certs)) {
		CW.Certificate.removeFromStorage(host, false);
	}
}

(() => {
	const removeAll = document.getElementById("removeAll");
	removeAll.addEventListener("click", () => {
		if (confirm(browser.i18n.getMessage("storageRemoveAllConfirm"))) {
			clearStorage();
			updateTable();
		}
	});

	const domainFilter = document.getElementById("domainFilter");
	const param = new URL(document.location.href).searchParams.get("search");
	if (param) {
		domainFilter.value = param;
	}
	domainFilter.addEventListener("input", updateTable);

	const daySelection = document.getElementById("daySelection");
	const numDays = document.createElement("input");
	numDays.setAttribute("type", "number");
	numDays.setAttribute("class", "daysInput");
	numDays.setAttribute("id", "numDays");
	numDays.setAttribute("value", "30");
	numDays.setAttribute("min", "1");
	addMessageNested(daySelection, "storageDaySelection", numDays)

	const removeFct = (type) => {
		return () => {
			const days = numDays.value;
			let key = (type === "old") ? "storageRemoveOldConfirm" : "storageRemoveExpiredConfirm";
			if (confirm(browser.i18n.getMessage(key, [days]))) {
				CW.logInfo("Clearing", type, " certificates older than", days, "days");
				const certs = CW.Certificate.getAllFromStorage();
				for (const host of Object.keys(certs)) {
					let matches = false;
					if (type === "old") {
						const diff = numDaysToToday(certs[host].lastSeen);
						if (-diff >= days) {
							matches = true;
						}
					} else if (type === "expired") {
						const diff = numDaysToToday(certs[host].validity.end);
						if (-diff >= days) {
							matches = true;
						}
					}

					if (matches) {
						CW.Certificate.removeFromStorage(host, false);
					}
				}
				updateTable();
			}
		};
	};
	const removeOld = document.getElementById("removeOld");
	removeOld.addEventListener("click", removeFct("old"));
	const removeExpired = document.getElementById("removeExpired");
	removeExpired.addEventListener("click", removeFct("expired"));

	updateTable();
})();


}); // CW getter
