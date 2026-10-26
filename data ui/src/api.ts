import axios from "axios";
import { installDemoApi } from "./mockDatas/demoApi";

const env = import.meta.env || {};
export const api = axios.create({
  baseURL: env.VITE_API_URL || "/api",
  timeout: 10000,
});
// All demo endpoints run in this browser. No backend is created.
if (env.VITE_USE_MOCKS !== "false") installDemoApi(api);
