import Swal from "sweetalert2";

type DeleteConfirmOptions = {
  title?: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
};

function getTheme() {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export async function showDeleteConfirm(
  options: DeleteConfirmOptions = {},
): Promise<boolean> {
  const {
    title = "Konfirmasi Hapus",
    text = "Apakah Anda yakin ingin menghapus? Tindakan ini tidak dapat dibatalkan.",
    confirmText = "Ya, hapus",
    cancelText = "Batal",
  } = options;

  const theme = getTheme();
  const isDark = theme === "dark";

  try {
    const result = await Swal.fire({
      title,
      text,
      icon: "warning",
      showCancelButton: true,
      background: isDark ? "#1A1820" : "#FCFCFA",
      iconColor: isDark ? "#E11D48" : "#BE123C",
      confirmButtonColor: isDark ? "#E11D48" : "#BE123C",
      cancelButtonColor: isDark ? "#4B5563" : "#6B7280",
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      reverseButtons: true,
      focusCancel: true,
      buttonsStyling: true,
      customClass: {
        popup: "swal-popup",
        title: "swal-title",
        htmlContainer: "swal-html",
        confirmButton: "swal-confirm-btn",
        cancelButton: "swal-cancel-btn",
        icon: "swal-icon",
      },
    });

    return result.isConfirmed;
  } catch {
    return window.confirm(`${title}\n${text}`);
  }
}
