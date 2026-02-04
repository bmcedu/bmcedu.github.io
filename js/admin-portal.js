// Admin Portal JS File

document.addEventListener('DOMContentLoaded', function () {
    // Check if logged in as admin
    if (sessionStorage.getItem('isAdminLoggedIn') !== 'true') {
        window.location.href = 'admin-login';
        return;
    }

    // --- Admin Info ---
    const adminId = sessionStorage.getItem('adminId') || '';
    const adminName = sessionStorage.getItem('adminName') || 'المسؤول';
    const adminEmail = sessionStorage.getItem('adminEmail') || '';
    const adminPhone = sessionStorage.getItem('adminPhone') || '';

    // Set Dashboard Title
    const dashboardTitle = document.getElementById('dashboardTitle');
    if (dashboardTitle) {
        dashboardTitle.textContent = `أهلاً وسهلاً بك، ${adminName}`;
    }



    // --- Logout ---
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            sessionStorage.removeItem('isAdminLoggedIn');
            sessionStorage.removeItem('adminId');
            sessionStorage.removeItem('adminName');
            sessionStorage.removeItem('adminEmail');
            sessionStorage.removeItem('adminPhone');
            window.location.href = 'admin-login';
        });
    }

    // --- Load All Excuses ---
    loadAllExcuses();
});

// Global storage for lookups
let coursesLookup = {};
let reasonsLookup = {};
let allExcuses = [];
let filteredExcuses = []; // Stores filtered data
let currentPage = 1;
const itemsPerPage = 8;

/**
 * Load all excuses from the backend
 */
function loadAllExcuses() {
    const scriptUrl = typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '';
    if (!scriptUrl) {
        console.error('CONFIG.SCRIPT_URL not found');
        return;
    }

    const tableBody = document.getElementById('requestsTableBody');
    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="100" class="text-center py-5 text-muted">
                    <i class="hgi hgi-stroke hgi-standard hgi-loading-03 hgi-spin me-2"></i>جاري تحميل الأعذار...
                </td>
            </tr>
        `;
    }

    // Fetch lookups first, then excuses
    Promise.all([
        fetchLookupData('get_courses', 'courses'),
        fetchLookupData('get_reasons', 'reasons'),
        fetchLookupData('get_all_students', 'students') // Fetch full student list
    ]).then(() => {
        // Now fetch excuses
        const payload = { action: 'get_all_excuses' };

        fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify(payload)
        })
            .then(response => {
                return response.json();
            })
            .then(data => {
                allExcuses = Array.isArray(data) ? data : [];

                // Handle error response from backend
                if (data && data.status === 'error') {
                    console.error('Backend returned error:', data.message);
                    allExcuses = []; // Ensure empty array on error
                }

                filteredExcuses = [...allExcuses]; // Initialize filtered with all
                currentPage = 1;

                // Extract dynamic filter options
                extractFilterOptions();

                renderExcusesTable();
            })
            .catch(error => {
                console.error('Error loading excuses:', error);
                if (tableBody) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="100" class="text-center py-5 text-danger">
                                <i class="hgi-stroke hgi-standard hgi-alert-circle fs-1 mb-2"></i>
                                <p>حدث خطأ أثناء تحميل الأعذار</p>
                            </td>
                        </tr>
                    `;
                }
            });
    }).catch(err => {
        console.error('Error in lookup promises:', err);
    });
}

// Global storage for full student list
let allStudentsList = [];

/**
 * Fetch lookup data (courses/reasons/students)
 */
function fetchLookupData(action, key) {
    const scriptUrl = typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '';
    return fetch(scriptUrl, {
        method: 'POST',
        body: JSON.stringify({ action: action })
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                if (key === 'courses' && data.courses) {
                    data.courses.forEach(c => { coursesLookup[String(c.id)] = c.name; });
                }
                if (key === 'reasons' && data.reasons) {
                    data.reasons.forEach(r => { reasonsLookup[String(r.id)] = r.name; });
                }
                if (key === 'students' && data.students) {
                    allStudentsList = data.students || []; // Store full student list
                }
            }
        })
        .catch(err => console.error(`Error fetching ${key}:`, err));
}

/**
 * Extract Filter Options from Data
 */
function extractFilterOptions() {
    // --- Course Dropdown (Custom Searchable) ---
    const courseDropdownList = document.getElementById('courseDropdownList');
    if (courseDropdownList) {
        // Use global coursesLookup to get ALL courses
        const allCourses = Object.values(coursesLookup).sort();

        // Fallback to extracting from excuses if lookup is empty
        let coursesToDisplay = allCourses;
        if (coursesToDisplay.length === 0) {
            const uniqueCourses = new Set();
            allExcuses.forEach(item => {
                if (item.course_name) uniqueCourses.add(item.course_name.trim());
            });
            coursesToDisplay = [...uniqueCourses].sort();
        }

        // Populate Dropdown List
        let listHtml = `<div class="dropdown-item p-2 cursor-pointer text-muted small" data-value="">الكل</div>`;
        coursesToDisplay.forEach(course => {
            listHtml += `<div class="dropdown-item p-2 cursor-pointer text-wrap" style="color: inherit;" data-value="${course}">${course}</div>`;
        });
        courseDropdownList.innerHTML = listHtml;

        setupSearchableCourseDropdown();
    }

    // --- Student Names Dropdown (Custom Searchable) ---
    const dropdownList = document.getElementById('studentNameDropdownList');
    if (dropdownList) {
        // Merge excused students with full student list
        const uniqueNames = new Map();

        // 1. Add students from the master list (id, name)
        allStudentsList.forEach(s => {
            if (s.name) uniqueNames.set(s.name.trim(), s.name.trim());
        });

        // 2. Add students from excuses
        allExcuses.forEach(item => {
            if (item.student_name) uniqueNames.set(item.student_name.trim(), item.student_name.trim());
        });

        const sortedNames = [...uniqueNames.values()].sort();
        console.log('[Debug] Found', sortedNames.length, 'unique student names');

        // Populate Dropdown List
        let listHtml = `<div class="dropdown-item p-2 cursor-pointer text-muted small" data-value="">الكل</div>`;
        sortedNames.forEach(name => {
            listHtml += `<div class="dropdown-item p-2 cursor-pointer text-wrap" style="color: inherit;" data-value="${name}">${name}</div>`;
        });
        dropdownList.innerHTML = listHtml;

        // Initialize Custom Dropdown Logic
        setupSearchableDropdown();
    }

    // --- Student ID Dropdown (Custom Searchable) ---
    const idDropdownList = document.getElementById('studentIdDropdownList');
    if (idDropdownList) {
        const uniqueStudents = new Map();

        // 1. Add students from the master list (id, name)
        allStudentsList.forEach(s => {
            if (s.id) uniqueStudents.set(String(s.id).trim(), { id: s.id, name: s.name || 'غير معروف' });
        });

        // 2. Add students from excuses
        allExcuses.forEach(item => {
            if (item.student_id) {
                const id = String(item.student_id).trim();
                // Prefer master list name if available, else excuse name
                if (!uniqueStudents.has(id)) {
                    uniqueStudents.set(id, { id: id, name: item.student_name || 'غير معروف' });
                }
            }
        });

        const sortedStudents = [...uniqueStudents.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));

        // Populate Dropdown List
        let listHtml = `<div class="dropdown-item p-2 cursor-pointer text-muted small" data-value="">الكل</div>`;
        sortedStudents.forEach(student => {
            listHtml += `
                <div class="dropdown-item p-2 cursor-pointer border-bottom border-light" data-value="${student.id}">
                    <div>${student.name}</div>
                    <div class="small text-muted">${student.id}</div>
                </div>
            `;
        });
        idDropdownList.innerHTML = listHtml;

        setupSearchableIdDropdown();
    }
}

/**
 * Setup logic for custom searchable dropdown (Single-Select)
 */
function setupSearchableDropdown() {
    const input = document.getElementById('filterStudentNameInput');
    const hiddenInput = document.getElementById('filterStudentName');
    const dropdown = document.getElementById('studentNameDropdownList');

    if (!input || !dropdown) return;

    // Helper to toggle icon
    const getArrow = () => input.parentNode.querySelector('.hgi-arrow-down-01');
    const setArrowState = (open) => {
        const arrow = getArrow();
        if (arrow) {
            if (open) arrow.classList.add('rotate-180');
            else arrow.classList.remove('rotate-180');
        }
    };

    // Show/Filter on Input
    input.addEventListener('input', function () {
        dropdown.classList.remove('d-none');
        dropdown.classList.add('show');
        setArrowState(true);
        const filter = this.value.toLowerCase();
        const items = dropdown.querySelectorAll('.dropdown-item');

        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            const value = item.getAttribute('data-value');

            // Hide if filtered out
            if (text.includes(filter)) {
                item.classList.remove('d-none');
            } else {
                item.classList.add('d-none');
            }
        });

        // If user clears input, clear hidden and apply
        if (this.value === '') {
            hiddenInput.value = '';
            applyFilters();
        }
    });

    // Show on focus
    input.addEventListener('focus', function () {
        dropdown.classList.remove('d-none');
        dropdown.classList.add('show');
        setArrowState(true);
    });

    // Select Item
    dropdown.addEventListener('click', function (e) {
        const item = e.target.closest('.dropdown-item');
        if (item) {
            const value = item.getAttribute('data-value');
            const text = item.textContent;

            // If "All" selected
            if (!value) {
                input.value = '';
                hiddenInput.value = '';
            } else {
                input.value = text;
                hiddenInput.value = text; // Use text as value for filtering
            }

            dropdown.classList.remove('show');
            dropdown.classList.add('d-none');
            setArrowState(false);

            applyFilters();
        }
    });

    // Close when clicking outside
    document.addEventListener('click', function (e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
            dropdown.classList.add('d-none');
            setArrowState(false);
        }
    });
}

/**
 * Setup logic for custom searchable Student ID dropdown
 */
function setupSearchableIdDropdown() {
    const input = document.getElementById('filterStudentIdInput');
    const hiddenInput = document.getElementById('filterStudentId');
    const dropdown = document.getElementById('studentIdDropdownList');

    if (!input || !dropdown) return;

    // Helper to toggle icon
    const getArrow = () => input.parentNode.querySelector('.hgi-arrow-down-01');
    const setArrowState = (open) => {
        const arrow = getArrow();
        if (arrow) {
            if (open) arrow.classList.add('rotate-180');
            else arrow.classList.remove('rotate-180');
        }
    };

    // Show/Filter on Input
    input.addEventListener('input', function () {
        dropdown.classList.remove('d-none');
        dropdown.classList.add('show');
        setArrowState(true);
        const filter = this.value.toLowerCase();
        const items = dropdown.querySelectorAll('.dropdown-item');

        items.forEach(item => {
            // Check both ID and Name text within the item
            const text = item.textContent.toLowerCase();
            // Hide if filtered out
            if (text.includes(filter)) {
                item.classList.remove('d-none');
            } else {
                item.classList.add('d-none');
            }
        });

        // If user clears input, clear hidden and apply
        if (this.value === '') {
            hiddenInput.value = '';
            applyFilters();
        }
    });

    // Show on focus
    input.addEventListener('focus', function () {
        dropdown.classList.remove('d-none');
        dropdown.classList.add('show');
        setArrowState(true);
    });

    // Select Item
    dropdown.addEventListener('click', function (e) {
        const item = e.target.closest('.dropdown-item');
        if (item) {
            const value = item.getAttribute('data-value');

            // If "All" selected
            if (!value) {
                input.value = '';
                hiddenInput.value = '';
            } else {
                input.value = value; // Show ID in input
                hiddenInput.value = value;
            }

            dropdown.classList.remove('show');
            dropdown.classList.add('d-none');
            setArrowState(false);

            applyFilters();
        }
    });

    // Close when clicking outside
    document.addEventListener('click', function (e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
            dropdown.classList.add('d-none');
            setArrowState(false);

            // Optional: Revert input if invalid
        }
    });
}

/**
 * Setup logic for custom searchable Course dropdown
 */
function setupSearchableCourseDropdown() {
    const input = document.getElementById('filterCourseInput');
    const hiddenInput = document.getElementById('filterCourse');
    const dropdown = document.getElementById('courseDropdownList');

    if (!input || !dropdown) return;

    // Helper to toggle icon
    const getArrow = () => input.parentNode.querySelector('.hgi-arrow-down-01');
    const setArrowState = (open) => {
        const arrow = getArrow();
        if (arrow) {
            if (open) arrow.classList.add('rotate-180');
            else arrow.classList.remove('rotate-180');
        }
    };

    // Show/Filter on Input
    input.addEventListener('input', function () {
        dropdown.classList.remove('d-none');
        dropdown.classList.add('show');
        setArrowState(true);
        const filter = this.value.toLowerCase();
        const items = dropdown.querySelectorAll('.dropdown-item');

        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            // Hide if filtered out
            if (text.includes(filter)) {
                item.classList.remove('d-none');
            } else {
                item.classList.add('d-none');
            }
        });

        // If user clears input, clear hidden and apply
        if (this.value === '') {
            hiddenInput.value = '';
            applyFilters();
        }
    });

    // Show on focus
    input.addEventListener('focus', function () {
        dropdown.classList.remove('d-none');
        dropdown.classList.add('show');
        setArrowState(true);
    });

    // Select Item
    dropdown.addEventListener('click', function (e) {
        const item = e.target.closest('.dropdown-item');
        if (item) {
            const value = item.getAttribute('data-value');
            const text = item.textContent;

            // If "All" selected
            if (!value) {
                input.value = '';
                hiddenInput.value = '';
            } else {
                input.value = text;
                hiddenInput.value = text;
            }

            dropdown.classList.remove('show');
            dropdown.classList.add('d-none');
            setArrowState(false);

            applyFilters();
        }
    });

    // Close when clicking outside
    document.addEventListener('click', function (e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
            dropdown.classList.add('d-none');
            setArrowState(false);
        }
    });
}

/**
 * Setup logic for static custom dropdowns (Status, Type)
 * @param {string} wrapperId - ID of the wrapper element (optional context) or just use IDs directly
 */
function setupStaticDropdown(inputId, hiddenId, listId) {
    const input = document.getElementById(inputId);
    const hiddenInput = document.getElementById(hiddenId);
    const dropdown = document.getElementById(listId);

    if (!input || !dropdown) return;

    // Helper to toggle icon
    const getArrow = () => input.parentNode.querySelector('.hgi-arrow-down-01');
    const setArrowState = (open) => {
        const arrow = getArrow();
        if (arrow) {
            if (open) arrow.classList.add('rotate-180');
            else arrow.classList.remove('rotate-180');
        }
    };

    // Toggle on click
    input.addEventListener('click', function () {
        if (dropdown.classList.contains('show')) {
            dropdown.classList.remove('show');
            dropdown.classList.add('d-none');
            setArrowState(false);
        } else {
            dropdown.classList.remove('d-none');
            dropdown.classList.add('show');
            setArrowState(true);
        }
    });

    // Select Item
    dropdown.addEventListener('click', function (e) {
        const item = e.target.closest('.dropdown-item');
        if (item) {
            const value = item.getAttribute('data-value');
            const text = item.textContent;

            hiddenInput.value = value;
            input.value = value ? text : ''; // Show text or empty if "All"

            dropdown.classList.remove('show');
            dropdown.classList.add('d-none');
            setArrowState(false);

            applyFilters();
        }
    });

    // Close when clicking outside
    document.addEventListener('click', function (e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
            dropdown.classList.add('d-none');
            setArrowState(false);
        }
    });
}

// Initialize Static Dropdowns
document.addEventListener('DOMContentLoaded', function () {
    setupStaticDropdown('filterStatusInput', 'filterStatus', 'statusDropdownList');
    setupStaticDropdown('filterTypeInput', 'filterType', 'typeDropdownList');
    setupStaticDropdown('filterEmployeeDecisionInput', 'filterEmployeeDecision', 'employeeDecisionDropdownList');
    setupStaticDropdown('filterCommitteeDecisionInput', 'filterCommitteeDecision', 'committeeDecisionDropdownList');
});


/**
 * Helper to render PDF action button
 */
function renderPdfAction(excuse) {
    const decision = (excuse.committee_decision || '').toLowerCase();
    // Enable if approved or rejected (decision made)
    const isDecided = ['approved', 'rejected', 'accepted'].includes(decision);

    if (isDecided) {
        return `<i class="hgi-stroke hgi-standard hgi-view-01 text-primary pdf-btn" data-id="${excuse.id}" title="عرض PDF" style="cursor: pointer; font-size: 1.25rem;"></i>`;
    } else {
        return `<i class="hgi-stroke hgi-standard hgi-view-01 text-muted" title="القرار قيد الانتظار" style="cursor: not-allowed; font-size: 1.25rem; opacity: 0.5;"></i>`;
    }
}

/**
 * Render the excuses table
 */
function renderExcusesTable() {
    const tableBody = document.getElementById('requestsTableBody');
    const countLabel = document.getElementById('requestsCountLabel');

    if (!tableBody) return;

    if (filteredExcuses.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5 text-muted">
                    <i class="hgi-stroke hgi-standard hgi-inbox fs-1 mb-2 d-block"></i>
                    لا توجد أعذار مطابقة للبحث
                </td>
            </tr>
        `;
        if (countLabel) countLabel.textContent = 'عرض 0 أعذار';
        renderPagination(0);
        return;
    }

    // Sort by date (newest first)
    filteredExcuses.sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateB - dateA;
    });

    // Pagination Logic
    const totalItems = filteredExcuses.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedExcuses = filteredExcuses.slice(start, end);

    let html = '';
    paginatedExcuses.forEach((excuse) => {
        // Find index in original array for editing
        const realIndex = allExcuses.indexOf(excuse);

        const statusBadge = getStatusBadge(excuse.status);
        const excuseTypeAr = getExcuseTypeArabic(excuse.excuse_type);
        const submissionDate = formatSubmissionDate(excuse.date);

        const employeeDecisionBadge = getEmployeeDecisionBadge(excuse.employee_decision);
        const committeeDecisionBadge = getCommitteeDecisionBadge(excuse.committee_decision);

        // ... [existing html generation] ...
        html += `
            <tr>
                <td class="ps-4 text-primary">${excuse.id || '-'}</td>
                <td class="ps-4">
                    <div class="lh-sm">
                        <div class="fw-medium">${excuse.student_name || '-'}</div>
                        <div class="text-muted small">${excuse.student_id || '-'}</div>
                    </div>
                </td>
                <td class="ps-4">${excuseTypeAr}</td>
                <td class="ps-4">${submissionDate}</td>
                <td class="ps-4">${excuse.excuse_date || '-'}</td>
                <td class="ps-4">${statusBadge}</td>
                <td class="ps-4">${employeeDecisionBadge}</td>
                <td class="ps-4">${committeeDecisionBadge}</td>
                <td class="ps-4">
                    <div class="d-flex gap-3 justify-content-center">
                        ${renderPdfAction(excuse)}
                        <i class="hgi-stroke hgi-standard hgi-pencil-edit-02 text-success edit-btn" data-index="${realIndex}" title="تعديل" style="cursor: pointer; font-size: 1.25rem;"></i>
                        <i class="hgi-stroke hgi-standard hgi-delete-02 text-danger delete-btn" data-id="${excuse.id}" title="حذف" style="cursor: pointer; font-size: 1.25rem;"></i>
                    </div>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;
    if (countLabel) countLabel.textContent = `عرض ${paginatedExcuses.length} من ${totalItems} عذر`;

    // Render Pagination
    renderPagination(totalItems);

    // Attach event listeners
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const index = parseInt(this.getAttribute('data-index'));
            showExcuseDetails(allExcuses[index]);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = this.getAttribute('data-id');
            confirmDelete(id);
        });
    });

    // Attach PDF listeners
    document.querySelectorAll('.pdf-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = this.getAttribute('data-id');
            downloadExcusePDF(id);
        });
    });
}


// ... [existing renderPagination] ...


// ==================== FILTER LOGIC ====================

document.addEventListener('DOMContentLoaded', function () {
    // Filter Elements
    // filterStudentId handled by custom logic setupSearchableIdDropdown
    const filterStudentIdInput = document.getElementById('filterStudentIdInput');

    // filterStudentName handled by custom logic setupSearchableDropdown
    const filterStatus = document.getElementById('filterStatus');
    const filterType = document.getElementById('filterType');
    // filterCourse handled by custom logic setupSearchableCourseDropdown
    const filterDateRange = document.getElementById('filterDateRange');
    const btnResetFilters = document.getElementById('btnResetFilters');

    // Initialize Flatpickr
    let datePickerInstance = null;
    if (filterDateRange) {
        datePickerInstance = flatpickr(filterDateRange, {
            mode: "range",
            locale: {
                ...flatpickr.l10ns.ar,
                firstDayOfWeek: 0,
                rtl: true
            },
            dateFormat: "Y-m-d",
            onChange: function (selectedDates, dateStr, instance) {
                applyFilters();
            }
        });
    }

    // Attach Listeners
    // Student ID, Name, Course handled by custom logic
    // Status & Type handled by custom static logic (trigger change on hidden input via setupStaticDropdown)
    // Date handled by Flatpickr onChange

    if (btnResetFilters) {
        btnResetFilters.addEventListener('click', function () {
            // Reset Student ID
            const inputId = document.getElementById('filterStudentIdInput');
            const hiddenId = document.getElementById('filterStudentId');
            if (inputId) inputId.value = '';
            if (hiddenId) hiddenId.value = '';

            // Reset Student Name
            const inputStudent = document.getElementById('filterStudentNameInput');
            const hiddenStudent = document.getElementById('filterStudentName');
            if (inputStudent) inputStudent.value = '';
            if (hiddenStudent) hiddenStudent.value = '';

            // Reset Course
            const inputCourse = document.getElementById('filterCourseInput');
            const hiddenCourse = document.getElementById('filterCourse');
            if (inputCourse) inputCourse.value = '';
            if (hiddenCourse) hiddenCourse.value = '';

            // Reset Status
            const inputStatus = document.getElementById('filterStatusInput');
            const hiddenStatus = document.getElementById('filterStatus');
            if (inputStatus) inputStatus.value = '';
            if (hiddenStatus) hiddenStatus.value = '';

            // Reset Employee Decision
            const inputEmp = document.getElementById('filterEmployeeDecisionInput');
            const hiddenEmp = document.getElementById('filterEmployeeDecision');
            if (inputEmp) inputEmp.value = '';
            if (hiddenEmp) hiddenEmp.value = '';

            // Reset Committee Decision
            const inputComm = document.getElementById('filterCommitteeDecisionInput');
            const hiddenComm = document.getElementById('filterCommitteeDecision');
            if (inputComm) inputComm.value = '';
            if (hiddenComm) hiddenComm.value = '';

            // Reset Type
            const inputType = document.getElementById('filterTypeInput');
            const hiddenType = document.getElementById('filterType');
            if (inputType) inputType.value = '';
            if (hiddenType) hiddenType.value = '';

            // Reset Date Range
            if (datePickerInstance) {
                datePickerInstance.clear();
            } else if (filterDateRange) {
                filterDateRange.value = '';
            }

            applyFilters();
        });
    }
});

/**
 * Apply Filters to allExcuses -> filteredExcuses
 */
function applyFilters() {
    // Use hidden input for student ID filter
    const studentId = document.getElementById('filterStudentId')?.value.trim().toLowerCase() || '';
    // Use hidden input for student name filter
    const studentName = document.getElementById('filterStudentName')?.value.trim().toLowerCase() || '';
    const status = document.getElementById('filterStatus')?.value || '';
    const empDecision = document.getElementById('filterEmployeeDecision')?.value || '';
    const commDecision = document.getElementById('filterCommitteeDecision')?.value || '';
    const type = document.getElementById('filterType')?.value || '';
    // Use hidden input for course filter
    const course = document.getElementById('filterCourse')?.value || '';

    // Parse Date Range
    let dateStart = '';
    let dateEnd = '';
    const dateRangeVal = document.getElementById('filterDateRange')?.value || '';
    if (dateRangeVal.includes(' to ')) {
        [dateStart, dateEnd] = dateRangeVal.split(' to ');
    } else if (dateRangeVal) { // Single day selected
        dateStart = dateRangeVal;
        dateEnd = dateRangeVal;
    }

    filteredExcuses = allExcuses.filter(excuse => {
        // 1. Student Number
        if (studentId && !String(excuse.student_id || '').toLowerCase().includes(studentId)) return false;

        // 2. Student Name
        if (studentName && !(excuse.student_name || '').toLowerCase().includes(studentName)) return false;

        // 3. Status
        if (status && (excuse.status || 'pending') !== status) return false;

        // 3b. Employee Decision
        if (empDecision) {
            const val = excuse.employee_decision || 'pending';
            if (val !== empDecision) return false;
        }

        // 3c. Committee Decision
        if (commDecision) {
            const val = excuse.committee_decision || 'pending';
            if (val !== commDecision) return false;
        }

        // 4. Type
        if (type && excuse.excuse_type !== type) return false;

        // 5. Course (Was Major)
        if (course && (excuse.course_name || '').trim() !== course) return false;

        // 6. Date Range (Submission Date)
        if (dateStart || dateEnd) {
            const excuseDate = new Date(excuse.date).setHours(0, 0, 0, 0);
            if (dateStart) {
                const start = new Date(dateStart).setHours(0, 0, 0, 0);
                if (excuseDate < start) return false;
            }
            if (dateEnd) {
                const end = new Date(dateEnd).setHours(0, 0, 0, 0);
                if (excuseDate > end) return false;
            }
        }

        return true;
    });

    currentPage = 1;
    renderExcusesTable();
}

/**
 * Save Employee Decision
 */
function saveEmployeeDecision(id) {
    const decision = document.getElementById('detailEmployeeDecision').value;
    const btn = document.getElementById('btnSaveEmployeeDecision');

    if (!decision) {
        Swal.fire({
            icon: 'warning',
            title: 'تنبيه',
            text: 'يرجى اختيار القرار أولاً'
        });
        return;
    }

    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'جاري الحفظ...';

    const scriptUrl = typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '';

    fetch(scriptUrl, {
        method: 'POST',
        body: JSON.stringify({
            action: 'update_decision',
            id: id,
            decision: decision
        })
    })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                // Robustly close modal
                const modalEl = document.getElementById('requestDetailsModal');
                const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                modal.hide();

                // Then show success message
                Swal.fire({
                    icon: 'success',
                    title: 'تم الحفظ',
                    text: 'تم حفظ قرار الموظف بنجاح',
                    timer: 1500,
                    showConfirmButton: false
                });
                loadAllExcuses();
            } else {
                Swal.fire('خطأ', data.message || 'فشل الحفظ', 'error');
            }
        })
        .catch(err => Swal.fire('خطأ', 'خطأ في الاتصال', 'error'))
        .finally(() => {
            btn.disabled = false;
            btn.innerHTML = originalText;
        });
}

/**
 * Save Committee Decision
 */
function saveCommitteeDecision(id) {
    const decision = document.getElementById('detailCommitteeDecision').value;
    const comment = document.getElementById('detailCommitteeComment').value;
    const btn = document.getElementById('btnSaveEmployeeDecision'); // Shared save button

    if (!decision) {
        Swal.fire({
            icon: 'warning',
            title: 'تنبيه',
            text: 'يرجى اختيار قرار اللجنة أولاً'
        });
        return;
    }

    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'جاري الحفظ...';

    const scriptUrl = typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '';

    fetch(scriptUrl, {
        method: 'POST',
        body: JSON.stringify({
            action: 'update_committee_decision',
            id: id,
            decision: decision,
            comment: comment,
            signatures: Array.from(document.querySelectorAll('input[name="committeeSig"]:checked')).map(cb => cb.value)
        })
    })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                // Robustly close modal
                const modalEl = document.getElementById('requestDetailsModal');
                const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                modal.hide();

                // Then show success message
                Swal.fire({
                    icon: 'success',
                    title: 'تم الحفظ',
                    text: 'تم حفظ قرار اللجنة بنجاح',
                    timer: 1500,
                    showConfirmButton: false
                });
                loadAllExcuses();
            } else {
                Swal.fire('خطأ', data.message || 'فشل الحفظ', 'error');
            }
        })
        .catch(err => Swal.fire('خطأ', 'خطأ في الاتصال', 'error'))
        .finally(() => {
            btn.disabled = false;
            btn.innerHTML = originalText;
        });
}

/**
 * Render Pagination Controls
 */
function renderPagination(totalItems) {
    const paginationEl = document.getElementById('pagination');
    if (!paginationEl) return;

    if (totalItems <= itemsPerPage) {
        paginationEl.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    let html = '';

    // Previous
    html += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1}); return false;" aria-label="Previous">
                <span aria-hidden="true">&laquo;</span>
            </a>
        </li>
    `;

    // Pages
    for (let i = 1; i <= totalPages; i++) {
        html += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a>
            </li>
        `;
    }

    // Next
    html += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1}); return false;" aria-label="Next">
                <span aria-hidden="true">&raquo;</span>
            </a>
        </li>
    `;

    paginationEl.innerHTML = html;
}

/**
 * Change Page
 */
window.changePage = function (page) {
    const totalPages = Math.ceil(filteredExcuses.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;

    currentPage = page;
    renderExcusesTable();
};


/**
 * Get status badge HTML
 */
function getStatusBadge(status) {
    const STATUS_MAP = {
        'approved': { text: 'مقبول', class: 'bg-success-subtle text-success-emphasis', icon: 'hgi-user-check-01' },
        'rejected': { text: 'مرفوض', class: 'bg-danger-subtle text-danger-emphasis', icon: 'hgi-user-remove-01' },
        'mismatch': { text: 'غير مطابق', class: 'bg-secondary-subtle text-secondary-emphasis', icon: 'hgi-alert-02' },
        'late': { text: 'متأخر', class: 'bg-warning-subtle text-warning-emphasis', icon: 'hgi-alarm-02' },
        'pending': { text: 'قيد المراجعة', class: 'bg-info-subtle text-info-emphasis', icon: 'hgi-clock-01' }
    };
    const config = STATUS_MAP[status] || STATUS_MAP['pending'];
    return `<span class="badge ${config.class} d-inline-flex align-items-center justify-content-center gap-1 small" style="min-width: 90px; padding: 0.4em 0.8em;">
        <i class="hgi-stroke hgi-standard ${config.icon}"></i> ${config.text}
    </span>`;
}

/**
 * Get excuse type in Arabic
 */
function getExcuseTypeArabic(type) {
    const typeMap = {
        'health': 'عذر صحي',
        'death': 'حالة وفاة'
    };
    return typeMap[type] || type || '-';
}

/**
 * Get Employee Decision badge HTML
 */
function getEmployeeDecisionBadge(decision) {
    const DECISION_MAP = {
        'pending': { text: 'قيد المراجعة', class: 'bg-info-subtle text-info-emphasis', icon: 'hgi-clock-01' },
        'approved': { text: 'مقبول', class: 'bg-success-subtle text-success-emphasis', icon: 'hgi-checkmark-circle-02' },
        'rejected': { text: 'مرفوض', class: 'bg-danger-subtle text-danger-emphasis', icon: 'hgi-cancel-circle' },
        'committee': { text: 'يحتاج قرار لجنة', class: 'bg-warning-subtle text-warning-emphasis', icon: 'hgi-user-group' }
    };

    // Default to pending if empty
    const key = decision || 'pending';
    const config = DECISION_MAP[key] || DECISION_MAP['pending'];

    return `<span class="badge ${config.class} d-inline-flex align-items-center justify-content-center gap-1 small" style="min-width: 90px; padding: 0.4em 0.8em;">
        <i class="hgi-stroke hgi-standard ${config.icon}"></i> ${config.text}
    </span>`;
}

/**
 * Get Committee Decision badge HTML
 */
function getCommitteeDecisionBadge(decision) {
    const DECISION_MAP = {
        'pending': { text: 'قيد المراجعة', class: 'bg-info-subtle text-info-emphasis', icon: 'hgi-clock-01' },
        'approved': { text: 'مقبول', class: 'bg-success-subtle text-success-emphasis', icon: 'hgi-checkmark-circle-02' },
        'rejected': { text: 'مرفوض', class: 'bg-danger-subtle text-danger-emphasis', icon: 'hgi-cancel-circle' }
    };

    // Default to pending if empty
    const key = decision || 'pending';
    const config = DECISION_MAP[key] || DECISION_MAP['pending'];

    return `<span class="badge ${config.class} d-inline-flex align-items-center justify-content-center gap-1 small" style="min-width: 90px; padding: 0.4em 0.8em;">
        <i class="hgi-stroke hgi-standard ${config.icon}"></i> ${config.text}
    </span>`;
}

/**
 * Format submission date
 */
function formatSubmissionDate(dateValue) {
    if (!dateValue) return '-';
    try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return String(dateValue);

        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        };
        return date.toLocaleString('ar-SA-u-nu-latn', options);
    } catch (e) {
        return String(dateValue);
    }
}

/**
 * Show excuse details in modal
 */
function showExcuseDetails(excuse) {
    if (!excuse) return;

    // Student Info
    const detailStudentId = document.getElementById('detailStudentId');
    const detailStudentName = document.getElementById('detailStudentName');
    const detailLevel = document.getElementById('detailLevel');
    const detailMajor = document.getElementById('detailMajor');

    if (detailStudentId) detailStudentId.value = excuse.student_id || '-';
    if (detailStudentName) detailStudentName.value = excuse.student_name || '-';
    if (detailLevel) detailLevel.value = excuse.student_level || '-';
    if (detailMajor) detailMajor.value = excuse.student_major || '-';

    // Excuse Type
    const detailType = document.getElementById('detailType');
    if (detailType) detailType.value = getExcuseTypeArabic(excuse.excuse_type);

    // Print Button
    const btnPrintPDF = document.getElementById('btnPrintPDF');
    if (btnPrintPDF) {
        btnPrintPDF.onclick = () => downloadExcusePDF(excuse.id);
    }

    // Extra Fields
    const detailExtraFields = document.getElementById('detailExtraFields');
    if (detailExtraFields) {
        let extraHtml = '';
        if (excuse.excuse_type === 'health') {
            extraHtml += `
                <div class="col-md-6">
                    <label class="form-label text-muted small">المستشفى</label>
                    <input type="text" class="form-control bg-light" value="${excuse.hospital || '-'}" readonly>
                </div>
                <div class="col-md-6">
                    <label class="form-label text-muted small">الموقع</label>
                    <input type="text" class="form-control bg-light" value="${getLocationArabic(excuse.location)}" readonly>
                </div>
            `;
        } else if (excuse.excuse_type === 'death') {
            extraHtml += `
                <div class="col-12">
                    <label class="form-label text-muted small">درجة القرابة</label>
                    <input type="text" class="form-control bg-light" value="${getRelationshipArabic(excuse.relationship)}" readonly>
                </div>
            `;
        }
        detailExtraFields.innerHTML = extraHtml;
    }

    // Duration & Date
    const detailDuration = document.getElementById('detailDuration');
    const detailExcuseDate = document.getElementById('detailExcuseDate');
    if (detailDuration) detailDuration.value = excuse.num_days ? `${excuse.num_days} يوم` : '-';
    if (detailExcuseDate) detailExcuseDate.value = excuse.excuse_date || '-';

    // Courses Table
    const detailCoursesTableBody = document.getElementById('detailCoursesTableBody');
    if (detailCoursesTableBody) {
        let coursesHtml = '';
        let courses = [];

        if (typeof excuse.affected_courses === 'string' && excuse.affected_courses.startsWith('[')) {
            try { courses = JSON.parse(excuse.affected_courses); } catch (e) { }
        } else if (Array.isArray(excuse.affected_courses)) {
            courses = excuse.affected_courses;
        }

        if (courses.length > 0) {
            courses.forEach(c => {
                const courseName = coursesLookup[String(c.course)] || c.course || '-';
                const reasonName = reasonsLookup[String(c.reason)] || c.reason || '-';
                coursesHtml += `
                    <tr>
                        <td class="ps-3">${courseName}</td>
                        <td class="ps-3">${reasonName}</td>
                    </tr>
                `;
            });
        } else {
            coursesHtml = '<tr><td colspan="2" class="text-center text-muted py-3">لا توجد مواد</td></tr>';
        }
        detailCoursesTableBody.innerHTML = coursesHtml;
    }

    // Reason
    const detailReason = document.getElementById('detailReason');
    if (detailReason) detailReason.value = excuse.reason || '';

    // Status
    const detailStatus = document.getElementById('detailStatus');
    if (detailStatus) {
        const statusClass = {
            'pending': 'alert-warning',
            'approved': 'alert-success',
            'rejected': 'alert-danger'
        };
        const statusText = {
            'pending': 'قيد المراجعة',
            'approved': 'تم قبول العذر',
            'rejected': 'مرفوض'
        };
        const statusIcon = {
            'pending': 'hgi-clock-01',
            'approved': 'hgi-user-check-01',
            'rejected': 'hgi-user-remove-01',
            'mismatch': 'hgi-alert-02',
            'late': 'hgi-alarm-02'
        };
        const cls = statusClass[excuse.status] || 'alert-warning';
        const txt = statusText[excuse.status] || 'قيد المراجعة';
        const icon = statusIcon[excuse.status] || 'hgi-clock-01';
        detailStatus.className = `alert ${cls} mb-0 small py-2 px-3 d-flex align-items-center justify-content-start gap-2`;
        detailStatus.innerHTML = `<i class="hgi hgi-stroke hgi-standard ${icon}"></i> <div><strong>التصنيف المبدئي:</strong> ${txt}</div>`;
    }

    // --- New Layout Elements ---
    const empSection = document.getElementById('employeeDecisionInputSection');
    const commSection = document.getElementById('committeeDecisionInputSection');
    const finalCommentSec = document.getElementById('finalCommentSection');

    const empBadgeCol = document.getElementById('employeeDecisionBadgeColumn');
    const commBadgeCol = document.getElementById('committeeDecisionBadgeColumn');

    const empBadgeContainer = document.getElementById('employeeDecisionBadgeContainer');
    const commBadgeContainer = document.getElementById('committeeDecisionBadgeContainer');
    const commCommentDisplay = document.getElementById('committeeCommentDisplay');

    const detailEmployeeDecision = document.getElementById('detailEmployeeDecision');
    const detailCommitteeDecision = document.getElementById('detailCommitteeDecision');
    const detailCommitteeComment = document.getElementById('detailCommitteeComment');
    const btnSaveAction = document.getElementById('btnSaveEmployeeDecision'); // Shared Save Button
    const sigContainer = document.getElementById('committeeSignaturesContainer');

    // Decision States
    const empDecision = excuse.employee_decision || 'pending';
    const empLocked = empDecision !== 'pending';
    const commDecision = excuse.committee_decision || 'pending';
    const commLocked = commDecision !== 'pending';

    // 1. Employee Logic
    // --- Refactored 3-Phase Sequential Workflow ---
    if (!empLocked) {
        // Phase 1: Only Employee Decision Input
        if (empSection) empSection.style.display = 'block';
        if (empBadgeCol) empBadgeCol.style.display = 'none';
        if (commSection) commSection.style.display = 'none';
        if (commBadgeCol) commBadgeCol.style.display = 'none';
        if (sigContainer) sigContainer.style.display = 'none';
        if (finalCommentSec) finalCommentSec.style.display = 'none';

        if (detailEmployeeDecision) detailEmployeeDecision.value = '';
        if (btnSaveAction) {
            btnSaveAction.style.display = 'block';
            btnSaveAction.innerHTML = 'حفظ قرار الموظف <i class="hgi-stroke hgi-standard hgi-save-01 ms-1"></i>';
            btnSaveAction.onclick = () => saveEmployeeDecision(excuse.id);
        }
    } else {
        // Phase 2 or 3: Employee Decision is done, show badge
        if (empSection) empSection.style.display = 'none';
        if (empBadgeCol) empBadgeCol.style.display = 'block';
        if (empBadgeContainer) {
            const alertConfig = {
                'approved': { cls: 'alert-success', text: 'مقبول', icon: 'hgi-user-check-01' },
                'rejected': { cls: 'alert-danger', text: 'مرفوض', icon: 'hgi-user-remove-01' },
                'committee': { cls: 'alert-warning', text: 'يحتاج قرار لجنة', icon: 'hgi-user-group' }
            };
            const c = alertConfig[empDecision] || { cls: 'alert-secondary', text: empDecision, icon: 'hgi-info-circle' };
            empBadgeContainer.innerHTML = `<div class="alert ${c.cls} mb-0 small py-2 px-3 d-flex align-items-center justify-content-start gap-2"><i class="hgi hgi-stroke hgi-standard ${c.icon}"></i> <div><strong>مراجعة الموظف:</strong> ${c.text}</div></div>`;
        }

        if (!commLocked) {
            // Phase 2: Show Committee Inputs
            if (commSection) commSection.style.display = 'block';
            if (commBadgeCol) commBadgeCol.style.display = 'none';
            if (sigContainer) sigContainer.style.display = 'block';
            if (finalCommentSec) finalCommentSec.style.display = 'none';

            if (detailCommitteeDecision) detailCommitteeDecision.value = '';
            if (detailCommitteeComment) detailCommitteeComment.value = '';
            loadCommitteeCheckboxes(excuse, false); // Editable

            if (btnSaveAction) {
                btnSaveAction.style.display = 'block';
                btnSaveAction.innerHTML = 'حفظ قرار اللجنة <i class="hgi-stroke hgi-standard hgi-save-01 ms-1"></i>';
                btnSaveAction.onclick = () => saveCommitteeDecision(excuse.id);
            }
        } else {
            // Phase 3: Both Done, Read-Only View
            if (commSection) commSection.style.display = 'none';
            if (commBadgeCol) commBadgeCol.style.display = 'block';
            if (commBadgeContainer) {
                const alertConfig = {
                    'approved': { cls: 'alert-success', text: 'مقبول', icon: 'hgi-user-check-01' },
                    'rejected': { cls: 'alert-danger', text: 'مرفوض', icon: 'hgi-user-remove-01' }
                };
                const c = alertConfig[commDecision] || { cls: 'alert-secondary', text: commDecision, icon: 'hgi-info-circle' };
                commBadgeContainer.innerHTML = `<div class="alert ${c.cls} mb-0 small py-2 px-3 d-flex align-items-center justify-content-start gap-2"><i class="hgi hgi-stroke hgi-standard ${c.icon}"></i> <div><strong>قرار اللجنة:</strong> ${c.text}</div></div>`;
            }

            if (sigContainer) sigContainer.style.display = 'block';
            if (finalCommentSec) finalCommentSec.style.display = 'block';
            if (commCommentDisplay) {
                commCommentDisplay.value = excuse.committee_comment || 'لا يوجد تعليق من اللجنة';
            }
            loadCommitteeCheckboxes(excuse, true); // Read-only
            if (btnSaveAction) btnSaveAction.style.display = 'none';
        }
    }

    // Reactive Listener Removal (Optional: can be commented out or removed)
    // The previous reactive listener is no longer needed because Phase 1 only shows Emp Select.
    // Transition to Phase 2 happens only after saving Emp decision.
    if (detailEmployeeDecision && !detailEmployeeDecision.hasListener) {
        detailEmployeeDecision.hasListener = true; // Mark as handled
    }

    // Files
    const detailFiles = document.getElementById('detailFiles');
    if (detailFiles) {
        let filesHtml = '';
        const files = [
            { label: 'التقرير الطبي', url: excuse.medical_link },
            { label: 'عذر صحتي', url: excuse.sehaty_link },
            { label: 'فورم الكلية', url: excuse.college_link }
        ];

        files.forEach(f => {
            if (f.url) {
                filesHtml += `
                    <a href="${f.url}" target="_blank" class="btn btn-outline-primary btn-sm">
                        <i class="hgi-stroke hgi-standard hgi-file-01 me-1"></i> ${f.label}
                    </a>
                `;
            }
        });

        detailFiles.innerHTML = filesHtml || '<span class="text-muted">لا توجد مرفقات</span>';
    }

    // Show Modal
    const modalEl = document.getElementById('requestDetailsModal');
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
}

/**
 * Get location in Arabic
 */
function getLocationArabic(location) {
    const map = {
        'inside_jeddah': 'داخل منطقة جدة',
        'outside_jeddah': 'خارج منطقة جدة'
    };
    return map[location] || location || '-';
}

/**
 * Get relationship in Arabic
 */
function getRelationshipArabic(rel) {
    const map = {
        'father': 'أب',
        'mother': 'أم',
        'sibling': 'أخ / أخت',
        'grandparent': 'جد / جدة',
        'other': 'أخرى'
    };
    return map[rel] || rel || '-';
}

/**
 * Confirm Delete
 */
function confirmDelete(id) {
    if (typeof Swal === 'undefined') {
        if (confirm('هل أنت متأكد من حذف هذا العذر؟ لا يمكن التراجع عن هذا الإجراء.')) {
            // Fallback for no Swal
            deleteExcuseSimple(id);
        }
        return;
    }

    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--bs-primary').trim() || '#0d6efd';
    const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--bs-secondary').trim() || '#6c757d';

    Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "لن تتمكن من استرجاع هذا العذر بعد حذفه!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: primaryColor,
        cancelButtonColor: secondaryColor,
        confirmButtonText: 'نعم، احذفه!',
        cancelButtonText: 'إلغاء',
        showLoaderOnConfirm: true,
        preConfirm: async () => {
            const scriptUrl = typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '';
            try {
                const response = await fetch(scriptUrl, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'delete_excuse',
                        id: id
                    })
                });
                if (!response.ok) {
                    throw new Error(response.statusText);
                }
                const data = await response.json();
                if (data.status !== 'success') {
                    Swal.showValidationMessage(data.message || 'فشل الحذف');
                }
                return data;
            } catch (error) {
                Swal.showValidationMessage(`حدث خطأ في الاتصال: ${error}`);
            }
        },
        allowOutsideClick: () => !Swal.isLoading()
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'تم الحذف!',
                text: 'تم حذف العذر بنجاح.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false,
                confirmButtonColor: primaryColor
            });
            loadAllExcuses(); // Refresh table
        }
    });
}

/**
 * Simple Delete Fallback (No SweetAlert)
 */
function deleteExcuseSimple(id) {
    const scriptUrl = typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '';
    fetch(scriptUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete_excuse', id: id })
    })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                alert('تم حذف العذر بنجاح');
                loadAllExcuses();
            } else {
                alert('خطأ: ' + (data.message || 'فشل الحذف'));
            }
        })
        .catch(err => alert('حدث خطأ في الاتصال'));
}

// ==================== SETTINGS MANAGEMENT ====================

let settingsData = { hospitals: [], courses: [], reasons: [], terms: '' };
let itemModal = null;

// Initialize settings functionality on DOM load
document.addEventListener('DOMContentLoaded', function () {
    // Initialize modal
    const itemModalEl = document.getElementById('itemModal');
    if (itemModalEl) {
        itemModal = new bootstrap.Modal(itemModalEl);
    }

    // Initialize Policy File Upload
    setupPolicyFileUpload();

    // Navigation Tab Switching
    const navDashboard = document.getElementById('navDashboard');
    const navSettings = document.getElementById('navSettings');
    const dashboardSection = document.querySelector('.container-fluid.p-4:not(#settingsSection)');
    const settingsSection = document.getElementById('settingsSection');

    if (navDashboard && navSettings) {
        navDashboard.addEventListener('click', function (e) {
            e.preventDefault();
            navDashboard.classList.remove('btn-outline-secondary');
            navDashboard.classList.add('btn-primary');
            navSettings.classList.remove('btn-primary');
            navSettings.classList.add('btn-outline-secondary');
            if (dashboardSection) dashboardSection.classList.remove('d-none');
            if (settingsSection) settingsSection.classList.add('d-none');
        });

        navSettings.addEventListener('click', function (e) {
            e.preventDefault();
            navSettings.classList.remove('btn-outline-secondary');
            navSettings.classList.add('btn-primary');
            navDashboard.classList.remove('btn-primary');
            navDashboard.classList.add('btn-outline-secondary');
            if (dashboardSection) dashboardSection.classList.add('d-none');
            if (settingsSection) settingsSection.classList.remove('d-none');
            loadSettingsData();
        });
    }
});

/**
 * Load all settings data from backend
 */
function loadSettingsData() {
    const scriptUrl = typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '';
    if (!scriptUrl) return;

    // Show loading state
    const loadingHTML = `
        <div class="text-center py-5 text-muted">
            <i class="hgi hgi-stroke hgi-standard hgi-loading-03 hgi-spin me-2"></i>جاري تحميل البيانات...
        </div>
    `;

    const hospitalsList = document.getElementById('hospitalsList');
    const coursesList = document.getElementById('coursesList');
    const reasonsList = document.getElementById('reasonsList');

    if (hospitalsList) hospitalsList.innerHTML = loadingHTML;
    if (coursesList) coursesList.innerHTML = loadingHTML;
    if (reasonsList) reasonsList.innerHTML = loadingHTML;

    fetch(scriptUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'get_settings_data' })
    })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                settingsData = {
                    hospitals: data.hospitals || [],
                    courses: data.courses || [],
                    reasons: data.reasons || [],
                    terms: data.terms || ''
                };
                renderSettingsLists();
            }
        })
        .catch(err => console.error('Error loading settings:', err));
}

function renderSettingsLists() {
    renderItemList('hospitalsList', settingsData.hospitals, 'hospitals');
    renderItemList('coursesList', settingsData.courses, 'courses');
    renderItemList('reasonsList', settingsData.reasons, 'reasons');
    loadSignatures(); // Fetch and render signatures

    // Render Policy/Terms
    const termsData = settingsData.terms;
    let policyText = '';
    let policyFileId = null;

    if (typeof termsData === 'object' && termsData !== null) {
        policyText = termsData.text || '';
        policyFileId = termsData.fileId || null;
    } else {
        policyText = termsData || '';
    }

    const termsTextarea = document.getElementById('termsTextarea');
    if (termsTextarea) termsTextarea.value = policyText;

    // Show/Hide Policy File Status
    const fileStatus = document.getElementById('currentPolicyFile');
    if (fileStatus) {
        fileStatus.style.display = policyFileId ? 'block' : 'none';
    }
}

/**
 * Render a single category list
 */
function renderItemList(containerId, items, category) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = '<div class="text-muted text-center py-4">لا توجد عناصر</div>';
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="list-group-item d-flex justify-content-between align-items-center">
            <span>${item.name}</span>
            <div class="d-flex align-items-center gap-1">
                <button class="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center p-0 rounded-2" 
                    style="width: 28px; height: 28px; border-color: #dc3545;"
                    onclick="deleteSettingsItem('${category}', ${item.id})">
                    <i class="hgi-stroke hgi-standard hgi-delete-02" style="font-size: 14px;"></i>
                </button>
                <button class="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center p-0 rounded-2" 
                    style="width: 28px; height: 28px; border-color: #0d6efd;"
                    onclick="openEditModal('${category}', ${item.id}, '${item.name.replace(/'/g, "\\'")}')">
                    <i class="hgi-stroke hgi-standard hgi-pencil-edit-02" style="font-size: 14px;"></i>
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Open Add Modal
 */
function openAddModal(category, label) {
    document.getElementById('itemModalTitle').textContent = `إضافة ${label}`;
    document.getElementById('itemCategory').value = category;
    document.getElementById('itemId').value = '';
    document.getElementById('itemName').value = '';
    itemModal.show();
}

/**
 * Open Edit Modal
 */
function openEditModal(category, id, name) {
    document.getElementById('itemModalTitle').textContent = 'تعديل العنصر';
    document.getElementById('itemCategory').value = category;
    document.getElementById('itemId').value = id;
    document.getElementById('itemName').value = name;
    itemModal.show();
}

/**
 * Save Item (Add or Update)
 */
function saveItem() {
    const category = document.getElementById('itemCategory').value;
    const id = document.getElementById('itemId').value;
    const name = document.getElementById('itemName').value.trim();

    if (!name) {
        Swal.fire({
            title: 'خطأ',
            text: 'الرجاء إدخال الاسم',
            icon: 'error',
            confirmButtonText: 'موافق',
            confirmButtonColor: '#004185'
        });
        return;
    }

    const scriptUrl = typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '';
    if (!scriptUrl) return;

    const action = id ? 'update_item' : 'add_item';
    const payload = { action, category, name };
    if (id) payload.id = id;

    fetch(scriptUrl, {
        method: 'POST',
        body: JSON.stringify(payload)
    })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                itemModal.hide();
                Swal.fire({
                    title: 'تم',
                    text: id ? 'تم تحديث العنصر بنجاح' : 'تمت إضافة العنصر بنجاح',
                    icon: 'success',
                    confirmButtonText: 'موافق',
                    confirmButtonColor: '#004185'
                });
                loadSettingsData();
            } else {
                Swal.fire({
                    title: 'خطأ',
                    text: data.message || 'فشلت العملية',
                    icon: 'error',
                    confirmButtonText: 'موافق',
                    confirmButtonColor: '#004185'
                });
            }
        })
        .catch(err => {
            Swal.fire({
                title: 'خطأ',
                text: 'حدث خطأ في الاتصال',
                icon: 'error',
                confirmButtonText: 'موافق',
                confirmButtonColor: '#004185'
            });
        });
}

/**
 * Delete Settings Item
 */
function deleteSettingsItem(category, id) {
    Swal.fire({
        title: 'تأكيد الحذف',
        text: 'هل أنت متأكد من حذف هذا العنصر؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'نعم، احذف',
        cancelButtonText: 'إلغاء'
    }).then((result) => {
        if (result.isConfirmed) {
            const scriptUrl = typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '';
            if (!scriptUrl) return;

            fetch(scriptUrl, {
                method: 'POST',
                body: JSON.stringify({ action: 'delete_item', category, id })
            })
                .then(r => r.json())
                .then(data => {
                    if (data.status === 'success') {
                        Swal.fire({
                            title: 'تم الحذف',
                            text: 'تم حذف العنصر بنجاح',
                            icon: 'success',
                            confirmButtonText: 'موافق',
                            confirmButtonColor: '#004185'
                        });
                        loadSettingsData();
                    } else {
                        Swal.fire({
                            title: 'خطأ',
                            text: data.message || 'فشل الحذف',
                            icon: 'error',
                            confirmButtonText: 'موافق',
                            confirmButtonColor: '#004185'
                        });
                    }
                })
                .catch(err => {
                    Swal.fire({
                        title: 'خطأ',
                        text: 'حدث خطأ في الاتصال',
                        icon: 'error',
                        confirmButtonText: 'موافق',
                        confirmButtonColor: '#004185'
                    });
                });
        }
    });
}

/**
 * Save Policy (Text + PDF)
 */
async function savePolicy() {
    const text = document.getElementById('termsTextarea').value;
    const fileInput = document.getElementById('policyFileInput');
    const saveBtn = document.getElementById('savePolicyBtn');
    const scriptUrl = typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '';
    if (!scriptUrl) return;

    // Disable button and show loading
    const originalBtnText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="hgi hgi-stroke hgi-standard hgi-loading-03 hgi-spin me-1"></i> جاري الحفظ...';

    let fileId = null;

    try {
        // Step 1: Upload PDF if provided
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];

            // Validate file type
            if (file.type !== 'application/pdf') {
                throw new Error('يجب أن يكون الملف بصيغة PDF');
            }

            // Convert to base64
            const base64Data = await fileToBase64(file);

            // Upload to Drive
            const uploadResponse = await fetch(scriptUrl, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'upload_policy_file',
                    fileData: base64Data,
                    mimeType: 'application/pdf'
                })
            });
            const uploadResult = await uploadResponse.json();

            if (uploadResult.status !== 'success') {
                throw new Error(uploadResult.message || 'فشل رفع الملف');
            }
            fileId = uploadResult.fileId;
        }

        // Step 2: Update policy text and file ID
        const updateResponse = await fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify({
                action: 'update_policy',
                text: text,
                fileId: fileId
            })
        });
        const updateResult = await updateResponse.json();

        if (updateResult.status === 'success') {
            Swal.fire({
                title: 'تم',
                text: fileId ? 'تم حفظ السياسة والملف بنجاح' : 'تم حفظ السياسة بنجاح',
                icon: 'success',
                confirmButtonText: 'موافق',
                confirmButtonColor: '#004185'
            });

            // Clear file input and show status
            fileInput.value = '';
            resetPolicyUploadUI();
            if (fileId) {
                document.getElementById('currentPolicyFile').style.display = 'block';
            }
        } else {
            throw new Error(updateResult.message || 'فشل حفظ السياسة');
        }
    } catch (err) {
        Swal.fire({
            title: 'خطأ',
            text: err.message || 'حدث خطأ في الاتصال',
            icon: 'error',
            confirmButtonText: 'موافق',
            confirmButtonColor: '#004185'
        });
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
    }
}

// Legacy alias for backward compatibility
function saveTerms() {
    savePolicy();
}

/**
 * Convert file to base64
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // Remove data URL prefix (e.g., "data:application/pdf;base64,")
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

/**
 * Setup Policy File Upload UI
 */
function setupPolicyFileUpload() {
    const fileInput = document.getElementById('policyFileInput');
    const removeBtn = document.getElementById('removePolicyFileBtn');

    if (!fileInput) return;

    // Handle File Selection
    fileInput.addEventListener('change', function () {
        if (this.files && this.files[0]) {
            const file = this.files[0];

            // Check type (redundant with accept attribute but good for safety)
            if (file.type !== 'application/pdf') {
                Swal.fire({
                    title: 'خطأ',
                    text: 'يجب أن يكون الملف بصيغة PDF',
                    icon: 'error',
                    confirmButtonText: 'موافق',
                    confirmButtonColor: '#004185'
                });
                this.value = ''; // Clear input
                return;
            }

            // Update UI
            const uploadBox = document.querySelector('label[for="policyFileInput"]');
            const defaultContent = uploadBox.querySelector('.default-content');
            const fileInfo = uploadBox.querySelector('.file-info');
            const fileName = document.getElementById('policyFileName');

            if (fileName) fileName.textContent = file.name;
            if (defaultContent) defaultContent.classList.add('d-none');
            if (fileInfo) {
                fileInfo.classList.remove('d-none');
                fileInfo.classList.add('d-flex');
            }
        }
    });

    // Handle File Removal
    if (removeBtn) {
        removeBtn.addEventListener('click', function (e) {
            e.preventDefault(); // Prevent opening file dialog
            e.stopPropagation(); // Stop bubbling

            fileInput.value = '';
            resetPolicyUploadUI();
        });
    }
}

/**
 * Reset Policy Upload UI
 */
function resetPolicyUploadUI() {
    const uploadBox = document.querySelector('label[for="policyFileInput"]');
    if (!uploadBox) return;

    const defaultContent = uploadBox.querySelector('.default-content');
    const fileInfo = uploadBox.querySelector('.file-info');
    const fileName = document.getElementById('policyFileName');

    if (fileName) fileName.textContent = '';
    if (defaultContent) defaultContent.classList.remove('d-none');
    if (fileInfo) {
        fileInfo.classList.add('d-none');
        fileInfo.classList.remove('d-flex');
    }
}

// ==================== ACCOUNT PREFERENCES ====================
document.addEventListener('DOMContentLoaded', function () {
    initAccountPreferences();
});

function initAccountPreferences() {
    const notifyToggle = document.getElementById('notifyToggle');
    if (!notifyToggle) return;

    // 1. Set Initial State
    // Default is true unless explicitly 'false'
    const storedPref = sessionStorage.getItem('adminNotifyPref');
    const isEnabled = storedPref !== 'false';
    notifyToggle.checked = isEnabled;

    // 2. Add Change Listener
    notifyToggle.addEventListener('change', function () {
        const newState = this.checked;
        const email = sessionStorage.getItem('adminEmail');
        const scriptUrl = typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '';

        if (!email || !scriptUrl) {
            console.error('Missing email or script URL');
            return;
        }

        // Disable during update
        this.disabled = true;

        fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify({
                action: 'update_admin_prefs',
                email: email,
                receive_notifications: newState
            })
        })
            .then(r => r.json())
            .then(data => {
                if (data.status === 'success') {
                    // Update Session
                    sessionStorage.setItem('adminNotifyPref', newState);

                    // Optional: Toast or subtle feedback
                    const Toast = Swal.mixin({
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2000,
                        timerProgressBar: true
                    });
                    Toast.fire({
                        icon: 'success',
                        title: 'تم تحديث التفضيلات'
                    });
                } else {
                    // Revert
                    notifyToggle.checked = !newState;
                    Swal.fire('خطأ', 'فشل تحديث التفضيلات: ' + (data.message || ''), 'error');
                }
            })
            .catch(err => {
                notifyToggle.checked = !newState;
                Swal.fire('خطأ', 'حدث خطأ في الاتصال', 'error');
            })
            .finally(() => {
                this.disabled = false;
            });
    });
}

// ==================== SIGNATURES MANAGEMENT ====================

let signaturesList = [];
let addSignatureModal = null;

document.addEventListener('DOMContentLoaded', function () {
    const el = document.getElementById('addSignatureModal');
    if (el) addSignatureModal = new bootstrap.Modal(el);

    // Load signatures immediately so they're available for request modals
    loadSignatures();

    // Preview Logic
    const fileInput = document.getElementById('sigImage');
    if (fileInput) {
        fileInput.addEventListener('change', function () {
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const img = document.getElementById('sigPreview');
                    const cont = document.getElementById('sigPreviewContainer');
                    if (img && cont) {
                        img.src = e.target.result;
                        cont.classList.remove('d-none');
                    }
                };
                reader.readAsDataURL(this.files[0]);
            }
        });
    }
});

function loadSignatures() {
    const scriptUrl = typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '';
    fetch(scriptUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'get_signatures' })
    })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                signaturesList = data.signatures || [];
                renderSignaturesList();
            }
        })
        .catch(console.error);
}

function renderSignaturesList() {
    const container = document.getElementById('signaturesList');
    if (!container) return;

    if (signaturesList.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted py-4">لا توجد تواقيع محفوظة</div>';
        return;
    }

    container.innerHTML = signaturesList.map(sig => `
        <div class="col-md-6">
            <div class="card h-100 border-0 shadow-sm">
                <div class="card-body d-flex align-items-center gap-3">
                    <div class="border rounded p-1 d-flex align-items-center justify-content-center" style="width: 60px; height: 60px; background: #f8f9fa;">
                        ${sig.imageUrl ? `<img src="${sig.imageUrl}" style="max-width: 100%; max-height: 100%;">` : '<i class="hgi-stroke hgi-standard hgi-signature text-muted"></i>'}
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-1 fw-bold">${sig.name}</h6>
                        <p class="text-muted small mb-0">${sig.position}</p>
                    </div>
                    <div class="dropdown">
                        <button class="btn btn-light btn-sm rounded-circle" data-bs-toggle="dropdown">
                            <i class="hgi-stroke hgi-standard hgi-more-vertical-circle-01"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><a class="dropdown-item text-danger" href="#" onclick="deleteSignature(${sig.id})">
                                <i class="hgi-stroke hgi-standard hgi-delete-02 me-2"></i>حذف
                            </a></li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function openAddSignatureModal() {
    if (signaturesList.length >= 4) {
        Swal.fire('تنبيه', 'لقد وصلت للحد الأقصى (4 تواقيع). يرجى حذف توقيع لإضافة جديد.', 'warning');
        return;
    }
    document.getElementById('sigId').value = '';
    document.getElementById('sigName').value = '';
    document.getElementById('sigPosition').value = '';
    document.getElementById('sigImage').value = '';
    document.getElementById('sigPreviewContainer').classList.add('d-none');
    addSignatureModal.show();
}

function removeSignatureImage() {
    document.getElementById('sigImage').value = '';
    document.getElementById('sigPreviewContainer').classList.add('d-none');
}

async function saveSignature() {
    const id = document.getElementById('sigId').value;
    const name = document.getElementById('sigName').value.trim();
    const position = document.getElementById('sigPosition').value.trim();
    const fileInput = document.getElementById('sigImage');

    if (!name || !position) {
        Swal.fire('خطأ', 'الاسم والمنصب مطلوبان', 'error');
        return;
    }

    // Check file if new
    let imageBase64 = null;
    let mimeType = null;
    let fileName = null;
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 2 * 1024 * 1024) { // 2MB
            Swal.fire('خطأ', 'حجم الصورة كبير جداً (اكبر من 2 ميجابايت)', 'error');
            return;
        }
        try {
            imageBase64 = await fileToBase64(file);
            mimeType = file.type;
            fileName = file.name;
        } catch (e) { console.error(e); }
    }

    // Show loading
    const btn = document.querySelector('#addSignatureModal .btn-primary');
    const spinner = document.getElementById('saveSigSpinner');
    btn.disabled = true;
    spinner.classList.remove('d-none');

    const scriptUrl = typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '';
    fetch(scriptUrl, {
        method: 'POST',
        body: JSON.stringify({
            action: 'save_signature',
            id: id,
            name: name,
            position: position,
            image: imageBase64,
            mimeType: mimeType,
            fileName: fileName
        })
    })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                addSignatureModal.hide();
                loadSignatures();
                Swal.fire('تم', 'تم حفظ التوقيع بنجاح', 'success');
            } else {
                Swal.fire('خطأ', data.message || 'فشل الحفظ', 'error');
            }
        })
        .catch(err => Swal.fire('خطأ', 'فشل الاتصال', 'error'))
        .finally(() => {
            btn.disabled = false;
            spinner.classList.add('d-none');
        });
}

function deleteSignature(id) {
    Swal.fire({
        title: 'حذف التوقيع؟',
        text: "لا يمكن التراجع عن هذا الإجراء",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، حذف',
        cancelButtonText: 'إلغاء'
    }).then((result) => {
        if (result.isConfirmed) {
            const scriptUrl = typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '';
            fetch(scriptUrl, {
                method: 'POST',
                body: JSON.stringify({ action: 'delete_signature', id: id })
            })
                .then(r => r.json())
                .then(data => {
                    if (data.status === 'success') {
                        loadSignatures();
                        Swal.fire('تم', 'تم الحذف بنجاح', 'success');
                    } else {
                        Swal.fire('خطأ', 'فشل الحذف', 'error');
                    }
                });
        }
    });
}

// Ensure signatures are loaded when needed for modal
// But simpler to just rely on loadSignatures updates.

function loadCommitteeCheckboxes(excuse, readOnly) {
    const list = document.getElementById('committeeSignaturesList');
    if (!list) return;

    if (signaturesList.length === 0) {
        if (readOnly) {
            // In read-only, show message that no signatures were selected
            list.innerHTML = '<span class="text-muted small">لم يتم تحديد أي توقيعات</span>';
            return;
        }
        list.innerHTML = '<span class="text-muted small">لا توجد تواقيع متاحة (قم بإضافتها من الإعدادات)</span>';
        // Trigger fetch just in case not loaded
        loadSignatures();
        return;
    }

    // Parse existing selections
    let selectedIds = [];
    try {
        if (excuse.committee_signatures) {
            selectedIds = JSON.parse(excuse.committee_signatures);
        }
    } catch (e) {
        // Fallback if raw string or single value
        if (excuse.committee_signatures) selectedIds = [String(excuse.committee_signatures)];
    }
    // Ensure string comparison
    selectedIds = selectedIds.map(String);

    if (readOnly) {
        // Read-only mode: Show only selected signatures with images (no checkboxes)
        const selectedSigs = signaturesList.filter(sig => selectedIds.includes(String(sig.id)));
        if (selectedSigs.length === 0) {
            list.innerHTML = '<span class="text-muted small">لم يتم تحديد أي توقيعات</span>';
            return;
        }
        list.innerHTML = selectedSigs.map(sig => `
            <div class="border rounded p-2 m-0 bg-white d-flex align-items-center gap-2">
                ${sig.imageUrl
                ? `<img src="${sig.imageUrl}" style="width: 40px; height: 30px; object-fit: cover;">`
                : `<div class="d-flex align-items-center justify-content-center bg-light rounded" style="width: 40px; height: 30px;"><i class="hgi-stroke hgi-signature text-muted"></i></div>`}
                <div>
                    <span class="fw-bold small d-block">${sig.name}</span>
                    <span class="text-muted" style="font-size: 10px;">${sig.position}</span>
                </div>
            </div>
        `).join('');
    } else {
        // Editable mode: Show all signatures with checkboxes (no images)
        list.innerHTML = signaturesList.map(sig => `
            <label class="border rounded p-2 m-0 bg-white d-flex align-items-start gap-2" style="min-width: 180px; cursor: pointer;">
                <input class="form-check-input mt-1 flex-shrink-0" type="checkbox" name="committeeSig" 
                    value="${sig.id}" id="sig_cb_${sig.id}" 
                    ${selectedIds.includes(String(sig.id)) ? 'checked' : ''}>
                <div>
                    <span class="fw-bold small d-block">${sig.name}</span>
                    <span class="text-muted" style="font-size: 10px;">${sig.position}</span>
                </div>
            </label>
        `).join('');
    }
}

/**
 * Trigger PDF Generation and Download
 */
function downloadExcusePDF(id) {
    const btn = document.getElementById('btnPrintPDF');
    if (!btn) return;

    const originalContent = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> جار التحضير...';
    btn.disabled = true;

    const scriptUrl = typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '';

    fetch(scriptUrl, {
        method: 'POST',
        body: JSON.stringify({
            action: 'generate_pdf',
            excuse_id: id
        })
    })
        .then(r => r.json())
        .then(r => {
            if (r.status === 'success') {
                // Convert Base64 to Blob and Download
                fetch(r.pdf_base64)
                    .then(res => res.blob())
                    .then(blob => {
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = url;
                        a.download = r.filename || `Excuse_${id}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                    });
            } else {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({ icon: 'error', title: 'خطأ', text: r.message || 'فشل إنشاء الملف' });
                } else {
                    alert('خطأ: ' + (r.message || 'فشل إنشاء الملف'));
                }
            }
        })
        .catch(err => {
            console.error(err);
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدث خطأ في الاتصال' });
            } else {
                alert('حدث خطأ في الاتصال');
            }
        })
        .finally(() => {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        });
}
