// شاشة البداية بالصورة الفخمة مع أزرار تفاعلية
  if (!user) {
    return (
      <main className="splash-screen">
        <div className="splash-container">
          <img
            src="https://i.ibb.co/k26Rwf4W/2-A218-D70-26-E3-4-F54-B5-EF-09-B96-B3-DE067.png"
            alt="سوداشات"
            className="splash-image"
          />

          {/* الأزرار الشفافة الموضوعة بدقة فوق أزرار الصورة */}
          {authMode === "welcome" && (
            <>
              <button
                type="button"
                className="hotspot-btn hotspot-register"
                onClick={() => {
                  setAuthMode("register");
                  setError("");
                }}
                aria-label="إنشاء حساب جديد"
              />

              <button
                type="button"
                className="hotspot-btn hotspot-login"
                onClick={() => {
                  setAuthMode("login");
                  setError("");
                }}
                aria-label="تسجيل الدخول"
              />
            </>
          )}

          {/* نافذة إدخال البريد وكلمة المرور عند الضغط على أحد الأزرار */}
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
                      autoComplete="email"
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
                      autoComplete={
                        authMode === "register"
                          ? "new-password"
                          : "current-password"
                      }
                      minLength={6}
                      required
                    />
                  </div>

                  <button className="primary wa-btn" disabled={busy}>
                    {busy
                      ? "يرجى الانتظار..."
                      : authMode === "register"
                        ? "إنشاء حساب"
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

                {error && <p className="error">{error}</p>}
              </section>
            </div>
          )}
        </div>
      </main>
    );
  }
