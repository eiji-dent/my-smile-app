/**
 * IntraoralAnalysisCard (Phase 8)
 * Extends BaseAnalysisCard with authentication gate and privacy modal.
 */
class IntraoralAnalysisCard extends BaseAnalysisCard {
  constructor(cardElement) {
    super(cardElement);
    this.initIntraoralAuth();
  }

  initIntraoralAuth() {
    const authModal = document.getElementById('auth-modal');
    const privacyModal = document.getElementById('privacy-modal');
    const passwordInput = document.getElementById('auth-password');
    const submitBtn = document.getElementById('auth-submit-btn');
    const authError = document.getElementById('auth-error-msg');
    const expiryError = document.getElementById('expiry-error-msg');

    const expiryDate = new Date('2026-06-01T00:00:00');
    const now = new Date();
    const isExpired = now >= expiryDate;

    if (isExpired) {
        authModal.classList.remove('hidden');
        expiryError.classList.remove('hidden');
        if (passwordInput) passwordInput.disabled = true;
        if (submitBtn) submitBtn.disabled = true;
    } else {
        const isAuthenticated = sessionStorage.getItem('app-auth') === 'true';
        if (isAuthenticated) {
            authModal.classList.add('hidden');
            this.checkPrivacyModal(privacyModal);
        } else {
            authModal.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
        }

        submitBtn?.addEventListener('click', () => {
            if (passwordInput.value === 'shibata-beta') {
                sessionStorage.setItem('app-auth', 'true');
                authModal.classList.add('hidden');
                authError.classList.add('hidden');
                this.checkPrivacyModal(privacyModal);
            } else {
                authError.classList.remove('hidden');
                if (window.lucide) lucide.createIcons();
            }
        });
    }
  }

  checkPrivacyModal(privacyModal) {
      const agreeBtn = document.getElementById('agree-button');
      if (privacyModal && agreeBtn) {
          privacyModal.classList.remove('hidden');
          if (window.lucide) lucide.createIcons();

          if (!agreeBtn.hasListener) {
              agreeBtn.addEventListener('click', () => {
                  privacyModal.classList.add('hidden');
                  if (window.lucide) lucide.createIcons();
              });
              agreeBtn.hasListener = true;
          }
      }
  }
}

window.IntraoralAnalysisCard = IntraoralAnalysisCard;
