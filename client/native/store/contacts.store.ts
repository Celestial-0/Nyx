import type { ContactEntry } from '@/types';
import { create } from 'zustand';

/** Contacts store. Ported from web `features/contacts/contacts.store.ts`. */

type ContactsState = {
  contacts: ContactEntry[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
};

type ContactsActions = {
  setStatus: (status: ContactsState['status']) => void;
  setError: (error: string | null) => void;
  setContacts: (contacts: ContactEntry[]) => void;
  upsertContact: (contact: ContactEntry) => void;
  removeContact: (contactUserId: string) => void;
  reset: () => void;
};

type ContactsStore = ContactsState & ContactsActions;

const initialState: ContactsState = {
  contacts: [],
  status: 'idle',
  error: null,
};

export const useContactsStore = create<ContactsStore>((set) => ({
  ...initialState,
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setContacts: (contacts) => set({ contacts, status: 'ready', error: null }),
  upsertContact: (contact) =>
    set((state) => ({
      contacts: [
        ...state.contacts.filter((item) => item.user.id !== contact.user.id),
        contact,
      ],
      status: 'ready',
      error: null,
    })),
  removeContact: (contactUserId) =>
    set((state) => ({
      contacts: state.contacts.filter((item) => item.user.id !== contactUserId),
      status: 'ready',
      error: null,
    })),
  reset: () => set({ ...initialState }),
}));
