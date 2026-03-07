import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface UIState {
  sidebarOpen: boolean
  notification: {
    type: 'success' | 'error' | 'info' | null
    message: string | null
  }
}

const initialState: UIState = {
  sidebarOpen: true,
  notification: { type: null, message: null },
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload
    },
    setNotification(
      state,
      action: PayloadAction<{ type: 'success' | 'error' | 'info'; message: string }>
    ) {
      state.notification = action.payload
    },
    clearNotification(state) {
      state.notification = { type: null, message: null }
    },
  },
})

export const { toggleSidebar, setSidebarOpen, setNotification, clearNotification } =
  uiSlice.actions
export default uiSlice.reducer
