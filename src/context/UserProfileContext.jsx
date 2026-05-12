import { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "userProfile";
const DEFAULT_PROFILE = {
  name: "",
  location: "",
  phone: "",
  email: "",
  profileComplete: false,
};

const UserProfileContext = createContext({
  userProfile: DEFAULT_PROFILE,
  updateUserProfile: () => {},
  resetUserProfile: () => {},
});

function readFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function UserProfileProvider({ children }) {
  const [userProfile, setUserProfile] = useState(readFromStorage);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userProfile));
    } catch {}
  }, [userProfile]);

  const updateUserProfile = useCallback((patch) => {
    setUserProfile((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetUserProfile = useCallback(() => {
    setUserProfile({ ...DEFAULT_PROFILE });
  }, []);

  return (
    <UserProfileContext.Provider value={{ userProfile, updateUserProfile, resetUserProfile }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  return useContext(UserProfileContext);
}
