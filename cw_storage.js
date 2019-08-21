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

function populateTable() {
	const storageTable = document.getElementById("storageTable");

	// clear any old entries
	while (storageTable.firstChild) {
		storageTable.removeChild(storageTable.firstChild);
	}
	rows = [];

	const certs = CW.Certificate.getAllFromStorage();
	const hosts = Object.keys(certs);

	const numSpan = document.getElementById("numDomains");
	numSpan.textContent = hosts.length;

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

		const tr = document.createElement("tr");

		let td = document.createElement("td");
		td.textContent = host;
		tr.appendChild(td);

		td = document.createElement("td");
		addSubjectHtml(cert.subject, td);
		tr.appendChild(td);

		td = document.createElement("td");
		addSubjectHtml(cert.issuer, td);
		tr.appendChild(td);

		td = document.createElement("td");
		td.appendChild(document.createTextNode(convertDate(cert.validity.start)));
		td.appendChild(document.createElement("br"));
		td.appendChild(document.createTextNode("(" + timeDiffToToday(cert.validity.start) + ")"));
		if (new Date().getTime() < cert.validity.start) {
			td.style.color = "var(--color-red)";
		}
		tr.appendChild(td);

		td = document.createElement("td");
		td.appendChild(document.createTextNode(convertDate(cert.validity.end)));
		td.appendChild(document.createElement("br"));
		td.appendChild(document.createTextNode("(" + timeDiffToToday(cert.validity.end) + ")"));
		if (new Date().getTime() > cert.validity.end) {
			td.style.color = "var(--color-red)";
		}
		tr.appendChild(td);

		td = document.createElement("td");
		if (cert.lastSeen) {
			td.appendChild(document.createTextNode(convertDate(cert.lastSeen)));
			td.appendChild(document.createElement("br"));
			td.appendChild(document.createTextNode("(" + timeDiffToToday(cert.lastSeen) + ")"));
		} else {
			td.textContent = browser.i18n.getMessage("storageCertUnknown");
		}
		tr.appendChild(td);

		/*
		td = document.createElement("td");
		td.textContent = cert.serialNumber;
		tr.appendChild(td);

		td = document.createElement("td");
		td.textContent = cert.subjectPublicKeyInfoDigest;
		tr.appendChild(td);

		td = document.createElement("td");
		td.textContent = cert.fingerprint;
		tr.appendChild(td);
		*/

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

function updateTableFilter() {
	const domainFilter = document.getElementById("domainFilter");
	const storageTable = document.getElementById("storageTable");

	// remove all rows and then re-add the ones that match the filter
	// this way, :nth-child() selectors still work properly on the table rows

	while (storageTable.firstChild) {
		storageTable.removeChild(storageTable.firstChild);
	}

	for (const row of rows) {
		const domain = row.firstChild.textContent;
		if (domain.indexOf(domainFilter.value) !== -1) {
			storageTable.appendChild(row);
		}
	}
}

populateTable();

browser.runtime.onMessage.addListener((message) => {
	if (message.type === "storage.newHost") {
		// this event is sent when a new host appears
		populateTable();
		updateTableFilter();
	} else if (message.type === "storage.certChanged") {
		// this event is sent when an existing host certificate is updated
		populateTable();
		updateTableFilter();
	} else if (message.type === "storage.removedHost") {
		// this event is sent when an existing host is removed
		populateTable();
		updateTableFilter();
	}
});

function clearStorage() {
	CW.logInfo("Clearing all hosts");
	const certs = CW.Certificate.getAllFromStorage();
	for (const host of Object.keys(certs)) {
		CW.Certificate.removeFromStorage(host);
	}
}

(function() {
	const removeAll = document.getElementById("removeAll");
	removeAll.addEventListener("click", function() {
		if (confirm(browser.i18n.getMessage("storageRemoveAllConfirm"))) {
			clearStorage();
			populateTable();
		}
	});

	const domainFilter = document.getElementById("domainFilter");
	domainFilter.value = ""; // clear after reload
	domainFilter.addEventListener("input", updateTableFilter);
})();


}); // CW getter
