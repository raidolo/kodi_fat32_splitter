import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProviderWrapper } from './auth/AuthProviderWrapper'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProviderWrapper>
      <App />
    </AuthProviderWrapper>
  </React.StrictMode>,
)
