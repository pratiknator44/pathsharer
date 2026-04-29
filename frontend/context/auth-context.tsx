import React, { createContext, useContext, useState } from 'react';

type AuthContextType = {
  isAuthenticated: boolean;
  pendingPhone: string;
  userGender: 'male' | 'female' | null;
  signIn: (phone: string) => void;
  signOut: () => void;
  clearPendingPhone: () => void;
  setUserGender: (gender: 'male' | 'female') => void;
};

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  pendingPhone: '',
  userGender: null,
  signIn: () => {},
  signOut: () => {},
  clearPendingPhone: () => {},
  setUserGender: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pendingPhone, setPendingPhone] = useState('');
  const [userGender, setUserGender] = useState<'male' | 'female' | null>(null);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        pendingPhone,
        userGender,
        signIn: (phone: string) => {
          setPendingPhone(phone);
          setIsAuthenticated(true);
        },
        signOut: () => {
          setPendingPhone('');
          setUserGender(null);
          setIsAuthenticated(false);
        },
        clearPendingPhone: () => setPendingPhone(''),
        setUserGender,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
