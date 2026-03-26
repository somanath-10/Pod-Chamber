import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface SessionState {
    email: string;
    roomId: string;
    socket: any | null;
}

const initialState: SessionState = {
    email: '',
    roomId: '',
    socket: null
};

export const sessionSlice = createSlice({
    name: 'session',
    initialState,
    reducers: {
        setEmail: (state, action: PayloadAction<string>) => {
            state.email = action.payload;
        },
        setRoomId: (state, action: PayloadAction<string>) => {
            state.roomId = action.payload;
        },
        setSocket: (state, action: PayloadAction<any>) => {
            state.socket = action.payload;
        },
        clearSession: (state) => {
            state.email = '';
            state.roomId = '';
            state.socket = null;
        }
    }
});

export const { setEmail, setRoomId, setSocket, clearSession } = sessionSlice.actions;
export default sessionSlice.reducer;
