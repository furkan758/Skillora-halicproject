import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { readDraft, removeDraft, writeDraft } from "./draftStorage";
export function useFormDraft<T>(
  key: string,
  initial: T,
  validate: (value: unknown) => value is T,
) {
  const [restored] = useState(() => readDraft(key, validate));
  const [form, update] = useState<T>(() => restored ?? initial);
  const [storageError, setStorageError] = useState("");
  const current = useRef(form);
  const enabled = useRef(true);
  current.current = form;
  const setForm: Dispatch<SetStateAction<T>> = useCallback((value) => {
    enabled.current = true;
    update(value);
  }, []);
  useEffect(() => {
    const persist = () => {
      if (enabled.current)
        setStorageError(
          writeDraft(key, current.current)
            ? ""
            : "This browser could not save the draft. Keep this page open until you save.",
        );
    };
    persist();
    window.addEventListener("beforeunload", persist);
    return () => window.removeEventListener("beforeunload", persist);
  }, [key, form]);
  const clear = () => {
    enabled.current = false;
    removeDraft(key);
  };
  return { form, setForm, clear, restored: restored !== null, storageError };
}
