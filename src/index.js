import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
// ביטול PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for (let registration of registrations) {
      registration.unregister();
    }
  });
}

// פונקציית רטט והתראות גלובלית
window.testFeatures = function() {
  if (navigator.vibrate) navigator.vibrate(200);
  if ("Notification" in window) {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") new Notification("הבדיקה הצליחה!");
    });
  }
};
