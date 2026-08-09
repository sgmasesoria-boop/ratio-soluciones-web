(function exposeRatioPlatformApi(global) {
  const SESSION_KEY = 'ratio-platform-session-v1';
  const PASSWORD_SETUP_KEY = 'ratio-platform-password-setup-v1';

  class PlatformError extends Error {
    constructor(code, status, details) {
      super(code);
      this.name = 'PlatformError';
      this.code = code;
      this.status = status;
      this.details = details;
    }
  }

  class RatioPlatformApi {
    constructor(config, dependencies = {}) {
      const url = String(config?.supabaseUrl || '').replace(/\/$/, '');
      const anonKey = String(config?.supabaseAnonKey || '');
      if (!/^https:\/\/[^/]+\.supabase\.co$/.test(url)) throw new PlatformError('INVALID_SUPABASE_URL', 0);
      if (!anonKey || /service[_-]?role/i.test(anonKey)) throw new PlatformError('INVALID_PUBLIC_KEY', 0);
      this.url = url;
      this.anonKey = anonKey;
      this.appMode = ['crm','portal'].includes(config?.appMode) ? config.appMode : 'combined';
      this.fetch = dependencies.fetch || global.fetch.bind(global);
      this.storage = dependencies.storage || global.sessionStorage;
      this.session = this.#readSession();
    }

    #readSession() {
      try {
        const value = JSON.parse(this.storage.getItem(SESSION_KEY));
        return value?.access_token || value?.refresh_token ? value : null;
      } catch { return null; }
    }

    #storeSession(value) {
      const next = value?.session || value;
      if (!next?.access_token) return false;
      this.session = {
        ...this.session,
        ...next,
        expires_at: next.expires_at || Math.floor(Date.now() / 1000) + Number(next.expires_in || 3600)
      };
      this.storage.setItem(SESSION_KEY, JSON.stringify(this.session));
      return true;
    }

    #tokenClaims() {
      try {
        const encoded = this.session?.access_token?.split('.')[1];
        if (!encoded) return {};
        const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=');
        return JSON.parse(global.atob(normalized));
      } catch { return {}; }
    }

    async #refreshSession() {
      if (!this.session?.refresh_token) throw new PlatformError('UNAUTHENTICATED', 401);
      const refreshed = await this.#request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.session.refresh_token })
      }, false, false);
      this.#storeSession(refreshed);
    }

    async #ensureSession() {
      if (this.session?.access_token && Number(this.session.expires_at) * 1000 > Date.now() + 30000) return;
      await this.#refreshSession();
    }

    #headers(extra = {}, authenticated = true) {
      const headers = { apikey: this.anonKey, ...extra };
      if (authenticated) {
        if (!this.session?.access_token) throw new PlatformError('UNAUTHENTICATED', 401);
        headers.Authorization = `Bearer ${this.session.access_token}`;
      }
      return headers;
    }

    async #request(path, options = {}, authenticated = true, retryAuthentication = true) {
      if (authenticated) await this.#ensureSession();
      const response = await this.fetch(`${this.url}${path}`, {
        ...options,
        headers: this.#headers(options.headers, authenticated)
      });
      const type = response.headers?.get?.('content-type') || '';
      const body = type.includes('json') ? await response.json() : await response.text();
      if (response.status === 401 && authenticated && retryAuthentication && this.session?.refresh_token) {
        await this.#refreshSession();
        return this.#request(path, options, authenticated, false);
      }
      if (!response.ok) throw new PlatformError(body?.error_code || body?.code || body?.error || 'REQUEST_FAILED', response.status, body);
      return body;
    }

    async signIn(email, password) {
      const session = await this.#request('/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password })
      }, false);
      this.#storeSession(session);
      this.storage.setItem(PASSWORD_SETUP_KEY, 'completed');
      return this.session.user;
    }

    async signOut() {
      if (this.session) {
        try { await this.#request('/auth/v1/logout', { method: 'POST' }); } catch { /* La sesiÃ³n local debe cerrarse igualmente. */ }
      }
      this.session = null;
      this.storage.removeItem(SESSION_KEY);
      this.storage.removeItem(PASSWORD_SETUP_KEY);
    }

    async requestPasswordReset(email, redirectTo) {
      return this.#request('/auth/v1/recover', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, gotrue_meta_security: {}, redirect_to: redirectTo })
      }, false);
    }

    consumeUrlSession(urlValue, historyObject = global.history) {
      const url = new URL(String(urlValue));
      const values = new URLSearchParams(url.hash.replace(/^#/, ''));
      const accessToken = values.get('access_token');
      const refreshToken = values.get('refresh_token');
      const type = values.get('type');
      if (!accessToken) return null;
      this.session = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: Math.floor(Date.now() / 1000) + Number(values.get('expires_in') || 3600),
        token_type: values.get('token_type') || 'bearer'
      };
      this.storage.setItem(SESSION_KEY, JSON.stringify(this.session));
      if (!type || type === 'invite' || type === 'recovery') this.storage.setItem(PASSWORD_SETUP_KEY, 'required');
      url.hash = '';
      historyObject?.replaceState?.({}, '', `${url.pathname}${url.search}`);
      return type || 'authenticated';
    }

    requiresPasswordSetup(callbackType = null) {
      const savedState = this.storage.getItem(PASSWORD_SETUP_KEY);
      if (savedState === 'completed') return false;
      if (savedState === 'required' || callbackType === 'invite' || callbackType === 'recovery' || callbackType === 'authenticated') return true;
      try {
        const encoded = this.session?.access_token?.split('.')[1];
        if (!encoded) return false;
        const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=');
        const payload = JSON.parse(global.atob(normalized));
        const methods = Array.isArray(payload?.amr)
          ? payload.amr.map(item => typeof item === 'string' ? item : item?.method).filter(Boolean)
          : [];
        if (methods.includes('otp') && !methods.includes('password')) {
          this.storage.setItem(PASSWORD_SETUP_KEY, 'required');
          return true;
        }
      } catch { /* Un token no legible no se usa para tomar decisiones de autorizaciÃ³n. */ }
      return false;
    }

    async updatePassword(password) {
      if (typeof password !== 'string' || password.length < 12) throw new PlatformError('WEAK_PASSWORD', 400);
      const result = await this.#request('/auth/v1/user', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password })
      });
      this.storage.setItem(PASSWORD_SETUP_KEY, 'completed');
      return result;
    }

    async currentUser() {
      if (!this.session) return null;
      return this.#request('/auth/v1/user');
    }

    assuranceLevel() {
      return this.#tokenClaims()?.aal || 'aal1';
    }

    async enrollTotp(friendlyName = 'Ratio Soluciones') {
      return this.#request('/auth/v1/factors', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ factor_type: 'totp', friendly_name: friendlyName })
      });
    }

    async challengeMfa(factorId) {
      if (!/^[0-9a-f-]{36}$/i.test(factorId)) throw new PlatformError('INVALID_FACTOR', 400);
      return this.#request(`/auth/v1/factors/${encodeURIComponent(factorId)}/challenge`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}'
      });
    }

    async verifyMfa(factorId, challengeId, code) {
      if (!/^[0-9a-f-]{36}$/i.test(factorId) || !/^[0-9a-f-]{36}$/i.test(challengeId) || !/^\d{6,8}$/.test(String(code || ''))) {
        throw new PlatformError('INVALID_MFA_CODE', 400);
      }
      const verified = await this.#request(`/auth/v1/factors/${encodeURIComponent(factorId)}/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId, code: String(code) })
      });
      this.#storeSession(verified);
      return verified;
    }

    async unenrollFactor(factorId) {
      if (!/^[0-9a-f-]{36}$/i.test(factorId)) throw new PlatformError('INVALID_FACTOR', 400);
      return this.#request(`/auth/v1/factors/${encodeURIComponent(factorId)}`, { method: 'DELETE' });
    }

    async loadProfile(userId) {
      const profiles = await this.select('profiles', `select=id,display_name,internal_role,active&id=eq.${encodeURIComponent(userId)}&limit=1`);
      return profiles[0] || null;
    }

    async select(table, query = '') {
      return this.#request(`/rest/v1/${encodeURIComponent(table)}?${query}`, {
        headers: { Accept: 'application/json' }
      });
    }

    async insert(table, record, select = '*') {
      return this.#request(`/rest/v1/${encodeURIComponent(table)}?select=${encodeURIComponent(select)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(record)
      });
    }

    async update(table, filters, changes) {
      return this.#request(`/rest/v1/${encodeURIComponent(table)}?${filters}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(changes)
      });
    }

    async invoke(functionName, payload) {
      if (!/^[a-z0-9-]+$/.test(functionName)) throw new PlatformError('INVALID_FUNCTION_NAME', 0);
      return this.#request(`/functions/v1/${functionName}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    async loadWorkspace(userId = '') {
      const includeCrm = this.appMode !== 'portal';
      const [profile, cases, events, notifications, leads, tasks] = await Promise.all([
        this.select('profiles', `select=id,display_name,internal_role,active${userId?`&id=eq.${encodeURIComponent(userId)}`:''}&limit=1`),
        this.select('cases', 'select=id,reference,client_id,client_name,title,category,status,summary,client_next_step,professional_name,professional_title,professional_registration,professional_region,opened_at,closed_at&order=opened_at.desc'),
        this.select('case_events', 'select=id,case_id,event_type,title,description,visibility,stage,occurred_at&order=occurred_at.asc'),
        this.select('notifications', 'select=id,user_id,case_id,notification_type,title,body,read_at,created_at&order=created_at.desc'),
        includeCrm ? this.select('crm_leads', 'select=id,reference,full_name,phone,email,province,category,source,summary,status,next_action,follow_up_on,quoted_amount,privacy_notice_at,legal_basis,converted_case_id,created_at,updated_at&order=created_at.desc') : Promise.resolve([]),
        includeCrm ? this.select('crm_tasks', 'select=id,lead_id,case_id,title,due_on,priority,assigned_to,completed_at,created_at&order=due_on.asc') : Promise.resolve([])
      ]);
      return { profile: profile[0] || null, cases, events, notifications, leads, tasks };
    }
  }

  global.RatioPlatformApi = RatioPlatformApi;
  global.RatioPlatformError = PlatformError;
})(window);

