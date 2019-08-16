'use strict';

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
	let result = "";
	
	let lastBr;
	for (var part of subject.match(new RegExp("[A-Z]+=([^,\"]+|\"[^\"]+\")", "g"))) {
		parent.appendChild(document.createTextNode(part));
		lastBr = document.createElement("br");
		parent.appendChild(lastBr);
	}
	// remove trailing <br>
	if (lastBr) {
		parent.removeChild(lastBr);
	}
	
	return result;
}

function populateTable() {
	let table = document.getElementById("storageTable");
	
	// clear any old entries
	for (var i = 0; i < table.rows.length; i++) {
		var row = table.rows[i];
		if (row.getAttribute("class") != "header") {
			row.remove();
			i--;
		}
	}
	
	let certs = CW.Certificate.getAllFromStorage();
	let hosts = Object.keys(certs);
	
	let numSpan = document.getElementById("numDomains");
	numSpan.textContent = hosts.length;
	
	// sort by rightmost domain first
	hosts.sort((h1, h2) => {
		let h1p = h1.split(".");
		let h2p = h2.split(".");
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
	
	let size = [0, 0];
	
	for (var host of hosts) {
		let cert = certs[host];
		
		let certSize = cert.estimateSize();
		size[0] += certSize[0];
		size[1] += certSize[1];
		
		let tr = document.createElement("tr");
		
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
		td.textContent = convertDate(cert.validity.start);
		tr.appendChild(td);
		
		td = document.createElement("td");
		td.textContent = convertDate(cert.validity.end);
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
		let removeButton = document.createElement("input");
		removeButton.setAttribute("type", "button");
		removeButton.setAttribute("value", "Remove");
		removeButton.setAttribute("host", host);
		removeButton.addEventListener("click", removeEntry);
		td.appendChild(removeButton);
		tr.appendChild(td);
		
		table.appendChild(tr);
	}
	
	let sizeLower = document.getElementById("sizeLower");
	sizeLower.textContent = formatBytes(size[0]);
	let sizeUpper = document.getElementById("sizeUpper");
	sizeUpper.textContent = formatBytes(size[1]);
}

function updateTableFilter() {
	let domainFilter = document.getElementById("domainFilter");
	let storageTable = document.getElementById("storageTable");
	
	storageTable.childNodes.forEach((row) => {
		if (row.nodeName !== "TR") {
			return;
		}
		let td = row.firstChild;
		let domain = td.textContent;
		if (domain.indexOf(domainFilter.value) === -1) {
			row.style.display = "none";
		} else {
			row.style.display = "table-row";
		}
	});
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
	let certs = CW.Certificate.getAllFromStorage();
	for (var host in certs) {
		CW.Certificate.removeFromStorage(host);
	}
}

(function() {
	let removeAll = document.getElementById("removeAll");
	removeAll.addEventListener("click", function() {
		if (confirm("Really clear complete storage?")) {
			clearStorage();
			populateTable();
		}
	});
	
	let domainFilter = document.getElementById("domainFilter");
	domainFilter.value = ""; // clear after reload
	domainFilter.addEventListener("input", updateTableFilter);
})();


}); // CW getter
