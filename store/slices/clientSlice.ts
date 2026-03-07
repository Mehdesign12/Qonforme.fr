import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Client } from '@/types'

interface ClientState {
  items: Client[]
  loading: boolean
}

const initialState: ClientState = {
  items: [],
  loading: false,
}

const clientSlice = createSlice({
  name: 'clients',
  initialState,
  reducers: {
    setClients(state, action: PayloadAction<Client[]>) {
      state.items = action.payload
      state.loading = false
    },
    addClient(state, action: PayloadAction<Client>) {
      state.items.unshift(action.payload)
    },
    updateClient(state, action: PayloadAction<Client>) {
      const index = state.items.findIndex((c) => c.id === action.payload.id)
      if (index !== -1) state.items[index] = action.payload
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
  },
})

export const { setClients, addClient, updateClient, setLoading } = clientSlice.actions
export default clientSlice.reducer
