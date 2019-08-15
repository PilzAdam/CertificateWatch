'use strict';

function removeEntry(event) {
	const host = event.target.getAttribute("host");
	if (host) {
		logInfo("Removing stored certificate for", host);
		browser.storage.local.remove(host).then(populateTable);
	}
}

// from https://stackoverflow.com/questions/6234773/can-i-escape-html-special-chars-in-javascript
function escapeHtml(unsafe) {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
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

function convertSubjectToHtml(str) {
	let result = "";
	
	for (var part of str.match(new RegExp("[A-Z]+=([^,\"]+|\"[^\"]+\")", "g"))) {
		result += escapeHtml(part) + "<br />";
	}
	
	return result;
}

async function populateTable() {
	let table = document.getElementById("storageTable");
	
	// clear any old entries
	for (var i = 0; i < table.rows.length; i++) {
		var row = table.rows[i];
		if (row.getAttribute("class") != "header") {
			row.remove();
			i--;
		}
	}
	
	let certs = await browser.storage.local.get();
	let hosts = Object.keys(certs);
	
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
	
	let num = 0;
	for (var host of hosts) {
		if (host === SETTING_KEY) {
			continue;
		}
		num++;
		let cert = certs[host];
		
		let tr = document.createElement("tr");
		
		let td = document.createElement("td");
		td.textContent = host;
		tr.appendChild(td);
		
		td = document.createElement("td");
		td.innerHTML = convertSubjectToHtml(cert.subject);
		tr.appendChild(td);
		
		td = document.createElement("td");
		td.innerHTML = convertSubjectToHtml(cert.issuer);
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
	
	let numSpan = document.getElementById("numDomains");
	numSpan.textContent = num;
}

populateTable();

async function clearStorage() {
	logInfo("Clearing all hosts");
	let certs = await browser.storage.local.get();
	let clearers = [];
	for (var host in certs) {
		if (host === SETTING_KEY) {
			continue;
		}
		clearers.push(browser.storage.local.remove(host));
	}
	await Promise.all(clearers);
}

(function() {
	let removeAll = document.getElementById("removeAll");
	removeAll.addEventListener("click", function() {
		if (confirm("Really clear complete storage?")) {
			clearStorage().then(populateTable);
		}
	});
	
	let domainFilter = document.getElementById("domainFilter");
	domainFilter.value = ""; // clear after reload
	domainFilter.addEventListener("input", function() {
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
	})
})();
