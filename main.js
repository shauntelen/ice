
/* =========================
   TAB FUNCTION
========================= */

function openTab(event, tabName) {

    let contents =
        document.querySelectorAll(".tab-content");

    let tabs =
        document.querySelectorAll(".tab");

    contents.forEach(function(content) {
        content.classList.remove("active");
    });

    tabs.forEach(function(tab) {
        tab.classList.remove("active");
    });

    document.getElementById(tabName)
        .classList.add("active");

    event.currentTarget.classList.add("active");
}


/* =========================
   EMERGENCY CONTACT
========================= */

function addEmergency() {

    let name =
        document.getElementById("emergency_name").value;

    let relationship =
        document.getElementById("emergency_relationship").value;

    let address =
        document.getElementById("emergency_address").value;

    let contact =
        document.getElementById("emergency_contact").value;

    if (name == "" ||
        relationship == "" ||
        address == "" ||
        contact == "") {

        alert("Please complete all emergency contact fields.");
        return;
    }

    let table =
        document.getElementById("emergencyTable");

    let row = table.insertRow();

    row.innerHTML = `
        <td>${name}</td>
        <td>${relationship}</td>
        <td>${address}</td>
        <td>${contact}</td>
        <td>
            <button type="button"
                    class="delete-btn"
                    onclick="this.parentElement.parentElement.remove()">
                Delete
            </button>
        </td>
    `;

    document.getElementById("emergency_name").value = "";
    document.getElementById("emergency_relationship").value = "";
    document.getElementById("emergency_address").value = "";
    document.getElementById("emergency_contact").value = "";
}


/* =========================
   DEPENDENT
========================= */

function addDependent() {

    let name =
        document.getElementById("dependent_name").value;

    let birth =
        document.getElementById("dependent_birth").value;

    let relationship =
        document.getElementById("dependent_relationship").value;

    if (name == "" ||
        birth == "" ||
        relationship == "") {

        alert("Please complete all dependent fields.");
        return;
    }

    let table =
        document.getElementById("dependentTable");

    let row = table.insertRow();

    row.innerHTML = `
        <td>${name}</td>
        <td>${birth}</td>
        <td>${relationship}</td>
        <td>
            <button type="button"
                    class="delete-btn"
                    onclick="this.parentElement.parentElement.remove()">
                Delete
            </button>
        </td>
    `;

    document.getElementById("dependent_name").value = "";
    document.getElementById("dependent_birth").value = "";
    document.getElementById("dependent_relationship").value = "";
}


/* =========================
   EDUCATION
========================= */

function addEducation() {

    let school =
        document.getElementById("school").value;

    let address =
        document.getElementById("school_address").value;

    let year =
        document.getElementById("school_year").value;

    let level =
        document.getElementById("education_level").value;

    if (school == "" ||
        address == "" ||
        year == "") {

        alert("Please complete all education fields.");
        return;
    }

    let table =
        document.getElementById("educationTable");

    let row = table.insertRow();

    row.innerHTML = `
        <td>${school}</td>
        <td>${address}</td>
        <td>${year}</td>
        <td>${level}</td>
        <td>
            <button type="button"
                    class="delete-btn"
                    onclick="this.parentElement.parentElement.remove()">
                Delete
            </button>
        </td>
    `;

    document.getElementById("school").value = "";
    document.getElementById("school_address").value = "";
    document.getElementById("school_year").value = "";
}


/* =========================
   CHARACTER REFERENCE
========================= */

function addReference() {

    let name =
        document.getElementById("reference_name").value;

    let occupation =
        document.getElementById("reference_occupation").value;

    let address =
        document.getElementById("reference_address").value;

    let contact =
        document.getElementById("reference_contact").value;

    if (name == "" ||
        occupation == "" ||
        address == "" ||
        contact == "") {

        alert("Please complete all reference fields.");
        return;
    }

    let table =
        document.getElementById("referenceTable");

    let row = table.insertRow();

    row.innerHTML = `
        <td>${name}</td>
        <td>${occupation}</td>
        <td>${address}</td>
        <td>${contact}</td>
        <td>
            <button type="button"
                    class="delete-btn"
                    onclick="this.parentElement.parentElement.remove()">
                Delete
            </button>
        </td>
    `;

    document.getElementById("reference_name").value = "";
    document.getElementById("reference_occupation").value = "";
    document.getElementById("reference_address").value = "";
    document.getElementById("reference_contact").value = "";
}


/* =========================
   NEW EMPLOYEE
========================= */

function newEmployee() {

    document.getElementById("employeeForm").reset();

    document.querySelectorAll("tbody").forEach(function(table) {
        table.innerHTML = "";
    });

    alert("New employee form ready.");
}


/* =========================
   CANCEL
========================= */

function cancelEmployee() {

    if (confirm("Clear all employee information?")) {

        document.getElementById("employeeForm").reset();

        document.querySelectorAll("tbody").forEach(function(table) {
            table.innerHTML = "";
        });

    }
}


/* =========================
   VIEW
========================= */

function viewEmployee() {

    alert("Employee records can be viewed from the employee list.");

}


/* =========================
   SAVE
========================= */

function saveEmployee() {

    alert("Employee information is ready to be saved.");

}
