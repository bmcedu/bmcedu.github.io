document.addEventListener('DOMContentLoaded', function () {
    // 1. Check Session
    console.log('Student Page loaded');
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    const studentName = sessionStorage.getItem('studentName');
    const studentId = sessionStorage.getItem('studentId');

    // State for Dynamic Data
    const portalData = {
        courses: [],
        reasons: [],
        hospitals: []
    };

    // ==================== FORM DATA CACHE SYSTEM ====================
    const CACHE_KEY = 'bmc_form_data';
    const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds

    /**
     * Get cached form data from localStorage if still valid
     */
    function getCachedFormData() {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (!cached) return null;
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp > CACHE_TTL) {
                localStorage.removeItem(CACHE_KEY);
                return null; // Expired
            }
            return parsed.data;
        } catch (e) {
            localStorage.removeItem(CACHE_KEY);
            return null;
        }
    }

    /**
     * Save form data to localStorage with timestamp
     */
    function setCachedFormData(data) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data: data
            }));
        } catch (e) {
            console.warn('Failed to cache form data:', e);
        }
    }

    /**
     * Prefetch all form data (combined API call with localStorage cache)
     */
    function prefetchFormData() {
        // Check cache first
        const cached = getCachedFormData();
        if (cached) {
            console.log('Form data loaded from cache');
            portalData.courses = cached.courses || [];
            portalData.reasons = cached.reasons || [];
            portalData.hospitals = cached.hospitals || [];
            populateHospitalsDropdown();
            return Promise.resolve(cached);
        }

        // Fetch from API
        const scriptUrl = typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '';
        if (!scriptUrl) return Promise.resolve(null);

        console.log('Fetching form data from API...');
        return fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify({ action: 'get_form_data' })
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    portalData.courses = data.courses || [];
                    portalData.reasons = data.reasons || [];
                    portalData.hospitals = data.hospitals || [];

                    // Cache for next time
                    setCachedFormData({
                        courses: portalData.courses,
                        reasons: portalData.reasons,
                        hospitals: portalData.hospitals
                    });

                    populateHospitalsDropdown();
                    console.log('Form data fetched and cached');
                }
                return data;
            })
            .catch(err => {
                console.error('Error fetching form data:', err);
                return null;
            });
    }

    /**
     * Populate hospitals dropdown from cached data
     */
    function populateHospitalsDropdown() {
        const hospitalSelect = document.getElementById('hospitalType');
        if (!hospitalSelect || portalData.hospitals.length === 0) return;

        // Clear existing options except first
        while (hospitalSelect.options.length > 1) {
            hospitalSelect.remove(1);
        }

        portalData.hospitals.forEach(hospital => {
            const option = document.createElement('option');
            if (typeof hospital === 'object') {
                option.value = hospital.id;
                option.textContent = hospital.name;
            } else {
                option.value = hospital;
                option.textContent = hospital;
            }
            hospitalSelect.appendChild(option);
        });
    }

    // Excuse Type ID to Label Mapping (for display)
    const excuseTypeLabels = {
        'health': 'عذر صحي',
        'death': 'حالة وفاة'
    };

    // Logout Logic (Early Binding)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault(); // Good practice even if button
            console.log('Logout clicked');
            sessionStorage.clear();
            window.location.href = './';
        });
    } else {
        console.error('Logout button not found!');
    }

    if (!isLoggedIn) {
        window.location.href = './';
        return;
    }

    // --- Terms Agreement Check ---
    const termsAgreed = sessionStorage.getItem('termsAgreed');
    const termsModal = document.getElementById('termsModal');
    const termsCheckbox = document.getElementById('termsCheckbox');
    const acceptTermsBtn = document.getElementById('acceptTermsBtn');

    // Show terms modal if not agreed
    if (termsAgreed !== 'true' && termsModal) {
        const modal = new bootstrap.Modal(termsModal);
        modal.show();

        // Load terms from backend
        loadTermsFromSheet();

        // Enable/disable button based on checkbox
        if (termsCheckbox && acceptTermsBtn) {
            termsCheckbox.addEventListener('change', function () {
                acceptTermsBtn.disabled = !this.checked;
            });

            // Handle accept button click
            acceptTermsBtn.addEventListener('click', async function () {
                if (!termsCheckbox.checked) return;

                const originalText = this.innerHTML;
                this.innerHTML = '<i class="hgi-stroke hgi-standard hgi-loading-03 hgi-spin me-1"></i> جاري الحفظ...';
                this.disabled = true;

                try {
                    // Call backend to save agreement
                    const response = await fetch(CONFIG.SCRIPT_URL, {
                        method: 'POST',
                        body: JSON.stringify({
                            action: 'accept_terms',
                            student_id: studentId
                        })
                    });

                    const data = await response.json();

                    if (data.status === 'success') {
                        // Update sessionStorage
                        sessionStorage.setItem('termsAgreed', 'true');

                        // Download PDF if available (placeholder - user will add PDF later)
                        const pdfUrl = 'files/terms.pdf'; // User will provide this later
                        const link = document.createElement('a');
                        link.href = pdfUrl;
                        link.download = 'شروط_واحكام_نظام_الاعذار.pdf';
                        link.click();

                        // Close modal
                        modal.hide();

                        // Show success message
                        Swal.fire({
                            icon: 'success',
                            title: 'تم بنجاح',
                            text: 'تم حفظ موافقتك على الشروط والأحكام',
                            timer: 2000,
                            showConfirmButton: false
                        });
                    } else {
                        throw new Error(data.message || 'Failed to save agreement');
                    }
                } catch (error) {
                    console.error('Error accepting terms:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'خطأ',
                        text: 'حدث خطأ أثناء حفظ الموافقة. يرجى المحاولة مرة أخرى.'
                    });
                    this.innerHTML = originalText;
                    this.disabled = !termsCheckbox.checked;
                }
            });
        }
    }

    // Load terms from Google Sheet
    async function loadTermsFromSheet() {
        const termsLoading = document.getElementById('termsLoading');
        const termsList = document.getElementById('termsList');

        try {
            const response = await fetch(CONFIG.SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'get_terms' })
            });

            const data = await response.json();

            if (data.status === 'success' && data.terms) {
                // Display single text (can contain newlines, will preserve formatting)
                termsList.innerHTML = data.terms.replace(/\n/g, '<br>');
                termsLoading.style.display = 'none';
                termsList.style.display = 'block';
            } else {
                // No terms found - show fallback message
                termsLoading.innerHTML = '<p class="text-muted mb-0">لا توجد شروط وأحكام متاحة حالياً.</p>';
            }
        } catch (error) {
            console.error('Failed to load terms:', error);
            termsLoading.innerHTML = '<p class="text-danger mb-0">فشل في تحميل الشروط والأحكام. يرجى المحاولة مرة أخرى.</p>';
        }
    }

    // Verify Session & Refresh User Data
    async function verifyAndRefreshSession() {
        try {
            const response = await fetch(CONFIG.SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'verify_session',
                    student_id: studentId
                })
            });

            const data = await response.json();

            if (data.status === 'valid' && data.student) {
                // Update sessionStorage with fresh data
                const s = data.student;
                sessionStorage.setItem('studentName', s.name || '');
                sessionStorage.setItem('gender', s.gender || '');
                sessionStorage.setItem('nationalId', s.nationalId || '');
                sessionStorage.setItem('phone', s.phone || '');

                sessionStorage.setItem('email', s.email || '');
                sessionStorage.setItem('address', s.address || '');
                sessionStorage.setItem('major', s.major || '');
                sessionStorage.setItem('level', s.level || '');
                sessionStorage.setItem('termsAgreed', s.termsAgreed ? 'true' : 'false');

                // Refresh displayed info
                refreshDisplayedUserInfo();
            } else {
                // Session invalid - force logout
                console.warn('Session invalid:', data.reason);
                sessionStorage.clear();
                window.location.href = './';
            }
        } catch (error) {
            console.error('Session verification failed:', error);
            // Don't logout on network error - keep cached data
        }
    }

    // Function to refresh displayed user info from sessionStorage
    function refreshDisplayedUserInfo() {
        const name = sessionStorage.getItem('studentName');
        if (name) {
            document.getElementById('dashboardTitle').textContent = `أهلاً وسهلاً بك، ${name}`;
            const profileNameEl = document.getElementById('profileName');
            if (profileNameEl) profileNameEl.textContent = name;

            const avatarEl = document.getElementById('studentAvatar');
            if (avatarEl) {
                avatarEl.textContent = name.trim().charAt(0).toUpperCase();
            }
        }

        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '-'; };
        setText('info-studentId', sessionStorage.getItem('studentId'));
        setText('info-major', sessionStorage.getItem('major'));
        setText('info-level', sessionStorage.getItem('level'));
        setText('info-nationalId', sessionStorage.getItem('nationalId'));
        setText('info-phone', sessionStorage.getItem('phone'));

        setText('info-email', sessionStorage.getItem('email'));
        setText('info-address', sessionStorage.getItem('address'));
    }

    // Start session verification (non-blocking)
    verifyAndRefreshSession();

    // Set Min Date to Today (Disable Past Dates)
    const excuseDateInput = document.getElementById('excuseDate');
    if (excuseDateInput) {
        const today = new Date().toISOString().split('T')[0];
        excuseDateInput.setAttribute('min', today);
    }

    // 2. Display User Info
    if (studentName) {

        document.getElementById('dashboardTitle').textContent = `أهلاً وسهلاً بك، ${studentName}`;
        const profileNameEl = document.getElementById('profileName');
        if (profileNameEl) profileNameEl.textContent = studentName;

        // Set Avatar Letter
        const avatarEl = document.getElementById('studentAvatar');
        if (avatarEl) {
            const firstLetter = studentName.trim().charAt(0).toUpperCase();
            avatarEl.textContent = firstLetter;
        }

        // 2b. Display Detailed User Info
        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '-'; };

        setText('info-studentId', studentId);
        setText('info-major', sessionStorage.getItem('major'));
        setText('info-level', sessionStorage.getItem('level'));
        setText('info-nationalId', sessionStorage.getItem('nationalId'));
        setText('info-phone', sessionStorage.getItem('phone'));

        setText('info-email', sessionStorage.getItem('email'));
        setText('info-address', sessionStorage.getItem('address'));
    }

    // 3. Status Mapping Configuration
    const STATUS_MAP = {
        'approved': { text: 'مقبول', class: 'bg-success-subtle text-success-emphasis', icon: 'hgi-user-check-01' },
        'rejected': { text: 'غير مقبول', class: 'bg-danger-subtle text-danger-emphasis', icon: 'hgi-user-remove-01' },
        'mismatch': { text: 'غير مطابق', class: 'bg-secondary-subtle text-secondary-emphasis', icon: 'hgi-alert-02' },
        'late': { text: 'متأخر', class: 'bg-warning-subtle text-warning-emphasis', icon: 'hgi-alarm-02' },
        'pending': { text: 'قيد المراجعة', class: 'bg-info-subtle text-info-emphasis', icon: 'hgi-clock-01' }
    };

    function getStatusBadge(status) {
        const config = STATUS_MAP[status] || STATUS_MAP['pending'];
        return `<span class="badge ${config.class} d-inline-flex align-items-center justify-content-center gap-1" style="min-width: 100px;">
            <i class="hgi-stroke hgi-standard ${config.icon}"></i> ${config.text}
        </span>`;
    }

    // 4. Fetch Requests
    fetchRequests();

    function fetchRequests() {
        const tbody = document.getElementById('requestsTableBody');
        if (!tbody) return;

        // Show Loading State
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted"><i class="hgi hgi-stroke hgi-standard hgi-loading-03 hgi-spin me-2"></i>جارٍ تحميل قامة الأعذار...</td></tr>';

        const scriptUrl = typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '';

        if (!scriptUrl) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">خطأ: رابط السكربت غير موجود (System Error)</td></tr>';
            return;
        }

        const payload = {
            action: 'get_excuses',
            student_id: studentId
        };

        fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify(payload)
        })
            .then(response => response.json())
            .then(data => {
                const tbody = document.getElementById('requestsTableBody');
                tbody.innerHTML = ''; // Clear loading

                // Helper to format date for display
                const formatDate = (d) => {
                    if (!d) return '';
                    // Try to parse string or handle raw Date string from JSON
                    try {
                        const dateObj = new Date(d);
                        if (isNaN(dateObj.getTime())) return d; // Return as-is if invalid

                        return dateObj.toLocaleString('ar-SA-u-nu-latn', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        });
                    } catch (e) {
                        return d;
                    }
                };

                if (Array.isArray(data) && data.length > 0) {
                    // Sort by Date Descending
                    data.sort((a, b) => {
                        const parseDate = (d) => {
                            if (!d) return 0;
                            // ISO Timestamp
                            if (d.includes('T') || d.includes('-')) return new Date(d).getTime();

                            // Legacy: DD/MM/YYYY
                            let dateStr = d.replace(',', '');
                            const [datePart, timePart] = dateStr.split(' ');
                            if (!datePart.includes('/')) return 0;

                            const parts = datePart.split('/');
                            let dateObj = new Date(parts[2], parts[1] - 1, parts[0]);
                            if (timePart) {
                                const timeParts = timePart.split(':');
                                dateObj.setHours(timeParts[0] || 0, timeParts[1] || 0, timeParts[2] || 0);
                            }
                            return dateObj.getTime();
                        };
                        return parseDate(b.date) - parseDate(a.date);
                    });



                    // PAGINATION STATE
                    let currentPage = 1;
                    const rowsPerPage = 7;
                    const allRequests = data;

                    // Function to render specific page
                    function renderTable(page) {
                        tbody.innerHTML = '';
                        currentPage = page;

                        const start = (page - 1) * rowsPerPage;
                        const end = start + rowsPerPage;
                        const pageData = allRequests.slice(start, end);

                        // Update Label ("Display 1-6 of 20")
                        const countLabel = document.getElementById('requestsCountLabel');
                        if (countLabel) {
                            const displayEnd = Math.min(end, allRequests.length);
                            countLabel.textContent = `عرض ${start + 1}-${displayEnd} من أصل ${allRequests.length} أعذار`;
                        }

                        // Render Rows
                        pageData.forEach(request => {
                            const row = document.createElement('tr');
                            const statusKey = (request.status || 'pending').toLowerCase();
                            const badgeHtml = getStatusBadge(statusKey);

                            row.innerHTML = `
                                <th scope="row" class="ps-4 text-primary">${request.id}</th>
                                <td class="ps-4">${formatDate(request.date)}</td>
                                <td class="ps-4">${request.excuse_date}</td>
                                <td class="ps-4">${excuseTypeLabels[request.excuse_type] || request.excuse_type || '-'}</td>
                                <td class="ps-4">${badgeHtml}</td>
                                <td class="ps-4">
                                    <button type="button" class="btn btn-link text-primary text-decoration-underline p-0 border-0 btn-view-details">
                                        عرض التفاصيل
                                    </button>
                                </td>
                            `;

                            // Attach Click Event
                            row.querySelector('.btn-view-details').addEventListener('click', (e) => {
                                e.preventDefault(); // Safety
                                console.log("Button Clicked for ID:", request.id);
                                showDetailsModal(request);
                            });

                            tbody.appendChild(row);
                        });

                        renderPagination();
                    }

                    // Render Pagination Controls
                    function renderPagination() {
                        const totalPages = Math.ceil(allRequests.length / rowsPerPage);
                        const paginationContainer = document.querySelector('.pagination');
                        if (!paginationContainer) return;

                        let html = '';

                        // Prev Button
                        html += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                                    <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous">&laquo;</a>
                                 </li>`;

                        // Page Numbers
                        for (let i = 1; i <= totalPages; i++) {
                            html += `<li class="page-item ${i === currentPage ? 'active' : ''}">
                                        <a class="page-link" href="#" data-page="${i}">${i}</a>
                                      </li>`;
                        }

                        // Next Button
                        html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                                    <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Next">&raquo;</a>
                                 </li>`;

                        paginationContainer.innerHTML = html;

                        // Attach Events
                        paginationContainer.querySelectorAll('.page-link').forEach(link => {
                            link.addEventListener('click', (e) => {
                                e.preventDefault();
                                const p = parseInt(e.target.dataset.page); // number or NaN
                                // Avoid clicks on disabled or invalid/boundary
                                if (!isNaN(p) && p > 0 && p <= totalPages && p !== currentPage) {
                                    renderTable(p);
                                }
                            });
                        });
                    }

                    // Initial Render
                    renderTable(1);

                } else {
                    // Empty State
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted"><i class="hgi-stroke hgi-standard hgi-folder-open mb-3 d-block" style="font-size: 2rem;"></i>لا توجد أعذار سابقة.</td></tr>';
                    const countLabel = document.getElementById('requestsCountLabel');
                    if (countLabel) countLabel.textContent = 'عرض 0 أعذار';
                }
                // Show Details Modal Logic
                function showDetailsModal(req) {
                    console.log("showDetailsModal called with:", req);
                    const modalEl = document.getElementById('requestDetailsModal');
                    if (!modalEl) {
                        console.error("Critical: #requestDetailsModal not found in DOM.");
                        alert("خطأ داخلي: نافذة التفاصيل غير موجودة");
                        return;
                    }
                    // Check Bootstrap
                    const bs = window.bootstrap;
                    if (!bs) {
                        console.error("Bootstrap object not found");
                        alert("خطأ: لم يتم تحميل مكتبة العرض");
                        return;
                    }
                    const modal = new bs.Modal(modalEl);

                    // Helpers
                    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text || '-'; };
                    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

                    // Tab 1: Committee Decision
                    setText('detailComment', req.committee_comment || 'لا يوجد تعليق من اللجنة');
                    setText('detailSignature', req.supervisor_signature || '-');

                    // Tab 2: Personal Info
                    setVal('detailStudentId', req.student_id || sessionStorage.getItem('studentId'));
                    setVal('detailStudentName', sessionStorage.getItem('studentName') || '-');

                    // Explicitly use current Session Data (Source of Truth) for attributes that can change
                    setVal('detailLevel', sessionStorage.getItem('level') || '-');
                    setVal('detailMajor', sessionStorage.getItem('major') || '-');

                    // Tab 2: Excuse Info
                    setVal('detailType', excuseTypeLabels[req.excuse_type] || req.excuse_type);
                    setVal('detailExcuseDate', req.excuse_date);
                    setVal('detailDuration', req.num_days || '-');
                    setVal('detailReason', req.reason || 'لا يوجد');

                    const statusEl = document.getElementById('detailStatus');
                    if (statusEl) {
                        const s = (req.status || 'pending').toLowerCase();

                        // Configuration
                        let config = {
                            class: 'alert-info',
                            iconBg: 'bg-info',
                            icon: 'hgi-clock-01',
                            text: 'طلبك قيد المراجعة من قبل اللجنة وسيتم تحديث حالته قريباً.',
                            textColor: 'text-info-emphasis'
                        };

                        if (s === 'approved') {
                            config = {
                                class: 'alert-success',
                                iconBg: 'bg-success',
                                icon: 'hgi-user-check-01',
                                text: 'تم قبول طلبك من قبل اللجنة',
                                textColor: 'text-success-emphasis'
                            };
                        } else if (s === 'rejected') {
                            config = {
                                class: 'alert-danger', // danger
                                iconBg: 'bg-danger',
                                icon: 'hgi-user-remove-01',
                                text: 'نأسف فقد تم رفض طلبك من قبل اللجنة.',
                                textColor: 'text-danger-emphasis'
                            };
                        } else if (s === 'mismatch') {
                            config = {
                                class: 'alert-secondary',
                                iconBg: 'bg-secondary',
                                icon: 'hgi-alert-02',
                                text: 'تم رفض طلبك لوجود عدم تطابق في البيانات المرفقة',
                                textColor: 'text-secondary-emphasis'
                            };
                        } else if (s === 'late') {
                            config = {
                                class: 'alert-warning',
                                iconBg: 'bg-warning',
                                icon: 'hgi-alarm-02',
                                text: 'تم رفض طلبك لتجاوز المدة النظامية للتقديم.',
                                textColor: 'text-warning-emphasis'
                            };
                        }

                        // Override text with specific reasons if available in future, for now generic

                        statusEl.innerHTML = `
                            <div class="alert ${config.class} border-0 d-flex align-items-center p-3 rounded-3 mb-0" role="alert">
                                <div class="${config.iconBg} text-white rounded-3 d-flex align-items-center justify-content-center flex-shrink-0" style="width: 30px; height: 30px;">
                                    <i class="hgi-stroke hgi-standard ${config.icon} fs-6"></i>
                                </div>
                                <div class="ms-3">
                                    <div class="fw-medium mb-0 ${config.textColor}" style="font-size: 18px;">${config.text}</div>
                                </div>
                            </div>
                        `;
                    }

                    // Extra Fields (Hospital/Location)
                    const extraContainer = document.getElementById('detailExtraFields');
                    if (extraContainer) {
                        extraContainer.innerHTML = '';
                        if (req.hospital) {
                            extraContainer.innerHTML += `
                                <div class="col-md-6">
                                    <label class="form-label text-muted small">المستشفى</label>
                                    <input type="text" class="form-control bg-light" value="${req.hospital}" readonly>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label text-muted small">الموقع</label>
                                    <input type="text" class="form-control bg-light" value="${req.location || '-'}" readonly>
                                </div>
                            `;
                        } else if (req.relationship) {
                            extraContainer.innerHTML += `
                                <div class="col-md-12">
                                    <label class="form-label text-muted small">درجة القرابة</label>
                                    <input type="text" class="form-control bg-light" value="${req.relationship}" readonly>
                                </div>
                            `;
                        }
                    }

                    // Courses
                    const coursesTableBody = document.getElementById('detailCoursesTableBody');
                    if (coursesTableBody) {
                        coursesTableBody.innerHTML = '';

                        let coursesData = [];
                        // Try to parse if it looks like JSON
                        if (req.affected_courses && req.affected_courses.trim().startsWith('[')) {
                            try {
                                coursesData = JSON.parse(req.affected_courses);
                            } catch (e) {
                                console.warn('Failed to parse courses JSON', e);
                                coursesData = [{ course: req.affected_courses, type: req.reason }];
                            }
                        } else {
                            // Fallback for simple string or empty
                            coursesData = [{
                            }];
                        }

                        if (coursesData.length === 0) {
                            coursesTableBody.innerHTML = `
                                <tr>
                                    <td colspan="2" class="text-center text-muted py-3">
                                        لا يوجد مواد محددة
                                    </td>
                                </tr>
                             `;
                        } else {
                            coursesData.forEach(item => {
                                // Resolve Names from IDs
                                const courseId = item.course;
                                const reasonId = item.reason || item.type; // Handle both keys if legacy

                                const courseObj = portalData.courses.find(c => String(c.id) === String(courseId));
                                const reasonObj = portalData.reasons.find(r => String(r.id) === String(reasonId));

                                const cName = courseObj ? courseObj.name : (courseId || 'غير محدد');
                                const cReason = reasonObj ? reasonObj.name : (reasonId || '-');

                                const row = document.createElement('tr');
                                row.innerHTML = `
                                    <td>
                                        <input type="text" class="form-control bg-light border-0" value="${cName}" readonly>
                                    </td>
                                    <td>
                                        <input type="text" class="form-control bg-light border-0" value="${cReason}" readonly>
                                    </td>
                                 `;
                                coursesTableBody.appendChild(row);
                            });
                        }
                    }

                    // Files
                    const filesContainer = document.getElementById('detailFiles');
                    if (filesContainer) {
                        filesContainer.innerHTML = '';
                        const addLink = (label, url) => {
                            if (!url) return;
                            filesContainer.innerHTML += `
                                <a href="${url}" target="_blank" class="btn btn-light border d-flex align-items-center gap-2">
                                    <i class="hgi-stroke hgi-standard hgi-file-text text-primary"></i> ${label}
                                </a>
                            `;
                        };

                        addLink('التقرير الطبي', req.medical_link);
                        addLink('عذر صحتي', req.sehaty_link);
                        addLink('نموذج الكلية', req.college_link);

                        if (filesContainer.innerHTML === '') {
                            filesContainer.innerHTML = '<span class="text-muted small">لا توجد مرفقات متاحة للعرض.</span>';
                        }
                    }

                    modal.show();
                }

            })
            .catch(error => {
                console.error('Error fetching requests:', error);
                tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">حدث خطأ أثناء تحميل البيانات. يرجى المحاولة لاحقاً.</td></tr>';
            });
    }

    // Initial Fetch
    fetchRequests();
    prefetchFormData(); // Single combined call with cache

    // 5. Wizard Logic
    const wizardState = {
        currentStep: 1,
        totalSteps: 4
    };

    // Reset Modal on Close
    const addRequestModal = document.getElementById('addRequestModal');
    if (addRequestModal) {
        addRequestModal.addEventListener('hidden.bs.modal', function () {
            // 1. Reset Wizard Step
            wizardState.currentStep = 1;

            // 2. Reset Form Fields
            const form = document.getElementById('addRequestForm');
            if (form) form.reset();

            // 3. Hide Conditional Fields
            document.getElementById('healthFieldsRow')?.classList.add('d-none');
            document.getElementById('deathFieldsDiv')?.classList.add('d-none');

            // 4. Clear File State
            window.wizardFiles = { medical: null, sehaty: null, college: null };

            // 5. Reset File Upload UI
            document.querySelectorAll('.upload-box').forEach(box => {
                const imgPreview = box.querySelector('img');
                const fileInfo = box.querySelector('.file-info');
                const placeholder = box.querySelector('.upload-placeholder');
                const checkmark = box.querySelector('.hgi-tick-02');

                if (imgPreview) imgPreview.classList.add('d-none');
                if (fileInfo) fileInfo.classList.add('d-none');
                if (placeholder) placeholder.classList.remove('d-none');
                if (checkmark) checkmark.classList.add('d-none');
                box.classList.remove('border-danger', 'border-success');
            });

            // 6. Clear Validation Errors
            document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

            // 7. Reset Courses Table (Keep only first row, reset its values)
            const coursesTableBody = document.getElementById('coursesTableBody');
            if (coursesTableBody) {
                const rows = coursesTableBody.querySelectorAll('tr');
                rows.forEach((row, index) => {
                    if (index === 0) {
                        // Reset first row selects
                        row.querySelectorAll('select').forEach(s => s.value = '');
                    } else {
                        // Remove extra rows
                        row.remove();
                    }
                });
            }

            // 8. Update Wizard UI
            updateWizardUI();
        });
    }

    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');
    const form = document.getElementById('addRequestForm');

    function updateWizardUI() {
        // 1. Show/Hide Steps
        for (let i = 1; i <= wizardState.totalSteps; i++) {
            const stepEl = document.getElementById(`step${i}`);
            if (stepEl) {
                if (i === wizardState.currentStep) {
                    stepEl.classList.remove('d-none');
                    stepEl.classList.add('d-block');
                } else {
                    stepEl.classList.add('d-none');
                    stepEl.classList.remove('d-block');
                }
            }
        }

        // 2. Update Progress Bar
        // 2. Update Progress Indicators (New Design)
        for (let i = 1; i <= wizardState.totalSteps; i++) {
            const indicator = document.getElementById(`stepIndicator${i}`);
            if (indicator) {
                const iconBox = indicator.querySelector('.step-icon');
                const label = indicator.querySelector('.step-label');

                if (iconBox && label) {
                    // Reset Base Classes
                    iconBox.className = 'step-icon d-flex align-items-center justify-content-center rounded-3 transition-all';
                    label.className = 'step-label fw-medium';

                    // Reset Styles
                    iconBox.style.transform = '';
                    iconBox.style.border = '';

                    if (i < wizardState.currentStep) {
                        // Completed
                        iconBox.classList.add('bg-success', 'text-white', 'shadow-sm');
                        iconBox.style.border = '1px solid #198754';
                        label.classList.add('text-success');
                    } else if (i === wizardState.currentStep) {
                        // Active
                        iconBox.classList.add('bg-primary', 'text-white', 'shadow');
                        iconBox.style.border = '1px solid #0d6efd';
                        // Removed scale transform
                        label.classList.add('text-primary');
                    } else {
                        // Pending
                        iconBox.classList.add('bg-light', 'text-muted');
                        iconBox.style.border = '1px solid #dee2e6';
                        label.classList.add('text-muted');
                    }
                }
            }
        }

        // 3. Update Buttons
        // Cancel button is always static now (handled in HTML/Listener)

        if (nextBtn) {
            if (wizardState.currentStep === wizardState.totalSteps) {
                nextBtn.innerHTML = 'إرسال الطلب <i class="hgi-stroke hgi-standard hgi-arrow-left-01"></i>';
            } else {
                nextBtn.innerHTML = 'التالي <i class="hgi-stroke hgi-standard hgi-arrow-left-01"></i>';
            }
        }

        // 4. Populate Review Data (if on last step)
        if (wizardState.currentStep === 6) {
            document.getElementById('reviewStudentName').textContent = sessionStorage.getItem('studentName') || '-';

            const typeSelect = document.getElementById('excuseType');
            if (typeSelect && typeSelect.selectedIndex >= 0) {
                document.getElementById('reviewType').textContent = typeSelect.options[typeSelect.selectedIndex].text;
            }
            document.getElementById('reviewDate').textContent = document.getElementById('excuseDate').value;
            document.getElementById('reviewReason').textContent = document.getElementById('additionalDetails').value || 'لا يوجد';

            const fileInput = document.getElementById('excuseFile');
            document.getElementById('reviewFile').textContent = (fileInput.files.length > 0) ? fileInput.files[0].name : 'لا يوجد';
        }
    }

    function validateStep(step) {
        let isValid = true;

        // Helper to mark invalid
        const markInvalid = (id) => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.add('is-invalid');
                // Auto-focus the first invalid element
                if (isValid) el.focus();
            }
            isValid = false;
        };

        // Helper to mark element invalid (for dynamic elements)
        const markElInvalid = (el) => {
            el.classList.add('is-invalid');
            if (isValid) el.focus();
            isValid = false;
        };

        // Clear existing validation errors in the current step
        const currentStepEl = document.getElementById(`step${step}`);
        if (currentStepEl) {
            const invalidInputs = currentStepEl.querySelectorAll('.is-invalid');
            invalidInputs.forEach(el => el.classList.remove('is-invalid'));
        }

        if (step === 1) {
            return true;
        } else if (step === 2) {
            const type = document.getElementById('excuseType');
            if (!type.value) {
                markInvalid('excuseType');
            } else {
                if (type.value === 'health') {
                    const hospital = document.getElementById('hospitalType');
                    const location = document.getElementById('location');
                    if (!hospital.value) markInvalid('hospitalType');
                    if (!location.value) markInvalid('location');
                } else if (type.value === 'death') {
                    const relationship = document.getElementById('relationshipType');
                    if (!relationship.value) markInvalid('relationshipType');
                }
            }
        } else if (step === 3) {
            const date = document.getElementById('excuseDate');
            if (!date.value) markInvalid('excuseDate');

            const days = document.getElementById('daysCount');
            if (!days.value) markInvalid('daysCount');

            // Table Validation
            const courseRows = document.querySelectorAll('#coursesTableBody tr');
            for (let row of courseRows) {
                const selects = row.querySelectorAll('select');
                if (selects.length >= 2) {
                    const course = selects[0].value;
                    const reason = selects[1].value;

                    // Logic:
                    // 1. Both Empty -> Valid (Ignore)
                    // 2. Both Filled -> Valid
                    // 3. Partial -> Invalid (Mark missing one)

                    if (!course && !reason) {
                        // Empty Row - Valid
                        selects[0].classList.remove('is-invalid');
                        selects[1].classList.remove('is-invalid');
                    } else if (course && reason) {
                        // Filled Row - Valid
                        selects[0].classList.remove('is-invalid');
                        selects[1].classList.remove('is-invalid');
                    } else {
                        // Partial Row - Invalid
                        if (!course) markElInvalid(selects[0]);
                        if (!reason) markElInvalid(selects[1]);
                    }
                }
            }
        } else if (step === 4) {
            // Step 4: Validate Files
            const files = ['fileMedical', 'fileSehaty', 'fileCollege'];
            const MAX_SIZE = 10 * 1024 * 1024; // 10MB
            const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'application/pdf'];
            let stepValid = true;

            files.forEach(fileId => {
                const input = document.getElementById(fileId);
                const type = fileId.replace('file', ''); // Medical, Sehaty, College
                const msgEl = document.getElementById('msg' + type);
                const labelBox = document.querySelector(`label[for="${fileId}"]`);

                // Reset State
                if (msgEl) {
                    msgEl.classList.add('d-none');
                    msgEl.classList.remove('d-block');
                }
                if (labelBox) labelBox.style.borderColor = 'var(--bs-border-color)';

                // Check 1: Existence
                // Check standard input AND our internal state (in case input was cleared but file preserved in memory - though unlikely with current logic, safe to check)
                const hasFile = (input.files && input.files.length > 0) || (window.wizardFiles && window.wizardFiles[type.toLowerCase()]);

                if (!hasFile) {
                    stepValid = false;
                    if (msgEl) {
                        msgEl.textContent = 'يرجى رفع الملف.';
                        msgEl.classList.remove('d-none');
                        msgEl.classList.add('d-block');
                    }
                    if (labelBox) labelBox.style.borderColor = 'var(--bs-danger)'; // Red border
                    return; // Stop checking this file
                }

                const file = input.files[0];

                // Check 2: Size
                if (file && file.size > MAX_SIZE) {
                    stepValid = false;
                    if (msgEl) {
                        msgEl.textContent = 'الملف كبير جداً (الحد الأقصى 10MB).';
                        msgEl.classList.remove('d-none');
                        msgEl.classList.add('d-block');
                    }
                    if (labelBox) labelBox.style.borderColor = 'var(--bs-danger)';
                    return;
                }

                // Check 3: Type
                if (file && !ALLOWED_TYPES.includes(file.type)) {
                    stepValid = false;
                    if (msgEl) {
                        msgEl.textContent = 'صيغة الملف غير مدعومة (PNG, JPG, PDF فقط).';
                        msgEl.classList.remove('d-none');
                        msgEl.classList.add('d-block');
                    }
                    if (labelBox) labelBox.style.borderColor = 'var(--bs-danger)';
                    return;
                }

                // If all checks pass, set to success green
                if (labelBox) labelBox.style.borderColor = 'var(--bs-success)';
            });
            return stepValid;
        }

        return isValid;
    }

    // Global listener to remove invalid class on input
    document.addEventListener('input', function (e) {
        if (e.target.classList.contains('is-invalid')) {
            e.target.classList.remove('is-invalid');
        }
    });
    document.addEventListener('change', function (e) {
        if (e.target.classList.contains('is-invalid')) {
            e.target.classList.remove('is-invalid');
        }
    });

    // Toggle Conditional Fields
    document.getElementById('excuseType')?.addEventListener('change', function () {
        const healthRow = document.getElementById('healthFieldsRow');
        const deathDiv = document.getElementById('deathFieldsDiv');

        if (this.value === 'health') {
            healthRow.classList.remove('d-none');
            deathDiv.classList.add('d-none');
            // Reset death fields
            document.getElementById('relationshipType').value = "";
        } else if (this.value === 'death') {
            deathDiv.classList.remove('d-none');
            healthRow.classList.add('d-none');
            // Reset health fields
            document.getElementById('hospitalType').value = "";
            document.getElementById('location').value = "";
        } else {
            healthRow.classList.add('d-none');
            deathDiv.classList.add('d-none');
            // Reset all
            document.getElementById('hospitalType').value = "";
            document.getElementById('location').value = "";
            document.getElementById('relationshipType').value = "";
        }
    });
    // Improve Date Picker Usability (Open on click)
    if (excuseDateInput) {
        excuseDateInput.addEventListener('click', function () {
            try {
                this.showPicker();
            } catch (e) {
                console.warn('showPicker not supported', e);
            }
        });
    }

    // Calculate Days Difference - DISABLED as per user request (Manual Input)
    /*
    document.getElementById('excuseDate')?.addEventListener('change', function () {
       // ... Logic removed to allow manual input and disable warnings ...
    });
    */

    // --- Dynamic Courses Table Logic ---
    const addCourseBtn = document.getElementById('addCourseBtn');
    const coursesTableBody = document.getElementById('coursesTableBody');

    // 1. Add Row
    addCourseBtn?.addEventListener('click', function () {
        // Validate last row before adding new one
        const rows = coursesTableBody.querySelectorAll('tr');
        if (rows.length > 0) {
            const lastRow = rows[rows.length - 1];
            const inputs = lastRow.querySelectorAll('select');
            let isRowValid = true;
            for (let input of inputs) {
                if (!input.value) {
                    input.classList.add('is-invalid');
                    isRowValid = false;
                }
            }
            if (!isRowValid) return;
        }

        const newRow = document.createElement('tr');

        // Generate Options
        const courseOptions = portalData.courses.length > 0
            ? portalData.courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('')
            : '<option disabled>لا توجد مواد متاحة</option>';

        const reasonOptions = portalData.reasons.length > 0
            ? portalData.reasons.map(r => `<option value="${r.id}">${r.name}</option>`).join('')
            : '<option disabled>لا توجد أسباب متاحة</option>';

        newRow.innerHTML = `
            <td>
                <select class="form-select" required>
                    <option value="" selected disabled>-- اختر المادة --</option>
                    ${courseOptions}
                </select>
            </td>
            <td>
                <select class="form-select" required>
                    <option value="" selected disabled>-- السبب --</option>
                    ${reasonOptions}
                </select>
            </td>
            <td class="text-center">
                <i class="hgi-stroke hgi-standard hgi-delete-02 text-danger delete-course-btn mx-auto d-block" style="font-size: 1.25rem; cursor: pointer;"></i>
            </td>
        `;
        coursesTableBody.appendChild(newRow);
    });

    // 2. Delete Row (Event Delegation)
    coursesTableBody?.addEventListener('click', function (e) {
        if (e.target.closest('.delete-course-btn')) {
            e.target.closest('tr').remove();
        }
    });

    if (nextBtn) {
        nextBtn.addEventListener('click', function () {
            if (wizardState.currentStep < wizardState.totalSteps) {
                // Next Action
                if (validateStep(wizardState.currentStep)) {
                    wizardState.currentStep++;
                    updateWizardUI();
                }
            } else {
                // Submit Action (Validate Last Step First)
                if (validateStep(wizardState.currentStep)) {
                    submitRequest();
                }
            }
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', function () {
            const modal = bootstrap.Modal.getInstance(document.getElementById('addRequestModal'));
            if (modal) modal.hide();
        });
    }

    // Reset Wizard on Modal Close
    const modalEl = document.getElementById('addRequestModal');
    if (modalEl) {
        modalEl.addEventListener('show.bs.modal', function () {
            // Pre-fill Step 1 Data
            document.getElementById('wizardStudentName').value = sessionStorage.getItem('studentName') || '';
            document.getElementById('wizardStudentId').value = sessionStorage.getItem('studentId') || '';
            document.getElementById('wizardMajor').value = sessionStorage.getItem('major') || '';
            document.getElementById('wizardLevel').value = sessionStorage.getItem('level') || '';
        });

        modalEl.addEventListener('hidden.bs.modal', function () {
            wizardState.currentStep = 1;
            if (form) form.reset();
            updateWizardUI();
        });
    }

    // --- Optimized File Upload Handler (with Compression) ---
    const handleFileUpload = (inputId, labelId, storageKey) => {
        const input = document.getElementById(inputId);
        const label = document.querySelector(`label[for="${inputId}"]`);
        if (!input || !label) return;

        input.addEventListener('change', async function () {
            const file = this.files[0];
            if (!file) return;

            // Immediate Validation
            const MAX_SIZE = 10 * 1024 * 1024; // 10MB
            const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'application/pdf'];

            // Setup Error UI Access
            const type = inputId.replace('file', ''); // Medical, Sehaty, College
            const msgEl = document.getElementById('msg' + type);

            // Reset Error State
            if (msgEl) {
                msgEl.classList.add('d-none');
                msgEl.classList.remove('d-block');
            }
            label.style.borderColor = 'var(--bs-border-color)';

            // Check Size
            if (file.size > MAX_SIZE) {
                // alert('الملف كبير جداً (الحد الأقصى 10MB).'); // Replaced
                this.value = ''; // Reset input
                if (msgEl) {
                    msgEl.textContent = 'الملف كبير جداً (الحد الأقصى 10MB).';
                    msgEl.classList.remove('d-none');
                    msgEl.classList.add('d-block');
                }
                label.style.borderColor = 'var(--bs-danger)';
                return;
            }

            // Check Type
            if (!ALLOWED_TYPES.includes(file.type)) {
                // alert('صيغة الملف غير مدعومة (PNG, JPG, PDF فقط).'); // Replaced
                this.value = ''; // Reset input
                if (msgEl) {
                    msgEl.textContent = 'صيغة الملف غير مدعومة (PNG, JPG, PDF فقط).';
                    msgEl.classList.remove('d-none');
                    msgEl.classList.add('d-block');
                }
                label.style.borderColor = 'var(--bs-danger)';
                return;
            }

            // UI Elements
            const defaultContent = label.querySelector('.default-content');
            const fileInfo = label.querySelector('.file-info');
            const filenameEl = fileInfo.querySelector('.filename');
            const imgPreview = fileInfo.querySelector('.img-preview');
            const pdfIcon = fileInfo.querySelector('.pdf-icon');
            const successIcon = fileInfo.querySelector('.success-icon');
            const progressBarContainer = fileInfo.querySelector('.progress');
            const progressBar = fileInfo.querySelector('.progress-bar');

            // Reset Display
            if (imgPreview) imgPreview.style.display = 'none';
            if (pdfIcon) pdfIcon.style.display = 'none';
            if (successIcon) successIcon.style.display = 'none';
            if (progressBarContainer) progressBarContainer.style.display = 'none';
            if (progressBar) progressBar.style.width = '0%';

            // Show Loading State
            if (filenameEl) filenameEl.textContent = "جاري المعالجة...";

            if (defaultContent) defaultContent.classList.add('d-none');
            if (fileInfo) {
                fileInfo.classList.remove('d-none');
                fileInfo.classList.add('d-flex');
            }

            try {
                // Show Progress Bar
                if (progressBarContainer) progressBarContainer.style.display = 'block';

                // 1. Process File (No Compression) with Progress
                const base64Data = await processFile(file, (percent) => {
                    if (progressBar) progressBar.style.width = `${percent}%`;
                });

                // Hide Progress Bar after completion (small delay for UX)
                setTimeout(() => {
                    if (progressBarContainer) progressBarContainer.style.display = 'none';
                }, 500);

                // 2. Store for Submission
                if (!window.wizardFiles) window.wizardFiles = {};
                window.wizardFiles[storageKey] = {
                    name: file.name,
                    mimeType: file.type,
                    data: base64Data.split(',')[1]
                };

                // 3. Update UI
                if (filenameEl) filenameEl.textContent = file.name;

                if (file.type === 'application/pdf') {
                    // Show PDF Icon
                    if (imgPreview) imgPreview.style.display = 'none';
                    if (pdfIcon) pdfIcon.style.display = 'block';
                } else {
                    // Show Image Preview
                    if (imgPreview) {
                        imgPreview.src = base64Data;
                        imgPreview.style.display = 'block';
                    }
                    if (pdfIcon) pdfIcon.style.display = 'none';
                }

                // Show Success Icon
                if (successIcon) successIcon.style.display = 'block';

                label.style.borderColor = 'var(--bs-success)'; // Success Green

            } catch (e) {
                console.error("File Processing Failed", e);
                alert("حدث خطأ أثناء معالجة الملف");
                if (progressBarContainer) progressBarContainer.style.display = 'none';
                input.value = ''; // Reset
                // Reset UI on error
                if (defaultContent) defaultContent.classList.remove('d-none');
                if (fileInfo) {
                    fileInfo.classList.add('d-none');
                    fileInfo.classList.remove('d-flex');
                }
            }
        });

        // Handle Remove Click
        label.addEventListener('click', function (e) {
            if (e.target.closest('.remove-file-btn')) {
                e.preventDefault();
                e.stopPropagation();

                input.value = '';
                if (window.wizardFiles) delete window.wizardFiles[storageKey];

                const defaultContent = label.querySelector('.default-content');
                const fileInfo = label.querySelector('.file-info');
                const successIcon = fileInfo.querySelector('.success-icon');
                const progressBarContainer = fileInfo.querySelector('.progress');

                if (successIcon) successIcon.style.display = 'none';
                if (progressBarContainer) progressBarContainer.style.display = 'none';

                if (defaultContent) defaultContent.classList.remove('d-none');
                if (fileInfo) {
                    fileInfo.classList.add('d-none');
                    fileInfo.classList.remove('d-flex');
                }
                label.style.borderColor = 'var(--bs-border-color)';
            }
        });
    };

    // Initialize Uploaders
    handleFileUpload('fileMedical', 'fileMedical', 'medical');
    handleFileUpload('fileSehaty', 'fileSehaty', 'sehaty');
    handleFileUpload('fileCollege', 'fileCollege', 'college');

    // Helper: Read File as Base64 (No Compression)
    function processFile(file, onProgress) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            if (onProgress) {
                reader.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        onProgress(percent);
                    }
                };
            }

            reader.readAsDataURL(file);
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
        });
    }

    async function submitRequest() {
        const submitBtn = nextBtn;
        const originalBtnHtml = submitBtn.innerHTML;

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="hgi-stroke hgi-standard hgi-loading-03 hgi-spin me-2"></i> جاري الإرسال...';

        // Helper to read file as Base64
        const readFile = (id) => new Promise((resolve, reject) => {
            const input = document.getElementById(id);
            if (input && input.files && input.files.length > 0) {
                const file = input.files[0];
                const reader = new FileReader();
                reader.onload = () => resolve({
                    name: file.name,
                    mimeType: file.type,
                    data: reader.result.split(',')[1] // Base64 part
                });
                reader.onerror = error => reject(error);
                reader.readAsDataURL(file);
            } else {
                resolve(null);
            }
        });

        try {
            // Helper to get text from select
            const getSelectedText = (id) => {
                const el = document.getElementById(id);
                if (el && el.selectedIndex !== -1) {
                    return el.options[el.selectedIndex].text;
                }
                return '';
            };

            // 1. Prepare Basic Data
            const excuseType = document.getElementById('excuseType').value;

            const payload = {
                action: 'submit_request',
                student_id: sessionStorage.getItem('studentId'),
                student_name: sessionStorage.getItem('studentName'),
                student_major: sessionStorage.getItem('major'),
                student_level: sessionStorage.getItem('level'),

                excuse_type: excuseType,

                excuse_date: document.getElementById('excuseDate').value,
                submission_date: new Date().toISOString(), // Save as Timestamp
                reason: document.getElementById('additionalDetails').value || '',
                num_days: document.getElementById('daysCount').value || '-',
            };

            // Conditional Fields - Mutually exclusive
            if (excuseType === 'health') {
                payload.hospital = document.getElementById('hospitalType').value;
                payload.location = getSelectedText('location');
            } else if (excuseType === 'death') {
                payload.relationship_type = getSelectedText('relationshipType');
            }

            // 2. Prepare Courses Data
            const courseRows = document.querySelectorAll('#coursesTableBody tr');
            const courses = [];
            courseRows.forEach(row => {
                const selects = row.querySelectorAll('select');
                if (selects.length >= 2 && selects[0].value && selects[1].value) { // Filter empty rows
                    courses.push({
                        course: selects[0].value, // Send ID
                        reason: selects[1].value  // Send ID
                    });
                }
            });
            payload.affected_courses = JSON.stringify(courses);

            // 3. Get Files (Compressed from Global State)
            // ------------------------------------------
            // Files are already validated in Step 4
            const files = window.wizardFiles || {};
            const medicalFile = files.medical || null;
            const sehatyFile = files.sehaty || null;
            const collegeFile = files.college || null;

            payload.files = {
                medical: medicalFile,
                sehaty: sehatyFile,
                college: collegeFile
            };

            // 4. Send Unified Request (Drive, Sheet, Email)
            // ------------------------------------------
            const response = await fetch(CONFIG.SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            const responseText = await response.text();
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                throw new Error('Server Error: ' + responseText.substring(0, 100));
            }

            if (result.status !== 'success') {
                throw new Error(result.message || 'Unknown Error');
            }

            // Success Handling
            const modalEl = document.getElementById('addRequestModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            Swal.fire({
                icon: 'success',
                title: 'تم إرسال طلب العذر بنجاح!',
                text: 'تم تقديم طلب العذر بنجاح وسيتم تحديث النتيجة من قبل الفريق المعني.',
                confirmButtonText: 'تم بنجاح',
                confirmButtonColor: 'var(--bs-primary)',
                timer: 3000,
                timerProgressBar: true
            });

            fetchRequests();

        } catch (error) {
            console.error('Error submitting request:', error);
            Swal.fire({
                icon: 'error',
                title: 'خطأ',
                text: 'عذراً، حدث خطأ أثناء إرسال طلب العذر.\n' + error.message,
                confirmButtonText: 'حسناً',
                confirmButtonColor: 'var(--bs-danger)'
            });
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
        }
    }
});


