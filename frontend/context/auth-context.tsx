import React, { createContext, useContext, useState } from 'react';

type AuthContextType = {
  isAuthenticated: boolean;
  pendingPhone: string;
  userGender: 'male' | 'female' | null;
  /** True when OTP was verified for a brand-new (unregistered) user */
  isNewUser: boolean;
  signIn: (phone: string, isNew?: boolean) => void;
  signOut: () => void;
  clearPendingPhone: () => void;
  setUserGender: (gender: 'male' | 'female') => void;
};

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  pendingPhone: '',
  userGender: null,
  isNewUser: false,
  signIn: () => {},
  signOut: () => {},
  clearPendingPhone: () => {},
  setUserGender: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pendingPhone, setPendingPhone] = useState('');
  const [userGender, setUserGender] = useState<'male' | 'female' | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        pendingPhone,
        userGender,
        isNewUser,
        signIn: (phone: string, isNew = false) => {
          setPendingPhone(phone);
          setIsNewUser(isNew);
          setIsAuthenticated(true);
        },
        signOut: () => {
          setPendingPhone('');
          setUserGender(null);
          setIsNewUser(false);
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
