// src/pages/Community.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get, push, update, remove, onValue, serverTimestamp } from "firebase/database";
import { auth, db } from "../firebase";
import Layout from "../components/Layout";

// ── Constants ─────────────────────────────────────────────────────────────────
const FORUM_RULES = [
  "Sin racismo, xenofobia ni discriminación de ningún tipo.",
  "Respetá a todos los usuarios, aunque no estés de acuerdo.",
  "Sin spam ni publicidad no autorizada.",
  "Contenido relacionado al deporte y la comunidad.",
  "Los posts que violen las reglas serán eliminados.",
];

const DEFAULT_CATEGORIES = [
  { id: "busco_equipo", label: "⚽ Busco Equipo", color: "bg-emerald-900/40 border-emerald-700/30 text-emerald-400" },
  { id: "futbol",       label: "🏟️ Fútbol",       color: "bg-blue-900/40 border-blue-700/30 text-blue-400" },
  { id: "padel",        label: "🎾 Pádel",         color: "bg-purple-900/40 border-purple-700/30 text-purple-400" },
  { id: "pichangas",    label: "🌿 Pichangas",      color: "bg-lime-900/40 border-lime-700/30 text-lime-400" },
  { id: "mercado",      label: "💰 Mercado",        color: "bg-amber-900/40 border-amber-700/30 text-amber-400" },
  { id: "offtopic",     label: "💬 Off-topic",      color: "bg-gray-800/40 border-gray-700/30 text-gray-400" },
];

function timeAgo(timestamp) {
  if (!timestamp) return "";
  const diff = (Date.now() - timestamp) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function getCategoryStyle(catId) {
  return DEFAULT_CATEGORIES.find((c) => c.id === catId)?.color ||
    "bg-gray-800/40 border-gray-700/30 text-gray-400";
}

function getCategoryLabel(catId) {
  return DEFAULT_CATEGORIES.find((c) => c.id === catId)?.label || catId;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ show, message }) {
  return (
    <div className={`fixed top-5 right-5 glass border border-emerald-500/30 p-4 rounded-2xl flex items-center gap-3 z-50 transition-all duration-500 ${show ? "translate-x-0 opacity-100" : "translate-x-[120%] opacity-0"}`}>
      <span className="text-emerald-400 text-xl">✅</span>
      <span className="text-white font-semibold text-sm">{message}</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function Community() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState("forum"); // "forum" | "players" | "events"
  const [toast, setToast] = useState({ show: false, message: "" });

  // Players
  const [allPlayers, setAllPlayers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Forum
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [openPost, setOpenPost] = useState(null); // post completo abierto
  const [postComments, setPostComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [showNewPost, setShowNewPost] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", body: "", category: "busco_equipo" });
  const [submitting, setSubmitting] = useState(false);
  const commentsUnsubRef = useRef(null);

  // Events
  const [events, setEvents] = useState([]);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", description: "", date: "", time: "", complex: "", address: "" });

  function showToast(msg) {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  }

  // ── Auth + load data ───────────────────────────────────────────────────────
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user || user.isAnonymous) { navigate("/"); return; }
      setCurrentUser(user);

      // Perfil público
      const pubSnap = await get(ref(db, `public_profiles/${user.uid}`));
      if (pubSnap.exists()) setCurrentProfile(pubSnap.val());

      // ¿Es admin?
      const privSnap = await get(ref(db, `private_user_data/${user.uid}`));
      if (privSnap.exists()) {
        const d = privSnap.val();
        setIsAdmin(d.role === "admin" || !!d.managedComplexId);
      }

      // Jugadores
      const playersSnap = await get(ref(db, "public_profiles"));
      if (playersSnap.exists()) {
        const profiles = playersSnap.val();
        setAllPlayers(
          Object.keys(profiles)
            .filter((uid) => uid !== user.uid)
            .map((uid) => ({ uid, ...profiles[uid] }))
        );
      }

      // Posts en tiempo real
      onValue(ref(db, "forum/posts"), (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          const list = Object.entries(data)
            .map(([id, p]) => ({ id, ...p }))
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          setPosts(list);
        } else {
          setPosts([]);
        }
        setPostsLoading(false);
      });

      // Eventos en tiempo real
      onValue(ref(db, "forum/events"), (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          const list = Object.entries(data)
            .map(([id, e]) => ({ id, ...e }))
            .filter((e) => new Date(`${e.date}T${e.time || "00:00"}`) >= new Date())
            .sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
          setEvents(list);
        } else {
          setEvents([]);
        }
      });
    });
  }, []);

  // ── Open post ──────────────────────────────────────────────────────────────
  function openPostDetail(post) {
    setOpenPost(post);
    setPostComments([]);
    setCommentInput("");
    if (commentsUnsubRef.current) commentsUnsubRef.current();
    commentsUnsubRef.current = onValue(ref(db, `forum/posts/${post.id}/comments`), (snap) => {
      if (snap.exists()) {
        const list = Object.entries(snap.val())
          .map(([id, c]) => ({ id, ...c }))
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        setPostComments(list);
      } else {
        setPostComments([]);
      }
    });
  }

  function closePost() {
    setOpenPost(null);
    if (commentsUnsubRef.current) commentsUnsubRef.current();
  }

  // ── Upvote post ────────────────────────────────────────────────────────────
  async function toggleUpvote(postId, e) {
    e?.stopPropagation();
    const upvoteRef = ref(db, `forum/posts/${postId}/upvotes/${currentUser.uid}`);
    const snap = await get(upvoteRef);
    if (snap.exists()) {
      await remove(upvoteRef);
      await update(ref(db, `forum/posts/${postId}`), {
        upvoteCount: Math.max((posts.find((p) => p.id === postId)?.upvoteCount || 1) - 1, 0),
      });
    } else {
      await update(ref(db, `forum/posts/${postId}`), {
        [`upvotes/${currentUser.uid}`]: true,
        upvoteCount: (posts.find((p) => p.id === postId)?.upvoteCount || 0) + 1,
      });
    }
  }

  // ── Create post ────────────────────────────────────────────────────────────
  async function createPost() {
    if (!newPost.title.trim() || !newPost.body.trim()) {
      showToast("Completá el título y el contenido."); return;
    }
    setSubmitting(true);
    try {
      await push(ref(db, "forum/posts"), {
        title: newPost.title.trim(),
        body: newPost.body.trim(),
        category: newPost.category,
        authorId: currentUser.uid,
        authorName: currentProfile?.username || currentUser.email.split("@")[0],
        authorAvatar: currentProfile?.photoURL || "",
        timestamp: Date.now(),
        upvoteCount: 0,
        commentCount: 0,
      });
      setNewPost({ title: "", body: "", category: "busco_equipo" });
      setShowNewPost(false);
      showToast("Post publicado ✅");
    } catch (err) {
      console.error(err);
      showToast("Error al publicar.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Delete post ────────────────────────────────────────────────────────────
  async function deletePost(postId, e) {
    e?.stopPropagation();
    if (!confirm("¿Eliminar este post?")) return;
    await remove(ref(db, `forum/posts/${postId}`));
    showToast("Post eliminado.");
    if (openPost?.id === postId) closePost();
  }

  // ── Create comment ─────────────────────────────────────────────────────────
  async function createComment() {
    if (!commentInput.trim() || !openPost) return;
    await push(ref(db, `forum/posts/${openPost.id}/comments`), {
      text: commentInput.trim(),
      authorId: currentUser.uid,
      authorName: currentProfile?.username || currentUser.email.split("@")[0],
      authorAvatar: currentProfile?.photoURL || "",
      timestamp: Date.now(),
    });
    // Actualizar contador
    await update(ref(db, `forum/posts/${openPost.id}`), {
      commentCount: (openPost.commentCount || 0) + 1,
    });
    setCommentInput("");
  }

  // ── Delete comment ─────────────────────────────────────────────────────────
  async function deleteComment(commentId) {
    await remove(ref(db, `forum/posts/${openPost.id}/comments/${commentId}`));
    await update(ref(db, `forum/posts/${openPost.id}`), {
      commentCount: Math.max((openPost.commentCount || 1) - 1, 0),
    });
  }

  // ── Create event ───────────────────────────────────────────────────────────
  async function createEvent() {
    if (!newEvent.title.trim() || !newEvent.date) {
      showToast("Completá título y fecha."); return;
    }
    setSubmitting(true);
    try {
      await push(ref(db, "forum/events"), {
        ...newEvent,
        createdBy: currentUser.uid,
        createdByName: currentProfile?.username || currentUser.email.split("@")[0],
        timestamp: Date.now(),
      });
      setNewEvent({ title: "", description: "", date: "", time: "", complex: "", address: "" });
      setShowNewEvent(false);
      showToast("Evento creado ✅");
    } catch (err) {
      showToast("Error al crear evento.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Filtered posts ─────────────────────────────────────────────────────────
  const filteredPosts = selectedCategory === "all"
    ? posts
    : posts.filter((p) => p.category === selectedCategory);

  const filteredPlayers = searchTerm.length < 2
    ? []
    : allPlayers.filter((p) => p?.username?.toLowerCase().includes(searchTerm.toLowerCase()));

  const defaultAvatar = (name) =>
    `https://ui-avatars.com/api/?name=${name || "?"}&background=151523&color=34d399`;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="relative container mx-auto px-4 pt-6 max-w-5xl pb-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="glass p-2.5 rounded-xl hover:bg-emerald-900/30 transition border border-white/5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <p className="display text-4xl text-white tracking-wide neon-text">COMUNIDAD</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 glass rounded-2xl p-1.5">
          {[
            { key: "forum",   label: "💬 Foro" },
            { key: "events",  label: "🏆 Eventos" },
            { key: "players", label: "👥 Jugadores" },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${tab === t.key ? "bg-emerald-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══ TAB: FORO ══════════════════════════════════════════════════════ */}
        {tab === "forum" && (
          <div>
            {/* Acciones */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setShowRules(!showRules)}
                className="text-xs text-gray-500 hover:text-amber-400 transition flex items-center gap-1">
                📋 Reglas de la comunidad
              </button>
              <button onClick={() => setShowNewPost(true)}
                className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold px-4 py-2 rounded-xl text-sm transition display tracking-wider">
                + NUEVO POST
              </button>
            </div>

            {/* Reglas */}
            {showRules && (
              <div className="glass rounded-2xl p-4 mb-4 border border-amber-700/20 fade-up">
                <p className="font-bold text-amber-400 mb-2 text-sm">📋 Reglas de la Comunidad</p>
                <ul className="space-y-1">
                  {FORUM_RULES.map((r, i) => (
                    <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                      <span className="text-amber-500 flex-shrink-0">{i + 1}.</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Filtro por categoría */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-4">
              <button onClick={() => setSelectedCategory("all")}
                className={`flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition ${selectedCategory === "all" ? "bg-white/10 border-white/30 text-white" : "border-white/10 text-gray-500 hover:text-white"}`}>
                🌐 Todo
              </button>
              {DEFAULT_CATEGORIES.map((cat) => (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                  className={`flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition ${selectedCategory === cat.id ? `${cat.color} border-opacity-100` : "border-white/10 text-gray-500 hover:text-white"}`}>
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Posts */}
            {postsLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="glass rounded-2xl h-20 animate-pulse" />)}
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-5xl mb-3">💬</p>
                <p className="display text-2xl text-gray-500">SIN POSTS AÚN</p>
                <p className="text-gray-600 text-sm mt-1">¡Sé el primero en publicar!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPosts.map((post) => {
                  const hasUpvoted = post.upvotes?.[currentUser?.uid];
                  return (
                    <div key={post.id} onClick={() => openPostDetail(post)}
                      className="glass rounded-2xl p-4 cursor-pointer hover:border-emerald-500/20 transition neon-card">
                      <div className="flex items-start gap-3">
                        {/* Upvote */}
                        <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5" onClick={(e) => toggleUpvote(post.id, e)}>
                          <button className={`text-lg leading-none transition hover:scale-125 ${hasUpvoted ? "text-emerald-400" : "text-gray-600 hover:text-emerald-400"}`}>▲</button>
                          <span className={`text-xs font-black ${hasUpvoted ? "text-emerald-400" : "text-gray-500"}`}>{post.upvoteCount || 0}</span>
                        </div>

                        {/* Content */}
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getCategoryStyle(post.category)}`}>
                              {getCategoryLabel(post.category)}
                            </span>
                            <span className="text-gray-600 text-xs">{timeAgo(post.timestamp)}</span>
                          </div>
                          <p className="font-bold text-white text-sm leading-snug">{post.title}</p>
                          <p className="text-gray-500 text-xs mt-1 line-clamp-2">{post.body}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <img src={post.authorAvatar || defaultAvatar(post.authorName)} className="w-5 h-5 rounded-full object-cover" alt="" />
                            <span className="text-gray-600 text-xs">{post.authorName}</span>
                            <span className="text-gray-600 text-xs ml-auto">💬 {post.commentCount || 0}</span>
                          </div>
                        </div>

                        {/* Delete (own or admin) */}
                        {(post.authorId === currentUser?.uid || isAdmin) && (
                          <button onClick={(e) => deletePost(post.id, e)}
                            className="text-gray-700 hover:text-red-400 transition flex-shrink-0 p-1">
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: EVENTOS ═══════════════════════════════════════════════════ */}
        {tab === "events" && (
          <div>
            {isAdmin && (
              <div className="flex justify-end mb-4">
                <button onClick={() => setShowNewEvent(true)}
                  className="bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold px-4 py-2 rounded-xl text-sm transition display tracking-wider">
                  + CREAR EVENTO
                </button>
              </div>
            )}

            {events.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-5xl mb-3">🏆</p>
                <p className="display text-2xl text-gray-500">SIN EVENTOS PRÓXIMOS</p>
                {isAdmin && <p className="text-gray-600 text-sm mt-1">Creá el primer evento especial</p>}
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
                  <div key={event.id} className="glass rounded-2xl p-5 relative overflow-hidden neon-card">
                    <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
                    <div className="flex items-start gap-4">
                      <div className="glass rounded-2xl p-3 flex-shrink-0 text-center min-w-[60px]">
                        <p className="text-xs text-amber-400 font-bold uppercase">
                          {new Date(`${event.date}T12:00`).toLocaleDateString("es-ES", { month: "short" })}
                        </p>
                        <p className="display text-3xl text-white leading-none">
                          {new Date(`${event.date}T12:00`).toLocaleDateString("es-ES", { day: "2-digit" })}
                        </p>
                        {event.time && <p className="text-xs text-gray-500 mt-0.5">{event.time} hs</p>}
                      </div>
                      <div className="flex-grow">
                        <p className="font-black text-white text-lg leading-snug">{event.title}</p>
                        {event.complex && <p className="text-emerald-400 text-xs mt-0.5">🏟️ {event.complex}</p>}
                        {event.address && <p className="text-gray-500 text-xs">📍 {event.address}</p>}
                        {event.description && <p className="text-gray-400 text-sm mt-2">{event.description}</p>}
                        <p className="text-gray-600 text-xs mt-2">Creado por {event.createdByName}</p>
                      </div>
                      {isAdmin && (
                        <button onClick={async () => { await remove(ref(db, `forum/events/${event.id}`)); showToast("Evento eliminado."); }}
                          className="text-gray-700 hover:text-red-400 transition flex-shrink-0">
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: JUGADORES ═════════════════════════════════════════════════ */}
        {tab === "players" && (
          <div>
            <div className="glass rounded-2xl p-4 mb-6">
              <div className="relative">
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar jugador por apodo..."
                  className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl p-3 pl-10 text-sm outline-none transition placeholder-gray-600" />
                <svg className="w-5 h-5 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {searchTerm.length < 2 ? (
              <div className="text-center py-12 text-gray-600">
                <p className="text-5xl mb-3 opacity-30">👥</p>
                <p className="display text-xl tracking-wide">BUSCÁ UN JUGADOR</p>
                <p className="text-sm mt-1">Escribí al menos 2 caracteres</p>
              </div>
            ) : filteredPlayers.length === 0 ? (
              <p className="text-center text-gray-600 py-8">No hay jugadores que coincidan.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredPlayers.map((player) => (
                  <div key={player.uid} className="glass rounded-2xl p-5 text-center neon-card flex flex-col justify-between fade-up">
                    <div>
                      <img src={player.photoURL || defaultAvatar(player.username)}
                        alt={player.username} className="w-20 h-20 rounded-full mx-auto border-2 border-emerald-500/50 object-cover" />
                      <p className="display text-xl text-white mt-3 tracking-wide truncate">{player.username?.toUpperCase()}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        <span className="text-emerald-400 font-bold">{player.hoursPlayedFutbol || player.hoursPlayed || 0}</span> hs en cancha
                      </p>
                    </div>
                    <button onClick={() => navigate(`/perfil?uid=${player.uid}`)}
                      className="mt-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-sm font-bold py-2 px-4 rounded-xl transition w-full display tracking-wider">
                      VER PERFIL
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════ MODALS ════════════════════════════════════════════════════════ */}

      {/* ── Post abierto ──────────────────────────────────────────────────── */}
      {openPost && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && closePost()}>
          <div className="w-full sm:max-w-2xl glass rounded-t-3xl sm:rounded-3xl flex flex-col relative fade-up" style={{ maxHeight: "88vh" }}>
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mt-4 sm:hidden" />

            {/* Post header */}
            <div className="p-5 border-b border-white/5 flex-shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-grow">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getCategoryStyle(openPost.category)}`}>
                    {getCategoryLabel(openPost.category)}
                  </span>
                  <p className="font-black text-white text-xl mt-2 leading-snug">{openPost.title}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <img src={openPost.authorAvatar || defaultAvatar(openPost.authorName)} className="w-6 h-6 rounded-full object-cover" alt="" />
                    <span className="text-gray-500 text-xs">{openPost.authorName}</span>
                    <span className="text-gray-600 text-xs">· {timeAgo(openPost.timestamp)}</span>
                  </div>
                </div>
                <button onClick={closePost} className="text-gray-500 hover:text-white text-2xl flex-shrink-0">×</button>
              </div>
              <p className="text-gray-300 text-sm mt-4 leading-relaxed">{openPost.body}</p>
              <div className="flex items-center gap-4 mt-4">
                <button onClick={(e) => toggleUpvote(openPost.id, e)}
                  className={`flex items-center gap-1.5 text-sm font-bold transition ${openPost.upvotes?.[currentUser?.uid] ? "text-emerald-400" : "text-gray-500 hover:text-emerald-400"}`}>
                  ▲ {openPost.upvoteCount || 0} votos
                </button>
                <span className="text-gray-600 text-xs">💬 {openPost.commentCount || 0} respuestas</span>
              </div>
            </div>

            {/* Comments */}
            <div className="flex-grow overflow-y-auto p-5 space-y-3">
              {postComments.length === 0 ? (
                <p className="text-center text-gray-600 text-sm py-6">Sin respuestas aún. ¡Sé el primero!</p>
              ) : (
                postComments.map((c) => (
                  <div key={c.id} className="flex items-start gap-3">
                    <img src={c.authorAvatar || defaultAvatar(c.authorName)} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="" />
                    <div className="flex-grow bg-white/5 rounded-2xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-amber-300">{c.authorName}</span>
                        <span className="text-xs text-gray-600">{timeAgo(c.timestamp)}</span>
                      </div>
                      <p className="text-gray-200 text-sm">{c.text}</p>
                    </div>
                    {(c.authorId === currentUser?.uid || isAdmin) && (
                      <button onClick={() => deleteComment(c.id)} className="text-gray-700 hover:text-red-400 transition mt-1">
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Comment input */}
            <div className="p-4 border-t border-white/5 flex-shrink-0 flex gap-2">
              <img src={currentProfile?.photoURL || defaultAvatar(currentProfile?.username)} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="" />
              <input value={commentInput} onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), createComment())}
                placeholder="Escribí una respuesta..."
                className="flex-1 bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-3 py-2 text-sm outline-none transition placeholder-gray-600" />
              <button onClick={createComment} disabled={!commentInput.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl transition text-sm">
                →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Nuevo post ────────────────────────────────────────────────────── */}
      {showNewPost && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && setShowNewPost(false)}>
          <div className="w-full sm:max-w-lg glass rounded-t-3xl sm:rounded-3xl p-6 relative fade-up">
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-5 sm:hidden" />
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
            <button onClick={() => setShowNewPost(false)} className="absolute top-5 right-5 text-gray-500 hover:text-white text-2xl">×</button>

            <p className="display text-2xl text-white mb-5">NUEVO POST</p>

            {/* Reglas breves */}
            <div className="bg-amber-900/20 border border-amber-700/20 rounded-xl px-3 py-2 mb-4">
              <p className="text-amber-400 text-xs">⚠️ Sin racismo, discriminación ni contenido inapropiado. Los posts que violen las reglas serán eliminados.</p>
            </div>

            <div className="space-y-3">
              <select value={newPost.category} onChange={(e) => setNewPost((p) => ({ ...p, category: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm outline-none">
                {DEFAULT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <input value={newPost.title} onChange={(e) => setNewPost((p) => ({ ...p, title: e.target.value }))}
                placeholder="Título del post..."
                maxLength={100}
                className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-4 py-2.5 text-sm outline-none placeholder-gray-600" />
              <textarea value={newPost.body} onChange={(e) => setNewPost((p) => ({ ...p, body: e.target.value }))}
                placeholder="Contá lo que quieras..."
                rows={5}
                className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-4 py-2.5 text-sm outline-none resize-none placeholder-gray-600" />
            </div>

            <button onClick={createPost} disabled={submitting || !newPost.title.trim() || !newPost.body.trim()}
              className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-60 text-white font-black py-3 rounded-2xl transition display tracking-wider">
              {submitting ? "PUBLICANDO..." : "PUBLICAR POST"}
            </button>
          </div>
        </div>
      )}

      {/* ── Nuevo evento (solo admins) ─────────────────────────────────────── */}
      {showNewEvent && isAdmin && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && setShowNewEvent(false)}>
          <div className="w-full sm:max-w-lg glass rounded-t-3xl sm:rounded-3xl p-6 relative fade-up" style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-5 sm:hidden" />
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
            <button onClick={() => setShowNewEvent(false)} className="absolute top-5 right-5 text-gray-500 hover:text-white text-2xl">×</button>

            <p className="display text-2xl text-white mb-5">CREAR EVENTO</p>

            <div className="space-y-3">
              {[
                { key: "title",       ph: "Título del evento *",        type: "text" },
                { key: "description", ph: "Descripción (opcional)",      type: "text" },
                { key: "date",        ph: "Fecha *",                     type: "date" },
                { key: "time",        ph: "Hora (opcional)",             type: "time" },
                { key: "complex",     ph: "Nombre del complejo",         type: "text" },
                { key: "address",     ph: "Dirección (opcional)",        type: "text" },
              ].map((f) => (
                <input key={f.key} type={f.type} value={newEvent[f.key]} placeholder={f.ph}
                  onChange={(e) => setNewEvent((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 focus:border-amber-500 text-white rounded-xl px-4 py-2.5 text-sm outline-none placeholder-gray-600" />
              ))}
            </div>

            <button onClick={createEvent} disabled={submitting || !newEvent.title.trim() || !newEvent.date}
              className="w-full mt-4 bg-amber-600 hover:bg-amber-500 active:scale-95 disabled:opacity-60 text-white font-black py-3 rounded-2xl transition display tracking-wider">
              {submitting ? "CREANDO..." : "CREAR EVENTO 🏆"}
            </button>
          </div>
        </div>
      )}

      <Toast show={toast.show} message={toast.message} />
    </Layout>
  );
}
