import { apiUrl, resolveApiBaseUrl } from "@/lib/api-base";

export type User = {
  id: string;
  email: string;
  raw_user_meta_data?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  last_sign_in_at?: string | null;
};

export type Session = {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
};

type OAuthProvider = "google";

type ApiOk<T> = { data: T; error: null; count?: number };
type ApiErr = { data: null; error: { message: string }; count?: number };
type ApiResult<T> = ApiOk<T> | ApiErr;

type SelectOptions = {
  count?: "exact";
  head?: boolean;
};

type Filter =
  | { column: string; op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "ilike"; value: any }
  | { column: string; op: "is" | "not_is"; value: any }
  | { column: string; op: "in" | "contains" | "overlaps"; value: any[] };

type Order = { column: string; ascending: boolean };

type QueryState = {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  select?: string;
  filters: Filter[];
  or?: string;
  orders: Order[];
  limit?: number;
  offset?: number;
  values?: any;
  single?: boolean;
  maybeSingle?: boolean;
  count?: "exact";
  head?: boolean;
  on_conflict?: string;
  ignore_duplicates?: boolean;
  upsert?: boolean;
};

const SESSION_KEY = "brasa.session";
const LISTENERS = new Set<(event: string, session: Session | null) => void>();

function parseSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  return parseSession(window.localStorage.getItem(SESSION_KEY));
}

function writeSession(session: Session | null) {
  if (typeof window === "undefined") return;
  if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else window.localStorage.removeItem(SESSION_KEY);
}

function emit(event: string, session: Session | null) {
  LISTENERS.forEach((listener) => {
    try {
      listener(event, session);
    } catch {
      // ignore listener failures
    }
  });
}

function normalizeUser(user: any): User {
  return {
    id: String(user.id),
    email: String(user.email ?? ""),
    raw_user_meta_data: user.raw_user_meta_data ?? {},
    created_at: user.created_at ?? undefined,
    updated_at: user.updated_at ?? undefined,
    last_sign_in_at: user.last_sign_in_at ?? null,
  };
}

function normalizeSession(payload: any): Session | null {
  const token = payload?.access_token ?? payload?.session?.access_token ?? payload?.token;
  if (!token) return null;
  const user = payload?.user ?? payload?.session?.user;
  if (user) {
    return {
      access_token: token,
      token_type: payload?.token_type ?? payload?.session?.token_type ?? "bearer",
      expires_in: Number(payload?.expires_in ?? payload?.session?.expires_in ?? 0),
      user: normalizeUser(user),
    };
  }
  return null;
}

function normalizeMediaUrl(url: string | null | undefined) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;

  const base = resolveMediaBaseUrl();
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

function resolveMediaBaseUrl() {
  // Media URLs should resolve against the backend API, not the current page.
  const apiBase = resolveApiBaseUrl().replace(/\/$/, "");
  return apiBase.endsWith("/") ? apiBase : `${apiBase}/`;
}

async function apiFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const session = readSession();
  if (session?.access_token) {
    headers.set("authorization", `Bearer ${session.access_token}`);
  }
  const body = init?.body instanceof FormData ? init.body : init?.body;
  return fetch(apiUrl(path), {
    ...init,
    headers,
    body,
  });
}

async function parseResult<T>(response: Response): Promise<ApiResult<T>> {
  const text = await response.text();
  let json: any = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { error: { message: text } };
    }
  }
  if (!response.ok) {
    const message = json?.error?.message ?? json?.message ?? response.statusText;
    return { data: null, error: { message } };
  }
  if (json && typeof json === "object" && "error" in json && json.error) {
    return { data: null, error: { message: json.error.message ?? "Request failed" } };
  }
  return json as ApiResult<T>;
}

async function postJson<T>(path: string, payload: unknown): Promise<ApiResult<T>> {
  const response = await apiFetch(path, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json" },
  });
  return parseResult<T>(response);
}

class AuthClient {
  private session: Session | null = readSession();

  private setSessionInternal(session: Session | null, event = "SIGNED_IN") {
    this.session = session;
    writeSession(session);
    emit(event, session);
  }

  private async hydrateSessionFromToken(token: string): Promise<Session | null> {
    const response = await fetch(apiUrl("/api/auth/me"), {
      headers: { authorization: `Bearer ${token}` },
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.data?.user) return null;
    return {
      access_token: token,
      token_type: "bearer",
      expires_in: Number(json?.data?.expires_in ?? 0),
      user: normalizeUser(json.data.user),
    };
  }

  async getSession() {
    this.session ??= readSession();
    return { data: { session: this.session }, error: null };
  }

  async getUser() {
    const session = this.session ?? readSession();
    if (!session?.access_token) {
      return { data: { user: null }, error: null };
    }
    const hydrated = await this.hydrateSessionFromToken(session.access_token);
    if (!hydrated) {
      this.setSessionInternal(null, "SIGNED_OUT");
      return { data: { user: null }, error: null };
    }
    this.setSessionInternal(hydrated, "TOKEN_REFRESHED");
    return { data: { user: hydrated.user }, error: null };
  }

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const result = await postJson<{ user: User; session: Session }>("/api/auth/login", { email, password });
    if (result.error) return result;
    const session = normalizeSession(result.data);
    if (!session) return { data: null, error: { message: "Invalid login response" } };
    this.setSessionInternal(session, "SIGNED_IN");
    return { data: { user: session.user, session }, error: null };
  }

  async signUp({
    email,
    password,
    options,
  }: {
    email: string;
    password: string;
    options?: { emailRedirectTo?: string; data?: Record<string, unknown> };
  }) {
    const result = await postJson<{ user: User; session: Session }>("/api/auth/signup", {
      email,
      password,
      options,
    });
    if (result.error) return result;
    const session = normalizeSession(result.data);
    if (!session) return { data: null, error: { message: "Invalid sign-up response" } };
    this.setSessionInternal(session, "SIGNED_IN");
    return { data: { user: session.user, session }, error: null };
  }

  async signInWithOAuth(provider: OAuthProvider, options?: { redirectTo?: string }) {
    const result = await postJson<{ url: string }>("/api/auth/oauth/google", {
      provider,
      redirect_to: options?.redirectTo,
    });
    if (result.error) return { data: null, error: result.error, redirected: false };
    if (!result.data?.url) return { data: null, error: { message: "Invalid OAuth response" }, redirected: false };

    if (typeof window !== "undefined") {
      window.location.assign(result.data.url);
      return { data: result.data, error: null, redirected: true };
    }

    return { data: result.data, error: null, redirected: false };
  }

  async setSession(tokens: any) {
    const normalized = normalizeSession(tokens);
    if (normalized) {
      this.setSessionInternal(normalized, "SIGNED_IN");
      return { data: { session: normalized }, error: null };
    }

    const token = tokens?.access_token ?? tokens?.session?.access_token;
    if (token) {
      const hydrated = await this.hydrateSessionFromToken(token);
      if (hydrated) {
        this.setSessionInternal(hydrated, "SIGNED_IN");
        return { data: { session: hydrated }, error: null };
      }
    }

    return { data: { session: null }, error: { message: "Invalid session" } };
  }

  async signOut() {
    this.setSessionInternal(null, "SIGNED_OUT");
    await apiFetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => {});
    return { error: null };
  }

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    LISTENERS.add(callback);
    queueMicrotask(() => callback("INITIAL_SESSION", this.session ?? readSession()));
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            LISTENERS.delete(callback);
          },
        },
      },
    };
  }
}

class QueryBuilder {
  private state: QueryState;

  constructor(private table: string, op: QueryState["op"] = "select") {
    this.state = { table, op, filters: [], orders: [] };
  }

  select(select: string, options?: SelectOptions) {
    // Preserve write operations like insert/upsert. In the UI we chain
    // `.select()` after inserts to request returned rows, not to switch the
    // query back into a plain select.
    if (this.state.op === "select") {
      this.state.op = "select";
    }
    this.state.select = select;
    this.state.count = options?.count;
    this.state.head = options?.head;
    return this;
  }

  eq(column: string, value: any) {
    this.state.filters.push({ column, op: "eq", value });
    return this;
  }

  neq(column: string, value: any) {
    this.state.filters.push({ column, op: "neq", value });
    return this;
  }

  gt(column: string, value: any) {
    this.state.filters.push({ column, op: "gt", value });
    return this;
  }

  gte(column: string, value: any) {
    this.state.filters.push({ column, op: "gte", value });
    return this;
  }

  lt(column: string, value: any) {
    this.state.filters.push({ column, op: "lt", value });
    return this;
  }

  lte(column: string, value: any) {
    this.state.filters.push({ column, op: "lte", value });
    return this;
  }

  is(column: string, value: any) {
    this.state.filters.push({ column, op: "is", value });
    return this;
  }

  not(column: string, operator: string, value: any) {
    if (operator === "is" && value === null) {
      this.state.filters.push({ column, op: "not_is", value });
    }
    return this;
  }

  in(column: string, values: any[]) {
    this.state.filters.push({ column, op: "in", value: values });
    return this;
  }

  ilike(column: string, value: string) {
    this.state.filters.push({ column, op: "ilike", value });
    return this;
  }

  contains(column: string, value: any[]) {
    this.state.filters.push({ column, op: "contains", value });
    return this;
  }

  overlaps(column: string, value: any[]) {
    this.state.filters.push({ column, op: "overlaps", value });
    return this;
  }

  or(expression: string) {
    this.state.or = expression;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.state.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(value: number) {
    this.state.limit = value;
    return this;
  }

  offset(value: number) {
    this.state.offset = value;
    return this;
  }

  single() {
    this.state.single = true;
    return this;
  }

  maybeSingle() {
    this.state.maybeSingle = true;
    return this;
  }

  insert(values: any, options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.state.op = "insert";
    this.state.values = values;
    this.state.on_conflict = options?.onConflict;
    this.state.ignore_duplicates = options?.ignoreDuplicates ?? false;
    return this;
  }

  upsert(values: any, options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.state.op = "insert";
    this.state.values = values;
    this.state.on_conflict = options?.onConflict;
    this.state.ignore_duplicates = options?.ignoreDuplicates ?? false;
    this.state.upsert = true;
    return this;
  }

  update(values: any) {
    this.state.op = "update";
    this.state.values = values;
    return this;
  }

  delete() {
    this.state.op = "delete";
    return this;
  }

  async execute(): Promise<ApiResult<any>> {
    const result = await postJson<any>("/api/query", this.state);
    if (result.error) return result;
    let data = result.data;
    if (this.state.single || this.state.maybeSingle) {
      if (Array.isArray(data)) {
        data = data[0] ?? null;
      }
      if (this.state.single && !data) {
        return { data: null, error: { message: "No rows returned" } };
      }
    }
    if (this.state.head) {
      return { data: null, error: null, count: result.count };
    }
    return { data, error: null, count: result.count };
  }

  then<TResult1 = ApiResult<any>, TResult2 = never>(
    onfulfilled?: ((value: ApiResult<any>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class StorageBucketClient {
  constructor(private bucket: string) {}

  async upload(path: string, file: File, options?: { upsert?: boolean; contentType?: string }) {
    const form = new FormData();
    form.append("file", file);
    form.append("path", path);
    form.append("upsert", String(options?.upsert ?? false));
    if (options?.contentType) form.append("contentType", options.contentType);
    const response = await apiFetch(`/api/storage/${this.bucket}/upload`, {
      method: "POST",
      body: form,
    });
    return parseResult<{ path: string }>(response);
  }

  async createSignedUrl(path: string, expiresIn = 3600) {
    const result = await postJson<{ signedUrl: string }>(`/api/storage/${this.bucket}/signed-url`, {
      path,
      expires_in: expiresIn,
    });
    if (result.error || !result.data) return result;
    return {
      ...result,
      data: {
        signedUrl: normalizeMediaUrl(result.data.signedUrl) ?? result.data.signedUrl,
      },
    };
  }

  async createSignedUrls(paths: string[], expiresIn = 3600) {
    const result = await postJson<Array<{ path: string; signedUrl: string }>>(
      `/api/storage/${this.bucket}/signed-urls`,
      {
        paths,
        expires_in: expiresIn,
      },
    );
    if (result.error || !result.data) return result;
    return {
      ...result,
      data: result.data.map((item) => ({
        ...item,
        signedUrl: normalizeMediaUrl(item.signedUrl) ?? item.signedUrl,
      })),
    };
  }

  async remove(paths: string[]) {
    return postJson<string[]>(`/api/storage/${this.bucket}/remove`, { paths });
  }
}

class StorageClient {
  from(bucket: string) {
    return new StorageBucketClient(bucket);
  }
}

type Channel = {
  on: (...args: any[]) => Channel;
  subscribe: () => Channel;
  unsubscribe: () => void;
};

class RealtimeClient {
  channel(_name: string): Channel {
    const channel: Channel = {
      on: () => channel,
      subscribe: () => channel,
      unsubscribe: () => undefined,
    };
    return channel;
  }

  removeChannel(_channel: Channel) {
    return Promise.resolve(_channel);
  }
}

class BackendClient {
  auth = new AuthClient();
  storage = new StorageClient();
  private realtime = new RealtimeClient();

  from(table: string) {
    return new QueryBuilder(table);
  }

  rpc(name: string, params: Record<string, unknown>) {
    return postJson(`/api/rpc/${name}`, params);
  }

  channel(name: string) {
    return this.realtime.channel(name);
  }

  removeChannel(channel: Channel) {
    return this.realtime.removeChannel(channel);
  }
}

export const api = new BackendClient();
