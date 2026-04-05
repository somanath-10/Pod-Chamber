import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface SessionState {
    email: string;
    roomId: string;
}

const initialState: SessionState = {
    email: '',
    roomId: '',
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
        clearSession: (state) => {
            state.email = '';
            state.roomId = '';
        }
    }
});

export const { setEmail, setRoomId, clearSession } = sessionSlice.actions;
export default sessionSlice.reducer;
