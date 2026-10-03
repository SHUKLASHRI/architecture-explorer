/**
 * Prompts the user with the native Windows Explorer folder selection dialog.
 * Works seamlessly across both the standalone native desktop app (pywebview)
 * and all web browsers by coordinating with the local backend dialog service.
 */
export async function promptNativeFolderChooser(initialPath?: string): Promise<string | null> {
  // 1. Native desktop window API (pywebview)
  const pyApi = (window as any).pywebview?.api;
  if (pyApi) {
    if (typeof pyApi.choose_folder === 'function') {
      try {
        const chosen = await pyApi.choose_folder();
        if (chosen) return chosen;
      } catch (e) {
        console.warn('pywebview choose_folder error:', e);
      }
    }
    if (typeof pyApi.open_folder_dialog === 'function') {
      try {
        const chosen = await pyApi.open_folder_dialog();
        if (chosen) return chosen;
      } catch (e) {
        console.warn('pywebview open_folder_dialog error:', e);
      }
    }
  }

  // 2. Backend native Windows Explorer dialog service
  try {
    const res = await fetch('/api/choose-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initial_dir: initialPath || '' }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.path) {
        return data.path;
      }
      if (data.cancelled) {
        return null;
      }
    }
  } catch (err) {
    console.warn('Backend choose-folder API error:', err);
  }

  return null;
}
