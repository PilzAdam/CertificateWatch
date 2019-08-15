'use strict';

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
					b.textContent = "Subject";
				} else if (field === "issuer") {
					b.textContent = "Issuer";
				} else if (field === "validity") {
					b.textContent = "Validity";
				} else if (field === "subjectPublicKeyInfoDigest") {
					b.textContent = "Public Key";
				} else if (field === "fingerprint") {
					b.textContent = "Fingerprint";
				} else if (field === "serialNumber") {
					b.textContent = "Serial Number";
				} else {
					b.textContent = field;
				}
				nestedLi.appendChild(b);
				
				if (field === "subject" || field === "issuer" || field === "validity") {
					nestedLi.appendChild(document.createTextNode(" changed"));
					
					let table = document.createElement("table");
					let r1 = document.createElement("tr");
					let r2 = document.createElement("tr");
					let e11 = document.createElement("td");
					let e12 = document.createElement("td");
					let e21 = document.createElement("td");
					let e22 = document.createElement("td");
					
					e11.textContent = "stored:";
					e12.textContent = result.changes[field].stored;
					e12.style.color = "blue";
					
					e21.textContent = "new:";
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
					nestedLi.appendChild(document.createTextNode(" changed"));
				}
				
				ul.appendChild(nestedLi);
			}
			li.appendChild(ul);
			
			let button = document.createElement("input");
			button.setAttribute("type", "button");
			button.setAttribute("value", "Store This New Certificate");
			button.addEventListener("click", function() {
				button.disabled = true;
				button.setAttribute("value", "Storing...");
				logInfo("Storing new certificate for", result.host);
				
				let newCert = result.got;
				browser.storage.local.set({
					[result.host]: newCert
				}).then(() => {
					button.setAttribute("value", "Stored New Certificate");
				});
			});
			li.appendChild(button);
		}
	} else {
		logDebug("Got result that has no known type", result);
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
			logDebug("got cleared message");
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
