function removeEntry(event) {
	const host = event.target.getAttribute("host");
	if (host) {
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

	for (var host in certs) {
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
}

populateTable();
