import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProviderWrapper } from './auth/AuthProviderWrapper'
import App from './App.jsx'
import './index.css'

import { BrowserRouter } from 'react-router-dom'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProviderWrapper>
        <App />
      </AuthProviderWrapper>
    </BrowserRouter>
  </React.StrictMode>,
)
