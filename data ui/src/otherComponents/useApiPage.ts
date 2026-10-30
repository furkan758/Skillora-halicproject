import axios from "axios";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { PageResult, RequestStatus } from "../types";
import { apiError } from "./errors";
import { emptyPage, pageControls } from "./serverPage";

export function useApiPage<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  revision = 0,
) {
  const key =
    path +
    "?" +
    new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
  const [selection, setSelection] = useState({ key, page: 1 });
  const page = selection.key === key ? selection.page : 1;
  const [data, setData] = useState<PageResult<T>>(emptyPage());
  const [status, setStatus] = useState<RequestStatus>("loading");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setError("");
    api
      .get<PageResult<T>>(key, { params: { page }, signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        if (page > Math.max(1, data.totalPages)) {
          setSelection({ key, page: Math.max(1, data.totalPages) });
          return;
        }
        setData(data);
        setStatus("succeeded");
      })
      .catch((error) => {
        if (controller.signal.aborted || axios.isCancel(error)) return;
        setError(apiError(error).message);
        setStatus("failed");
      });
    return () => controller.abort();
  }, [key, page, revision, retry]);
  return {
    ...pageControls(data, (next) => setSelection({ key, page: next })),
    status,
    error,
    retry: () => setRetry((n) => n + 1),
  };
}
