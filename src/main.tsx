import { StrictMode } from 'react'
import * as ReactDOM from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App'
import GlobalErrorBoundary from './components/GlobalErrorBoundary'
import { installSubscriptionInterceptor } from './lib/subscription-interceptor'

// Install global 402 handler before any fetch calls are made
installSubscriptionInterceptor();

// ADA/WCAG Accessibility audit disabled (requires @axe-core/react)

console.log("🚀 MAIN.TSX IS EXECUTING!");

// Log unhandled errors
window.addEventListener('error', (event) => {
  console.error('Unhandled error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
)