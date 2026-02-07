// Admin Login JS File - OTP Based Authentication

document.addEventListener('DOMContentLoaded', function () {
    // Check if already logged in as admin
    if (sessionStorage.getItem('isAdminLoggedIn') === 'true') {
        window.location.href = 'admin';
        return;
    }

    // ==================== TAB COMMUNICATION ====================
    // Listen for successful login from magic link tab
    window.addEventListener('storage', function (e) {
        if (e.key === 'admin_login_success') {
            // Another tab (magic link) logged in successfully
            // Redirect this tab to dashboard as well
            window.location.href = 'admin';
        }
    });

    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const otpInput = document.getElementById('otp');
    const emailError = document.getElementById('emailError');
    const otpError = document.getElementById('otpError');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const requestOtpBtn = document.getElementById('requestOtpBtn');
    const loginBtn = document.getElementById('loginBtn');
    const backBtn = document.getElementById('backBtn');
    const loginError = document.getElementById('loginError');

    let adminEmail = '';

    // Check for Magic Link Params (Auto Login)
    const urlParams = new URLSearchParams(window.location.search);
    const magicEmail = urlParams.get('email');
    const magicOtp = urlParams.get('otp');

    if (magicEmail && magicOtp) {
        // Auto-fill and submit
        if (emailInput) emailInput.value = magicEmail;
        if (otpInput) otpInput.value = magicOtp;

        // Switch to Step 2 immediately
        if (step1 && step2) {
            step1.classList.add('d-none');
            step2.classList.remove('d-none');
        }

        adminEmail = magicEmail; // Set global var

        // Trigger Login
        if (loginBtn) {
            // Wait a brief moment for UI to settle
            setTimeout(() => {
                loginBtn.click();
            }, 500);
        }
    }

    // Real-time Validation for Email
    if (emailInput) {
        emailInput.addEventListener('input', function () {
            const email = this.value.trim();
            const emailGroup = this.closest('.input-group');
            const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

            if (!email) {
                setError(emailError, 'البريد الإلكتروني مطلوب.', emailGroup);
            } else if (!emailPattern.test(email)) {
                setError(emailError, 'الرجاء إدخال بريد إلكتروني صحيح.', emailGroup);
            } else {
                clearError(emailError, emailGroup);
            }
        });
    }

    // Real-time Validation for OTP (digits only)
    if (otpInput) {
        otpInput.addEventListener('input', function () {
            // Only allow digits
            this.value = this.value.replace(/\D/g, '');

            const otp = this.value.trim();
            const otpGroup = this.closest('.input-group');

            if (!otp) {
                setError(otpError, 'رمز التحقق مطلوب.', otpGroup);
            } else if (otp.length !== 6) {
                setError(otpError, 'يجب أن يتكون الرمز من 6 أرقام.', otpGroup);
            } else {
                clearError(otpError, otpGroup);
            }
        });
    }

    // Step 1: Request OTP
    if (requestOtpBtn) {
        requestOtpBtn.addEventListener('click', async function () {
            const email = emailInput.value.trim();
            const emailGroup = emailInput.closest('.input-group');

            // Validate email
            if (!email) {
                setError(emailError, 'يرجى إدخال بريد إلكتروني صحيح.', emailGroup);
                return;
            }

            clearError(emailError, emailGroup);

            // Check Config
            const scriptUrl = typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '';
            if (!scriptUrl) {
                alert('خطأ في النظام: رابط السكربت غير موجود');
                return;
            }

            // Disable button and show loading
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="hgi-stroke hgi-standard hgi-loading-03 hgi-spin me-1"></i> جاري الإرسال...';
            this.disabled = true;

            try {
                const response = await fetch(scriptUrl, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'admin_request_otp',
                        email: email
                    })
                });

                const data = await response.json();

                if (data.status === 'success') {
                    // Success - move to step 2
                    adminEmail = email;
                    step1.classList.add('d-none');
                    step2.classList.remove('d-none');
                    otpInput.focus();
                    startResendTimer(30); // Start 30s countdown
                } else {
                    // Error
                    setError(emailError, data.message || 'البريد الإلكتروني غير مسجل في النظام.', emailGroup);
                }
            } catch (error) {
                console.error('OTP Request Error:', error);
                alert('خطأ في الاتصال بالنظام! يرجى المحاولة مرة أخرى.');
            } finally {
                this.innerHTML = originalText;
                this.disabled = false;
            }
        });
    }

    // Back Button
    if (backBtn) {
        backBtn.addEventListener('click', function () {
            step2.classList.add('d-none');
            step1.classList.remove('d-none');
            if (otpInput) otpInput.value = '';
            if (loginError) loginError.classList.add('d-none');
            emailInput.focus();
        });
    }

    // Step 2: Verify OTP and Login
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const otp = otpInput.value.trim();
            const otpGroup = otpInput.closest('.input-group');

            // Validate OTP
            if (!otp || otp.length !== 6) {
                setError(otpError, 'يرجى إدخال الرمز المكون من 6 أرقام.', otpGroup);
                return;
            }

            clearError(otpError, otpGroup);
            if (loginError) loginError.classList.add('d-none');

            // Check Config
            const scriptUrl = typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '';
            if (!scriptUrl) {
                alert('خطأ في النظام: رابط السكربت غير موجود');
                return;
            }

            // Disable button and show loading
            const originalText = loginBtn.innerHTML;
            loginBtn.innerHTML = '<i class="hgi-stroke hgi-standard hgi-loading-03 hgi-spin me-1"></i> جاري التحقق...';
            loginBtn.disabled = true;

            try {
                const response = await fetch(scriptUrl, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'admin_login',
                        email: adminEmail,
                        otp: otp
                    })
                });

                const data = await response.json();

                if (data.status === 'success') {
                    // LOGIN SUCCESS
                    const admin = data.admin || {};

                    sessionStorage.setItem('isAdminLoggedIn', 'true');
                    sessionStorage.setItem('adminId', admin.id || '');
                    sessionStorage.setItem('adminName', admin.name || '');
                    sessionStorage.setItem('adminEmail', admin.email || adminEmail);
                    sessionStorage.setItem('adminNotifyPref', admin.receive_notifications); // Added

                    // Notify other tabs (original login tab) about successful login
                    localStorage.setItem('admin_login_success', Date.now().toString());
                    // Clean up after a short delay to ensure other tabs detect the change
                    setTimeout(() => localStorage.removeItem('admin_login_success'), 100);

                    // Redirect to admin dashboard
                    window.location.href = 'admin';
                } else {
                    // Error
                    if (loginError) {
                        loginError.textContent = data.message || 'رمز التحقق غير صحيح أو منتهي الصلاحية.';
                        loginError.classList.remove('d-none');
                    }
                    setError(otpError, '', otpGroup);
                }
            } catch (error) {
                console.error('Login Error:', error);
                alert('خطأ في الاتصال بالنظام! يرجى المحاولة مرة أخرى.');
            } finally {
                loginBtn.innerHTML = originalText;
                loginBtn.disabled = false;
            }
        });
    }

    // --- Resend OTP Logic ---
    const resendLink = document.getElementById('resendLink');
    let resendInterval;

    function startResendTimer(duration) {
        let timer = duration, minutes, seconds;

        // Initial State
        if (resendLink) {
            resendLink.classList.add('disabled', 'text-muted');
            resendLink.classList.remove('text-primary');
            resendLink.style.pointerEvents = 'none';
        }

        // Clear existing interval if any
        if (resendInterval) clearInterval(resendInterval);

        // Update function for reuse - gets span dynamically each time
        const updateDisplay = () => {
            const timerSpan = document.getElementById('resendTimer');
            minutes = parseInt(timer / 60, 10);
            seconds = parseInt(timer % 60, 10);

            minutes = minutes < 10 ? "0" + minutes : minutes;
            seconds = seconds < 10 ? "0" + seconds : seconds;

            if (timerSpan) timerSpan.textContent = "(" + minutes + ":" + seconds + ")";
        };

        updateDisplay(); // Run once immediately

        resendInterval = setInterval(function () {
            if (--timer < 0) {
                clearInterval(resendInterval);
                // Enable Link
                if (resendLink) {
                    resendLink.classList.remove('disabled', 'text-muted');
                    resendLink.classList.add('text-primary');
                    resendLink.style.pointerEvents = 'auto';
                    const timerSpan = document.getElementById('resendTimer');
                    if (timerSpan) timerSpan.textContent = "";
                }
            } else {
                updateDisplay();
            }
        }, 1000);
    }

    // Resend Click Handler
    if (resendLink) {
        resendLink.addEventListener('click', async function (e) {
            e.preventDefault();
            if (this.classList.contains('disabled')) return;

            // Reset UI state
            this.classList.add('disabled', 'text-muted');
            this.style.pointerEvents = 'none';

            const timerSpan = document.getElementById('resendTimer');
            if (timerSpan) timerSpan.innerHTML = '<i class="hgi-stroke hgi-standard hgi-loading-03 hgi-spin"></i>';

            const scriptUrl = typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '';
            if (!scriptUrl) return;

            try {
                const response = await fetch(scriptUrl, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'admin_request_otp',
                        email: adminEmail
                    })
                });

                const data = await response.json();

                if (data.status === 'success') {
                    // Success Feedback
                    this.innerHTML = '<i class="hgi hgi-stroke hgi-standard hgi-tick-01 me-1"></i> تم الإرسال';
                    this.style.color = 'green';

                    setTimeout(() => {
                        this.style.color = '';
                        this.innerHTML = '<i class="hgi hgi-stroke hgi-standard hgi-refresh me-1"></i> إعادة إرسال الرمز <span id="resendTimer">(00:30)</span>';
                        // Re-acquire span since we just destroyed it
                        // Note: startResendTimer relies on the global 'resendTimerSpan' which refers to the OLD element.
                        // We need to re-query it if we want the timer to update the text.
                        const newSpan = document.getElementById('resendTimer');
                        // Gross hack: update the variable reference if simple let (but it's const).
                        // Better approach: Don't destroy innerHTML. Just start timer. 
                        // For this minimal implementation, simply restarting the process works, 
                        // but visual timer might break if span ref is lost.
                        // Let's just reload page? No.
                        // Let's rely on the user not staring at the timer for 2 seconds.
                        startResendTimer(30);
                    }, 2000);

                } else {
                    if (loginError) {
                        loginError.textContent = data.message;
                        loginError.classList.remove('d-none');
                    }
                    startResendTimer(30); // Penalty wait
                }
            } catch (error) {
                console.error("Resend Error", error);
                startResendTimer(10);
            }
        });
    }

    // Helper Functions
    function setError(errorEl, message, group) {
        if (errorEl && message) {
            errorEl.textContent = message;
            errorEl.classList.remove('d-none');
        }
        if (group) group.classList.add('is-invalid');
    }

    function clearError(errorEl, group) {
        if (errorEl) errorEl.classList.add('d-none');
        if (group) group.classList.remove('is-invalid');
    }
});
