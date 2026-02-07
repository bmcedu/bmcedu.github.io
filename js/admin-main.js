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
        if (emailInput) {
            emailInput.value = magicEmail;
            emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (otpInput) {
            otpInput.value = magicOtp;
            otpInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Switch to Step 2 immediately
        if (step1 && step2) {
            step1.classList.add('d-none');
            step2.classList.remove('d-none');
        }

        adminEmail = magicEmail; // Set global var

        // Trigger Login
        if (loginForm) {
            // Wait a brief moment for UI to settle
            setTimeout(() => {
                if (loginForm.requestSubmit) {
                    loginForm.requestSubmit(loginBtn);
                } else {
                    loginBtn.click();
                }
            }, 800);
        }
    }

    // Real-time Validation for Email
    if (emailInput) {
        emailInput.addEventListener('input', function () {
            const email = this.value.trim();
            const emailGroup = this.closest('.input-group');
            const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

            if (loginError) loginError.classList.add('d-none'); // Clear general error

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

            if (loginError) loginError.classList.add('d-none'); // Clear general error

            if (!otp) {
                setError(otpError, 'رمز التحقق مطلوب.', otpGroup);
            } else if (otp.length !== 6) {
                setError(otpError, 'يجب أن يتكون الرمز من 6 أرقام.', otpGroup);
            } else {
                clearError(otpError, otpGroup);
            }
        });
    }

    // ... (skipped middle parts)

    // Helper Functions
    function setError(errorEl, message, group) {
        if (errorEl) {
            errorEl.textContent = message || '';
            if (message) {
                errorEl.classList.remove('d-none');
            } else {
                errorEl.classList.add('d-none');
            }
        }
        if (group) group.classList.add('is-invalid');
    }

    function clearError(errorEl, group) {
        if (errorEl) errorEl.classList.add('d-none');
        if (group) group.classList.remove('is-invalid');
    }
});
