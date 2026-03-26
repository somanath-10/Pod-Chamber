import { configureStore } from '@reduxjs/toolkit';
import sessionReducer from './slices/sessionSlice';

export const store = configureStore({
    reducer: {
        session: sessionReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                // Ignore these paths in the state
                ignoredPaths: ['session.socket'],
                // Ignore these action types
                ignoredActions: ['session/setSocket'],
            },
        }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
