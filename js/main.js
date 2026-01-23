// Main JS File

// Main JS File

document.addEventListener('DOMContentLoaded', function () {
    // Check if already logged in
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        window.location.href = 'student';
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const passwordInput = document.getElementById('password');
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');

    if (loginForm) {
        // Real-time Validation for Student ID


        // Real-time Validation for Student ID & Email
        if (emailInput) {
            emailInput.addEventListener('input', function () {
                const email = this.value.trim();
                const emailGroup = this.closest('.mb-3');
                const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

                if (emailGroup) {
                    if (!email) {
                        emailGroup.classList.add('is-invalid');
                        if (emailError) {
                            emailError.textContent = 'البريد الإلكتروني مطلوب.';
                            emailError.classList.remove('d-none');
                        }
                    } else if (!emailPattern.test(email)) {
                        emailGroup.classList.add('is-invalid');
                        if (emailError) {
                            emailError.textContent = 'الرجاء إدخال بريد إلكتروني صحيح.';
                            emailError.classList.remove('d-none');
                        }
                    } else if (!email.toLowerCase().includes('@bmc.edu.sa')) {
                        emailGroup.classList.add('is-invalid');
                        if (emailError) {
                            emailError.textContent = 'يجب استخدام البريد الجامعي (@bmc.edu.sa).';
                            emailError.classList.remove('d-none');
                        }
                    } else {
                        emailGroup.classList.remove('is-invalid');
                        if (emailError) emailError.classList.add('d-none');
                    }
                }
            });
        }

        // Real-time Validation for Password
        if (passwordInput) {
            passwordInput.addEventListener('input', function () {
                const password = this.value.trim();
                const passwordGroup = this.closest('.mb-4');

                if (passwordGroup) {
                    if (!password) {
                        passwordGroup.classList.add('is-invalid');
                        if (passwordError) {
                            passwordError.textContent = 'كلمة المرور مطلوبة.';
                            passwordError.classList.remove('d-none');
                        }
                    } else if (!/^\d+$/.test(password)) {
                        passwordGroup.classList.add('is-invalid');
                        if (passwordError) {
                            passwordError.textContent = 'كلمة المرور يجب أن تكون أرقاماً فقط.';
                            passwordError.classList.remove('d-none');
                        }
                    } else {
                        passwordGroup.classList.remove('is-invalid');
                        if (passwordError) passwordError.classList.add('d-none');
                    }
                }
            });
        }

        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const email = emailInput.value.trim();
            const studentId = passwordInput.value.trim();
            const password = passwordInput.value.trim();
            const btn = document.getElementById('loginBtn');
            const errorEl = document.getElementById('loginError');

            // UI References
            const showError = (msg) => {
                if (errorEl) {
                    errorEl.textContent = msg;
                    errorEl.classList.remove('d-none');
                } else {
                    alert(msg);
                }
            };

            // Reset Errors

            const emailGroup = emailInput.closest('.mb-3'); // Assuming .mb-3 is the parent for styling
            const passwordGroup = passwordInput.closest('.mb-4'); // Assuming .mb-4 is the parent for styling

            emailGroup.classList.remove('is-invalid');
            emailGroup.classList.remove('is-invalid');
            passwordGroup.classList.remove('is-invalid');
            // if (studentIdError) studentIdError.classList.add('d-none');
            if (passwordError) passwordError.classList.add('d-none');
            if (errorEl) errorEl.classList.add('d-none'); // Reset main error

            // Re-declare variables for validation with distinct names
            // const studentIdVal = studentIdInput.value.trim(); // Value from studentIdInput
            const passwordVal = passwordInput.value.trim(); // Value from passwordInput (which is also student ID for login)
            let hasError = false;

            // Validate Email
            if (!email) {
                emailGroup.classList.add('is-invalid');
                if (emailError) {
                    emailError.textContent = 'البريد الإلكتروني مطلوب.';
                    emailError.classList.remove('d-none');
                }
                hasError = true;
            } else if (!email.toLowerCase().includes('@bmc.edu.sa')) {
                emailGroup.classList.add('is-invalid');
                if (emailError) {
                    emailError.textContent = 'يجب استخدام البريد الجامعي (@bmc.edu.sa).';
                    emailError.classList.remove('d-none');
                }
                hasError = true;
            }

            // Validate Password (Student ID)
            if (!studentId) {
                passwordGroup.classList.add('is-invalid');
                if (passwordError) {
                    passwordError.textContent = 'كلمة المرور مطلوبة.';
                    passwordError.classList.remove('d-none');
                }
                hasError = true;
            } else if (!/^\d+$/.test(studentId)) {
                // Validate Student ID is a number (if not empty)
                passwordGroup.classList.add('is-invalid');
                if (passwordError) {
                    passwordError.textContent = 'كلمة المرور يجب أن تكون أرقاماً فقط.';
                    passwordError.classList.remove('d-none');
                }
                hasError = true;
            }

            if (hasError) return;

            // Check Config
            const scriptUrl = typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '';
            if (!scriptUrl) {
                showError('خطأ في النظام: رابط السكربت غير موجود (Main Config Error)');
                return;
            }

            // Disable button
            const originalBtnText = btn.innerHTML;
            btn.innerHTML = '<i class="hgi-stroke hgi-standard hgi-loading-03 hgi-spin"></i> جاري التحقق...';
            btn.disabled = true;

            // Prepare form data as JSON (Matches Controller.gs)
            const payload = {
                action: 'login',
                email: email,
                student_id: studentId
            };

            // Execute Google Sheets Login Check
            fetch(scriptUrl, {
                method: 'POST',
                body: JSON.stringify(payload)
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok: ' + response.statusText);
                    }
                    return response.json();
                })
                .then(data => {
                    // Check for both 'success' (standard) or 'result: success' (legacy)
                    if (data.status === 'success' || data.result === 'success') {
                        // 1. LOGIN SUCCESS

                        const student = data.student || {}; // Use returned student object if available

                        sessionStorage.setItem('isLoggedIn', 'true');
                        sessionStorage.setItem('studentId', student.id || studentId);
                        sessionStorage.setItem('studentName', student.name || data.name);
                        sessionStorage.setItem('gender', student.gender || '');
                        sessionStorage.setItem('nationalId', student.nationalId || '');
                        sessionStorage.setItem('phone', student.phone || '');

                        sessionStorage.setItem('email', student.email || '');
                        sessionStorage.setItem('address', student.address || '');
                        sessionStorage.setItem('major', student.major || '');
                        sessionStorage.setItem('level', student.level || '');
                        sessionStorage.setItem('termsAgreed', student.termsAgreed ? 'true' : 'false');

                        // Redirect
                        window.location.href = 'student';

                    } else {
                        // 2. LOGIN FAILED - Generic Error (No user enumeration)
                        emailGroup.classList.add('is-invalid');
                        passwordGroup.classList.add('is-invalid');

                        const errorMsg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
                        if (emailError) {
                            emailError.textContent = errorMsg;
                            emailError.classList.remove('d-none');
                        }
                        if (passwordError) {
                            passwordError.textContent = errorMsg;
                            passwordError.classList.remove('d-none');
                        }

                        // Hide main error if field errors are shown
                        if (errorEl) errorEl.classList.add('d-none');
                    }
                })
                .catch(error => {
                    // 3. NETWORK/SCRIPT ERROR (Script NOT reached or crashed)
                    console.error('Fetch Error:', error);
                    alert('خطأ في الاتصال بالنظام!\nيرجى التحقق من اتصال الإنترنت أو إعدادات السكربت.');
                })
                .finally(() => {
                    btn.innerHTML = originalBtnText;
                    btn.disabled = false;
                });
        });
        // Toggle Password Visibility
        const togglePasswordBtn = document.getElementById('togglePassword');

        if (togglePasswordBtn && passwordInput) {
            togglePasswordBtn.addEventListener('click', function () {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);

                // Toggle Icon
                const icon = this.querySelector('i');
                if (icon) {
                    if (type === 'password') {
                        icon.classList.remove('hgi-view-off');
                        icon.classList.add('hgi-view');
                    } else {
                        icon.classList.remove('hgi-view');
                        icon.classList.add('hgi-view-off');
                    }
                }
            });
        }
    }
});
// End of file

