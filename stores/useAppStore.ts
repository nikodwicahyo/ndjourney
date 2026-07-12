import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CoupleConfig, User } from "@/types";

type ModalType = "upload-photo" | "add-milestone" | "add-wish" | "confirm";

interface AppState {
  coupleConfig: CoupleConfig | null;
  user: (User & { role?: string }) | null;
  sidebarOpen: boolean;
  activeModal: ModalType | null;
  modalData: unknown;
  theme: "light" | "dark" | "system";
  isLoading: boolean;

  setCoupleConfig: (config: CoupleConfig) => void;
  setUser: (user: User & { role?: string }) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  openModal: (modal: ModalType, data?: unknown) => void;
  closeModal: () => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      coupleConfig: null,
      user: null,
      sidebarOpen: false,
      activeModal: null,
      modalData: null,
      theme: "system",
      isLoading: false,

      setCoupleConfig: (config) => set({ coupleConfig: config }),
      setUser: (user) => set({ user }),
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      openModal: (modal, data) =>
        set({ activeModal: modal, modalData: data }),
      closeModal: () => set({ activeModal: null, modalData: null }),
      setTheme: (theme) => set({ theme }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: "ndjourney-store",
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
);
