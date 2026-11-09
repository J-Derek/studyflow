import { useShallow } from 'zustand/react/shallow';
import { accountView, type AccountView } from '../utils/accountView';
import { useStudyFlowStore } from './studyFlowStore';

/** Who the header and sidebar should show as signed in (see utils/accountView for why this is not just `isAnonymous`). */
export function useAccountView(): AccountView {
  return useStudyFlowStore(useShallow(accountView));
}
