import React from 'react'
import { observer } from 'mobx-react'
import { useStore } from 'store/main'

export const ToastContainer = observer(function ToastContainer() {
  const { ui } = useStore()

  if (ui.toastList.length === 0) return null

  return (
    <div className="app-toast-container">
      {ui.toastList.map(toast => {
        const iconChar =
          toast.type === 'success' ? '✓' :
          toast.type === 'warning' ? '!' :
          toast.type === 'error' ? '✕' : 'ℹ'

        return (
          <div key={toast.id} className={`app-toast ${toast.type}`} role="alert">
            <div className="app-toast-icon">{iconChar}</div>
            <div className="app-toast-text">{toast.text}</div>
            <button
              type="button"
              className="app-toast-close"
              aria-label="Close"
              onClick={() => ui.removeToast(toast.id)}
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
})

export default ToastContainer
