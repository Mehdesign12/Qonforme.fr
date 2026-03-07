import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Invoice } from '@/types'

interface InvoiceState {
  items: Invoice[]
  loading: boolean
  currentInvoice: Invoice | null
}

const initialState: InvoiceState = {
  items: [],
  loading: false,
  currentInvoice: null,
}

const invoiceSlice = createSlice({
  name: 'invoices',
  initialState,
  reducers: {
    setInvoices(state, action: PayloadAction<Invoice[]>) {
      state.items = action.payload
      state.loading = false
    },
    addInvoice(state, action: PayloadAction<Invoice>) {
      state.items.unshift(action.payload)
    },
    updateInvoice(state, action: PayloadAction<Invoice>) {
      const index = state.items.findIndex((i) => i.id === action.payload.id)
      if (index !== -1) state.items[index] = action.payload
    },
    setCurrentInvoice(state, action: PayloadAction<Invoice | null>) {
      state.currentInvoice = action.payload
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
  },
})

export const { setInvoices, addInvoice, updateInvoice, setCurrentInvoice, setLoading } =
  invoiceSlice.actions
export default invoiceSlice.reducer
