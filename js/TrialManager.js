/**
 * TrialManager Class
 * Handles trial license verification and expiration logic.
 */
class TrialManager {
  constructor() {
    this.passcode = 'SHIBATA';
    this.expirationDate = new Date('2026-05-31');
    this.storageKey = 'aesthetic_trial_auth';
    this.modal = document.getElementById('trial-modal');
    this.input = document.getElementById('trial-passcode');
    this.button = document.getElementById('trial-submit-btn');
    this.errorMsg = document.getElementById('trial-error-msg');
    this.content = document.getElementById('trial-content');
    this.expiredMsg = document.getElementById('trial-expired-msg');
    this.init();
  }
  init() {
    if (!this.modal) return;
    if (new Date() > this.expirationDate) {
      this.showExpired(); return;
    }
    if (localStorage.getItem(this.storageKey) === 'true') {
      this.hideModal();
    } else {
      this.showModal();
    }
    this.button.addEventListener('click', () => this.checkPasscode());
    this.input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.checkPasscode();
    });
  }
  showModal() {
    this.modal.style.display = 'flex';
    if (window.lucide) window.lucide.createIcons();
  }
  hideModal() { 
    if (this.modal) this.modal.style.display = 'none'; 
  }
  showExpired() {
    this.modal.style.display = 'flex';
    this.content.style.display = 'none';
    this.expiredMsg.style.display = 'block';
    if (window.lucide) window.lucide.createIcons();
  }
  checkPasscode() {
    if (this.input.value.trim() === this.passcode) {
      localStorage.setItem(this.storageKey, 'true');
      this.hideModal();
    } else {
      this.errorMsg.style.display = 'block';
      this.input.value = ''; this.input.focus();
    }
  }
}
window.TrialManager = TrialManager;
