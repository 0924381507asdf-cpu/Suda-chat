import { useEffect, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  limit,
  startAt,
  endAt
} from "firebase/firestore";
import { auth, db } from "./firebase";
import {
  MessageCircle,
  Send,
  LogOut,
  Search,
  ArrowRight,
  Check,
  LoaderCircle,
  Mail,
  Lock,
  Phone,
  CircleDashed,
  Clock,
  Bell,
  Camera,
  Image as ImageIcon
} from "lucide-react";

function readableError(error) {
  const code = error?.code || "";
  const messages = {
    "auth/email-already-in-use": "هذا البريد مسجل بالفعل.",
    "auth/invalid-email": "البريد الإلكتروني غير صحيح.",
    "auth/weak-password": "كلمة المرور يجب أن تكون 6 أحرف على الأقل.",
    "auth/user-not-found": "لا يوجد حساب بهذا البريد.",
    "auth/wrong-password": "كلمة المرور غير صحيحة.",
    "auth/invalid-credential": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "auth/operation-not-allowed": "Firebase رفض طريقة تسجيل الدخول.",
    "auth/too-many-requests": "محاولات كثيرة. انتظر قليلاً.",
    "auth/network-request-failed": "تعذر الاتصال بالإنترنت.",
    "auth/unauthorized-domain": "نطاق الموقع غير مسموح به."
  };
  return messages[code] || error?.message || "حدث خطأ غير معروف.";
}

function errorDetails(error) {
  return `${readableError(error)} | الرمز: ${error?.code || "غير معروف"}`;
}

// دالة ضغط الصور (تستخدم للصورة الشخصية ولصور المحادثات)
function compressImage(file, maxSize = 600, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("تعذر قراءة الصورة."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("تعذر تحميل الملف."));
    reader.readAsDataURL(file);
  });
}

function UserAvatar({ photoURL, name, className = "" }) {
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name || "صورة"}
        className={`avatar wa-avatar avatar-img ${className}`}
      />
    );
  }
  return (
    <div className={`avatar wa-avatar ${className}`}>
      {(name || "?").slice(0, 1)}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState(null);

  const [authMode, setAuthMode] = useState("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");

  const [activeTab, setActiveTab] = useState("chats");
  const [profiles, setProfiles] = useState([]);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);

  const [messageText, setMessageText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toastMsg, setToastMsg] = useState(null);

  const messagesEndRef = useRef(null);
  const authEventRef = useRef(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const eventId = ++authEventRef.current;
      setAuthReady(false);
      setError("");
      setUser(currentUser);
      setProfile(null);

      if (!currentUser) {
        setActiveChat(null);
        setChats([]);
        setProfiles([]);
        setMessages([]);
        setAuthReady(true);
        return;
      }

      try {
        const profileRef = doc(db, "profiles", currentUser.uid);
        const profileSnap = await getDoc(profileRef);
        if (eventId !== authEventRef.current) return;

        if (profileSnap.exists()) {
          setProfile(profileSnap.data());
        } else {
          setProfile(null);
        }
      } catch (err) {
        if (eventId !== authEventRef.current) return;
        setProfile(null);
        setError(errorDetails(err));
      } finally {
        if (eventId === authEventRef.current) {
          setAuthReady(true);
        }
      }
    });

    return () => {
      authEventRef.current++;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user || !profile) {
      setChats([]);
      return;
    }

    const chatsQuery = query(
      collection(db, "chats"),
      where("members", "array-contains", user.uid)
    );

    return onSnapshot(
      chatsQuery,
      async (snapshot) => {
        try {
          const results = await Promise.all(
            snapshot.docs.map(async (chatDoc) => {
              const data = chatDoc.data();
              const members = data.members || [];
              const otherId = members.find((id) => id !== user.uid);
              if (!otherId) return null;

              const otherSnap = await getDoc(doc(db, "profiles", otherId));
              return {
                id: chatDoc.id,
                ...data,
                otherId,
                other: otherSnap.exists()
                  ? otherSnap.data()
                  : { displayName: "مستخدم", username: "", photoURL: "" }
              };
            })
          );

          results.sort(
            (a, b) => (b?.updatedAt?.seconds || 0) - (a?.updatedAt?.seconds || 0)
          );
          setChats(results.filter(Boolean));
        } catch (err) {
          setError(errorDetails(err));
        }
      },
      (err) => setError(errorDetails(err))
    );
  }, [user, profile]);

  useEffect(() => {
    if (!user || !profile) {
      setProfiles([]);
      return;
    }

    const term = searchText.trim().replace(/^@/, "");
    if (term.length < 2) {
      setProfiles([]);
      return;
    }

    let cancelled = false;

    async function searchUsers() {
      try {
        const usernameTerm = term.toLowerCase();
        const usernameQuery = query(
          collection(db, "profiles"),
          orderBy("username"),
          startAt(usernameTerm),
          endAt(usernameTerm + "\uf8ff"),
          limit(30)
        );
        const nameQuery = query(
          collection(db, "profiles"),
          orderBy("displayName"),
          startAt(term),
          endAt(term + "\uf8ff"),
          limit(30)
        );

        const [usernameSnapshot, nameSnapshot] = await Promise.all([
          getDocs(usernameQuery),
          getDocs(nameQuery)
        ]);

        const combined = new Map();
        [...usernameSnapshot.docs, ...nameSnapshot.docs].forEach((item) => {
          if (item.id !== user.uid) {
            combined.set(item.id, { id: item.id, ...item.data() });
          }
        });

        if (!cancelled) {
          setProfiles([...combined.values()]);
        }
      } catch (err) {
        if (!cancelled) {
          setProfiles([]);
          setError(errorDetails(err));
        }
      }
    }

    searchUsers();
    return () => {
      cancelled = true;
    };
  }, [user, profile, searchText]);

  useEffect(() => {
    if (!activeChat || !user) {
      setMessages([]);
      return;
    }

    const messagesQuery = query(
      collection(db, "chats", activeChat.id, "messages"),
      orderBy("createdAt", "asc"),
      limit(300)
    );

    return onSnapshot(
      messagesQuery,
      (snapshot) => {
        const docs = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

        if (docs.length > messages.length && messages.length > 0) {
          const latestMsg = docs[docs.length - 1];
          if (latestMsg && latestMsg.senderId !== user.uid) {
            setToastMsg({
              sender: activeChat.other?.displayName || "مستخدم",
              text: latestMsg.type === "image" ? "📷 أرسل صورة" : latestMsg.text
            });
            setTimeout(() => setToastMsg(null), 4000);
          }
        }

        setMessages(docs);
      },
      (err) => setError(errorDetails(err))
    );
  }, [activeChat, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleAuth(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !password) {
        throw new Error("أدخل البريد الإلكتروني وكلمة المرور.");
      }

      await setPersistence(auth, browserLocalPersistence);

      if (authMode === "register") {
        if (password.length < 6) {
          throw new Error("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
        }
        await createUserWithEmailAndPassword(auth, cleanEmail, password);
      } else {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      }
    } catch (err) {
      setError(errorDetails(err));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setError("");
    setBusy(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) throw new Error("اكتب بريدك الإلكتروني أولاً.");
      await sendPasswordResetEmail(auth, cleanEmail);
      setError("تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني.");
    } catch (err) {
      setError(errorDetails(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleInitialPhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 220, 0.78);
      setPhotoPreview(compressed);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpdateProfilePhoto(event) {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setBusy(true);
    setError("");
    try {
      const compressed = await compressImage(file, 220, 0.78);
      await updateDoc(doc(db, "profiles", user.uid), {
        photoURL: compressed
      });
      setProfile((prev) => ({ ...prev, photoURL: compressed }));
      setToastMsg({ sender: "تم التحديث", text: "تم حفظ صورة ملفك الشخصي بنجاح!" });
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err) {
      setError(errorDetails(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");

    try {
      const cleanName = displayName.trim();
      const cleanUsername = username.trim().toLowerCase().replace(/^@/, "");

      if (cleanName.length < 2) {
        throw new Error("اكتب اسماً من حرفين على الأقل.");
      }
      if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
        throw new Error("اسم المستخدم يجب أن يكون 3-20 حرفاً إنجليزياً أو رقماً.");
      }

      const usernameCheckQuery = query(
        collection(db, "profiles"),
        where("username", "==", cleanUsername),
        limit(1)
      );
      const existingUserSnap = await getDocs(usernameCheckQuery);
      if (!existingUserSnap.empty && existingUserSnap.docs[0].id !== user.uid) {
        throw new Error("اسم المستخدم هذا مستخدم بالفعل.");
      }

      const profileData = {
        displayName: cleanName,
        username: cleanUsername,
        photoURL: photoPreview || "",
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, "profiles", user.uid), profileData);
      await setDoc(
        doc(db, "users", user.uid),
        { email: user.email || "", updatedAt: serverTimestamp() },
        { merge: true }
      );

      const savedProfile = await getDoc(doc(db, "profiles", user.uid));
      if (!savedProfile.exists()) {
        throw new Error("لم يتم العثور على الملف الشخصي بعد الحفظ.");
      }

      setProfile(savedProfile.data());
      setError("");
    } catch (err) {
      setError(errorDetails(err));
    } finally {
      setBusy(false);
    }
  }

  async function openChat(person) {
    if (!user || !person?.id || busy) return;
    setBusy(true);
    setError("");

    try {
      const members = [user.uid, person.id].sort();
      const existingQuery = query(
        collection(db, "chats"),
        where("members", "array-contains", user.uid)
      );
      const existingSnapshot = await getDocs(existingQuery);

      const existingChat = existingSnapshot.docs.find((item) => {
        const chatMembers = item.data().members || [];
        return chatMembers.length === 2 && chatMembers.includes(person.id);
      });

      if (existingChat) {
        setActiveChat({
          id: existingChat.id,
          ...existingChat.data(),
          otherId: person.id,
          other: person
        });
      } else {
        const chatRef = doc(collection(db, "chats"));
        const chatData = {
          members,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: ""
        };
        await setDoc(chatRef, chatData);
        setActiveChat({
          id: chatRef.id,
          ...chatData,
          otherId: person.id,
          other: person
        });
      }
      setSearchText("");
    } catch (err) {
      setError(errorDetails(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const text = messageText.trim();
    if (!text || !activeChat || !user || busy) return;

    setBusy(true);
    setError("");

    try {
      await addDoc(collection(db, "chats", activeChat.id, "messages"), {
        senderId: user.uid,
        text,
        type: "text",
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, "chats", activeChat.id), {
        lastMessage: text.slice(0, 120),
        updatedAt: serverTimestamp()
      });

      setMessageText("");
    } catch (err) {
      setError(errorDetails(err));
    } finally {
      setBusy(false);
    }
  }

  // دالة إرسال صورة داخل المحادثة
  async function handleSendImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !activeChat || !user || busy) return;

    setBusy(true);
    setError("");

    try {
      const compressedImage = await compressImage(file, 600, 0.72);
      await addDoc(collection(db, "chats", activeChat.id, "messages"), {
        senderId: user.uid,
        text: "",
        imageData: compressedImage,
        type: "image",
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, "chats", activeChat.id), {
        lastMessage: "📷 صورة",
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      setError(errorDetails(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setError("");
    try {
      await signOut(auth);
      setActiveChat(null);
      setAuthMode("welcome");
    } catch (err) {
      setError(errorDetails(err));
    }
  }

  if (!authReady) {
    return (
      <div className="center-loader">
        <LoaderCircle className="spin" size={40} />
        <p>جارٍ تحميل سوداشات...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <main className="splash-screen">
        <div className="splash-container">
          <img
            src="https://i.ibb.co/k26Rwf4W/2-A218-D70-26-E3-4-F54-B5-EF-09-B96-B3-DE067.png"
            alt="سوداشات"
            className="splash-image"
          />

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
                  className="link-button switch-mode-btn"
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

  if (!profile) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <label className="photo-picker-circle" title="اختر صورة شخصية">
            {photoPreview ? (
              <img src={photoPreview} alt="معاينة" className="photo-preview-img" />
            ) : (
              <Camera size={32} />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleInitialPhotoChange}
              hidden
            />
          </label>
          <span className="photo-hint">اضغط على الدائرة لإضافة صورة (اختياري)</span>

          <h1>أكمل ملفك الشخصي</h1>
          <p className="muted">اختر اسماً واسم مستخدم ليتمكن الآخرون من مراسلتك.</p>

          <form onSubmit={saveProfile}>
            <label>الاسم الظاهر</label>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="اسمك الكامل"
              required
            />

            <label>اسم المستخدم</label>
            <input
              dir="ltr"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="username"
              required
            />

            <button className="primary wa-btn" disabled={busy}>
              {busy ? "جارٍ الحفظ..." : "حفظ ومتابعة"}
            </button>
          </form>

          <button type="button" className="link-button" onClick={handleSignOut}>
            تسجيل الخروج
          </button>

          {error && <p className="error-box">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell wa-theme">
      {toastMsg && (
        <div className="toast-notification">
          <Bell size={20} className="wa-icon-accent" />
          <div>
            <b>{toastMsg.sender}</b>
            <p>{toastMsg.text}</p>
          </div>
        </div>
      )}

      <header className="topbar wa-header">
        <div className="brand-inline">
          <strong>سوداشات</strong>
        </div>

        <div className="account">
          <span className="user-badge">{profile.displayName}</span>
          <button type="button" title="تسجيل الخروج" onClick={handleSignOut}>
            <LogOut size={19} />
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className={`sidebar ${activeChat ? "mobile-hidden" : ""}`}>
          <nav className="wa-tabs">
            <button
              type="button"
              className={`wa-tab ${activeTab === "chats" ? "active" : ""}`}
              onClick={() => setActiveTab("chats")}
            >
              <MessageCircle size={17} />
              <span>الدردشات</span>
            </button>

            <button
              type="button"
              className={`wa-tab ${activeTab === "status" ? "active" : ""}`}
              onClick={() => setActiveTab("status")}
            >
              <CircleDashed size={17} />
              <span>الحالة</span>
            </button>

            <button
              type="button"
              className={`wa-tab ${activeTab === "calls" ? "active" : ""}`}
              onClick={() => setActiveTab("calls")}
            >
              <Phone size={17} />
              <span>المكالمات</span>
            </button>
          </nav>

          {activeTab === "chats" ? (
            <>
              <div className="search-box">
                <Search size={18} />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="ابحث أو ابدأ دردشة جديدة..."
                />
              </div>

              {searchText.trim() ? (
                <div className="people-list">
                  <p className="section-label">نتائج البحث</p>
                  {profiles.map((person) => (
                    <button
                      type="button"
                      className="person-row"
                      key={person.id}
                      onClick={() => openChat(person)}
                      disabled={busy}
                    >
                      <UserAvatar
                        photoURL={person.photoURL}
                        name={person.displayName}
                      />
                      <div className="person-info">
                        <b>{person.displayName || "مستخدم"}</b>
                        <small>@{person.username || ""}</small>
                      </div>
                      <MessageCircle size={18} className="wa-icon-accent" />
                    </button>
                  ))}

                  {!profiles.length && (
                    <p className="empty-note">لا توجد نتائج مطابقة.</p>
                  )}
                </div>
              ) : (
                <div className="chat-list">
                  {chats.map((chat) => (
                    <button
                      type="button"
                      key={chat.id}
                      className={`chat-row ${activeChat?.id === chat.id ? "selected" : ""}`}
                      onClick={() => setActiveChat(chat)}
                    >
                      <UserAvatar
                        photoURL={chat.other?.photoURL}
                        name={chat.other?.displayName}
                      />
                      <div className="person-info">
                        <b>{chat.other?.displayName || "مستخدم"}</b>
                        <small>{chat.lastMessage || "ابدأ المحادثة"}</small>
                      </div>
                    </button>
                  ))}

                  {!chats.length && (
                    <div className="empty-state">
                      <MessageCircle size={32} />
                      <p>لا توجد محادثات بعد</p>
                      <small>ابحث عن شخص لبدء محادثة جديدة</small>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="coming-soon-box">
              <div className="coming-soon-icon">
                <Clock size={42} />
              </div>
              <h3>
                {activeTab === "status" ? "ميزة الحالات" : "المكالمات الصوتية والمرئية"}
              </h3>
              <span className="coming-soon-badge">قريباً</span>
              <p>نعمل حالياً على تطوير هذه الميزة لتكون متاحة قريباً.</p>
              <button
                type="button"
                className="primary wa-btn"
                onClick={() => setActiveTab("chats")}
              >
                العودة إلى الدردشات
              </button>
            </div>
          )}

          <div className="my-profile">
            <label className="avatar-edit-wrapper" title="اضغط لتغيير صورتك">
              <UserAvatar
                photoURL={profile.photoURL}
                name={profile.displayName}
                className="self"
              />
              <span className="avatar-camera-badge">
                <Camera size={12} />
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleUpdateProfilePhoto}
                hidden
              />
            </label>
            <div style={{ flex: 1 }}>
              <b>{profile.displayName}</b>
              <small style={{ display: "block" }}>@{profile.username}</small>
            </div>
            <Check size={17} className="wa-icon-accent" />
          </div>
        </aside>

        <section className={`conversation wa-chat-bg ${!activeChat ? "no-chat" : ""}`}>
          {activeChat ? (
            <>
              <div className="conversation-header wa-chat-header">
                <button
                  type="button"
                  className="back-button"
                  onClick={() => setActiveChat(null)}
                >
                  <ArrowRight size={20} />
                </button>
                <UserAvatar
                  photoURL={activeChat.other?.photoURL}
                  name={activeChat.other?.displayName}
                />
                <div>
                  <b>{activeChat.other?.displayName || "مستخدم"}</b>
                  <small style={{ display: "block" }}>@{activeChat.other?.username || ""}</small>
                </div>
              </div>

              <div className="messages-area">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`message ${
                      message.senderId === user.uid ? "mine wa-msg-mine" : "theirs wa-msg-theirs"
                    }`}
                  >
                    {message.type === "image" && message.imageData ? (
                      <img
                        src={message.imageData}
                        alt="صورة مرسلة"
                        className="chat-message-img"
                      />
                    ) : (
                      <p>{message.text}</p>
                    )}
                    <small>
                      {message.createdAt?.toDate
                        ? message.createdAt.toDate().toLocaleTimeString("ar", {
                            hour: "2-digit",
                            minute: "2-digit"
                          })
                        : "..."}
                    </small>
                  </div>
                ))}

                {!messages.length && (
                  <div className="first-message">
                    الرسائل مشفرة ومحمية. هذه بداية محادثتك مع {activeChat.other?.displayName}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <form className="composer wa-composer" onSubmit={sendMessage}>
                <label className="attach-image-btn" title="إرسال صورة">
                  <ImageIcon size={22} />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSendImage}
                    disabled={busy}
                    hidden
                  />
                </label>

                <input
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="اكتب رسالة..."
                  maxLength={5000}
                />
                <button
                  className="send-button wa-send-btn"
                  disabled={!messageText.trim() || busy}
                  aria-label="إرسال"
                >
                  <Send size={20} />
                </button>
              </form>
            </>
          ) : (
            <div className="welcome">
              <div className="welcome-icon wa-welcome-icon">
                <MessageCircle size={52} />
              </div>
              <h2>سوداشات ويب</h2>
              <p>أرسل واستقبل الرسائل الفورية مع أهلك وأصدقائك بكل سهولة.</p>
            </div>
          )}
        </section>
      </div>

      {error && (
        <div className="toast" role="alert">
          {error}
          <button type="button" onClick={() => setError("")}>×</button>
        </div>
      )}
    </main>
  );
}
