// src/utils/toast.ts
// Vanilla JS toast manager

let toastContainer: HTMLDivElement | null = null;

function getContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message: string, type: 'info' | 'success' | 'warning' = 'info') {
  const container = getContainer();
  
  const toast = document.createElement('div');
  const typeColors = {
    info: 'bg-bg-elevated border-border text-text-primary',
    success: 'bg-success/10 border-success/30 text-success',
    warning: 'bg-warning/10 border-warning/30 text-warning',
  };
  
  toast.className = `px-4 py-3 rounded-xl border shadow-lg filter drop-shadow-sm text-sm font-medium transition-all transform pointer-events-auto ${typeColors[type]}`;
  toast.style.transform = 'translateY(20px)';
  toast.style.opacity = '0';
  toast.style.transition = 'all 300ms var(--spring)';
  toast.innerText = message;
  
  container.appendChild(toast);
  
  // Trigger animation in
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });
  
  // Remove after 4s
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.95)';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}
