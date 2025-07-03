import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { BrowserRouter } from 'react-router-dom'

// 防呆：避免 window.ethereum 造成不必要的錯誤
if (typeof window !== "undefined" && window.ethereum) {
  try {
    // 這裡什麼都不用做，只是預防有套件亂操作 window.ethereum 出錯
  } catch (e) {
    // 可以選擇 log 錯誤，但通常不用
    // console.error('ethereum provider error:', e);
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
    <App />
    </BrowserRouter>
  </React.StrictMode>
)
