import React from 'react';
import { TriangleAlert } from 'lucide-react';
import { backupFromSavedCopy, downloadBackup } from '../utils/exportBackup';

interface Props {
  children: React.ReactNode;
  /** "page" keeps the menus around a broken page usable; "app" is the last line of defence around everything. */
  scope?: 'page' | 'app';
}

interface State {
  failed: boolean;
  /** Set when the student pressed "Download my data" and there was nothing readable to save. */
  noData: boolean;
}

const STORAGE_KEY = 'studyflow_storage_v1';

/**
 * If a screen crashes while drawing, show a calm page instead of a blank one. The student's records are not
 * touched: they are on this device (and in their account), so Reload brings them back, and "Download my data"
 * saves a copy straight from the saved data on this device without going through the part that broke.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false, noData: false };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    console.error('StudyFlow screen error:', error);
  }

  private download = () => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    const backup = backupFromSavedCopy(raw);
    if (!backup) {
      this.setState({ noData: true });
      return;
    }
    downloadBackup(backup);
    this.setState({ noData: false });
  };

  render(): React.ReactNode {
    if (!this.state.failed) return this.props.children;
    const full = this.props.scope === 'app';
    return (
      <div
        role="alert"
        data-testid="error-screen"
        className={`${full ? 'min-h-screen flex items-center justify-center p-6 bg-canvas-light dark:bg-canvas-dark text-zinc-900 dark:text-zinc-100' : 'py-10'}`}
      >
        <div className="max-w-md mx-auto text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
            <TriangleAlert className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              This screen could not be shown. Your plan has not been deleted: it is saved on this device and in your account if you are signed in.
              Reload to try again.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] px-5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-white cursor-pointer"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={this.download}
              className="min-h-[44px] px-5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-100 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Download my data
            </button>
          </div>
          {this.state.noData && (
            <p className="text-xs text-zinc-700 dark:text-zinc-300">There is no saved copy on this device to download. If you are signed in, your plan is in your account.</p>
          )}
        </div>
      </div>
    );
  }
}
