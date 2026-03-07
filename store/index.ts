import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import invoiceReducer from './slices/invoiceSlice'
import clientReducer from './slices/clientSlice'
import uiReducer from './slices/uiSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    invoices: invoiceReducer,
    clients: clientReducer,
    ui: uiReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
