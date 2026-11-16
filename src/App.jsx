if (!user) {
    return (
      <main className="splash-screen">
        <div className="splash-container">
          <img
            src="https://i.ibb.co/k26Rwf4W/2-A218-D70-26-E3-4-F54-B5-EF-09-B96-B3-DE067.png"
            alt="سوداشات"
            className="splash-image"
          />

          {/* أزرار تفاعلية واضحة وأسفل الصورة تضمن الاستجابة الفورية 100% */}
          {authMode === "welcome" && (
            <div className="splash-buttons-overlay">
              <button
                type="button"
                className="primary wa-btn splash-main-btn"
                onClick={() => {
                  setAuthMode("register");
                  setError("");
                  setEmail("");
                  setPassword("");
                }}
              >
                إنشاء حساب جديد
              </button>

              <button
                type="button"
                className="secondary wa-btn-outline splash-main-btn"
                onClick={() => {
                  setAuthMode("login");
                  setError("");
                  setEmail("");
                  setPassword("");
                }}
              >
                تسجيل الدخول
              </button>
            </div>
          )}

          {authMode !== "welcome" && (
            <div className="auth-modal-backdrop">
              <section className="auth-modal-card">
                <div className="modal-header">
                  <h2>
                    {authMode === "register"
                      ? "إنشاء حساب جديد"
                      : "تسجيل الدخول"}
                  </h2>
                  <button
                    type="button"
                    className="close-modal-btn"
                    onClick={() => {
                      setAuthMode("welcome");
                      setError("");
                    }}
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleAuth}>
                  <label>البريد الإلكتروني</label>
                  <div className="field">
                    <Mail size={18} />
                    <input
                      type="email"
                      dir="ltr"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="example@gmail.com"
                      required
                    />
                  </div>

                  <label>كلمة المرور</label>
                  <div className="field">
                    <Lock size={18} />
                    <input
                      type="password"
                      dir="ltr"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="6 أحرف على الأقل"
                      minLength={6}
                      required
                    />
                  </div>

                  <button type="submit" className="primary wa-btn auth-submit-btn" disabled={busy}>
                    {busy
                      ? "يرجى الانتظار..."
                      : authMode === "register"
                        ? "إنشاء حساب جديد"
                        : "تسجيل الدخول"}
                    </button>
                </form>

                {authMode === "login" && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={resetPassword}
                    disabled={busy}
                  >
                    نسيت كلمة المرور؟
                  </button>
                )}

                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setAuthMode(
                      authMode === "login" ? "register" : "login"
                    );
                    setError("");
                  }}
                >
                  {authMode === "login"
                    ? "ليس لديك حساب؟ أنشئ حساباً جديداً"
                    : "لديك حساب بالفعل؟ سجّل الدخول"}
                </button>

                {error && <p className="error-box">{error}</p>}
              </section>
            </div>
          )}
        </div>
      </main>
    );
  }
