// ============================================
// Ask Manideep — Frontend Application Logic
// ============================================

const RENDER_API = "https://ask-manideep-backend.onrender.com";
const LOCAL_API = "http://localhost:8000";

const CONFIG = {
  API_BASE_URL: RENDER_API
};

async function detectBackend() {
  const isLocalFrontend =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (!isLocalFrontend) {
    // Already defaults to RENDER_API, just exit
    return;
  }

  // Use AbortController to stop the fetch if it takes more than 1 second
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1000); 

  try {
    const response = await fetch(`${LOCAL_API}/`, {
      method: "GET",
      signal: controller.signal // Attaches the timeout
    });

    if (response.ok) {
      CONFIG.API_BASE_URL = LOCAL_API;
      console.log("🟢 Using Local Backend");
      clearTimeout(timeoutId);
      return;
    }
  } catch (e) {
    console.log("🟡 Local Backend Not Running or Timeout Reached");
  }

  // No need to re-assign RENDER_API here if it's already the initial value of CONFIG
  console.log("🔵 Using Render Backend");
}

// ---- DOM References ----
const chatContainer = document.getElementById("chatContainer");
const welcomeScreen = document.getElementById("welcomeScreen");
const messagesArea = document.getElementById("messagesArea");
const queryInput = document.getElementById("queryInput");
const sendBtn = document.getElementById("sendBtn");
const suggestedPrompts = document.getElementById("suggestedPrompts");
const newChatBtn = document.getElementById("newChatBtn");
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const resumeBtn = document.getElementById("resumeBtn");

// ---- Conversation Memory (sessionStorage only) ----
const STORAGE_KEY = "ask_manideep_context";
const HISTORY_KEY = "ask_manideep_history";

function getContext() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function setContext(updates) {
  const current = getContext();
  const merged = { ...current, ...updates };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}

function getHistory() {
  try {
    return JSON.parse(sessionStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function clearSession() {
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(HISTORY_KEY);
}

// ---- Project ID detection (for context tracking) ----
const PROJECT_ALIASES = {
  llm_lawyer: ["llm lawyer", "legal assistant", "graphrag", "ai lawyer", "legal chatbot"],
  tom_resume_engine: ["tom", "resume engine", "resume tailoring", "ats"],
  target_vision: ["target vision", "head detection", "face recognition system", "aim system"],
  animal_intrusion: ["animal intrusion", "wildlife monitoring", "animal detection"],
  cyberbullying_detection: ["cyberbullying", "content moderation", "nlp classifier"],
  n8n_automation: ["n8n", "automation workflow", "workflow automation"],
  onesec_app: ["onesec", "habit breaker", "digital wellbeing"],
  uni_feedback: ["unifeedback", "feedback platform", "feedback system"],
  movie_recommendation: ["movie recommendation", "movie app", "tmdb"],
  baby_monitor: ["baby monitor", "iot monitoring"],
};

const DOMAIN_KEYWORDS = {
  "Computer Vision": ["computer vision", "opencv", "yolo", "image", "face recognition"],
  "AI/LLM": ["llm", "rag", "generative ai", "genai", "language model"],
  "Android Development": ["android", "mobile app", "kotlin"],
  "Web Development": ["web development", "php", "full stack", "website"],
  "Automation": ["automation", "n8n", "workflow"],
  "IoT": ["iot", "arduino", "embedded", "sensor"],
};

function detectProjectFromQuery(query) {
  const q = query.toLowerCase();
  for (const [projectId, aliases] of Object.entries(PROJECT_ALIASES)) {
    for (const alias of aliases) {
      if (q.includes(alias)) return projectId;
    }
  }
  return null;
}

function detectDomainFromQuery(query) {
  const q = query.toLowerCase();
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    for (const kw of keywords) {
      if (q.includes(kw)) return domain;
    }
  }
  return null;
}

// ---- UI Rendering ----
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatAnswer(text) {
  // Basic markdown-ish formatting: bold, line breaks, lists
  let html = escapeHtml(text);

  // Bold **text**
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Convert lines starting with - or * into list items
  const lines = html.split("\n");
  let out = [];
  let inList = false;

  for (let line of lines) {
    const trimmed = line.trim();
    if (/^[-*•]\s+/.test(trimmed)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${trimmed.replace(/^[-*•]\s+/, "")}</li>`);
    } else {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      if (trimmed === "") {
        out.push("");
      } else {
        out.push(`<p>${trimmed}</p>`);
      }
    }
  }
  if (inList) out.push("</ul>");

  return out.filter((l) => l !== "").join("");
}

// ---- FAKE STREAMING LOGIC ----
/**
 * Simulates streaming by splitting the full text into words
 * and updating the UI element iteratively.
 */
function streamTextEffect(element, fullText, speed = 40) {
  return new Promise((resolve) => {
    // Split text by spaces, but preserve the spaces by using a regex match or tracking them
    const words = fullText.split(" ");
    let currentWordIndex = 0;
    let accumulatedText = "";

    // Disable inputs while streaming to prevent user from breaking history order
    queryInput.disabled = true;
    sendBtn.disabled = true;

    const interval = setInterval(() => {
      if (currentWordIndex < words.length) {
        // Add the next word and a space (except for the last word)
        accumulatedText += words[currentWordIndex] + (currentWordIndex === words.length - 1 ? "" : " ");
        
        // Pass the raw accumulated text to the markdown/HTML compiler
        element.innerHTML = formatAnswer(accumulatedText);
        
        currentWordIndex++;
        scrollToBottom();
      } else {
        clearInterval(interval);
        
        // Re-enable input fields
        queryInput.disabled = false;
        updateSendButton();
        queryInput.focus();
        
        resolve(); // Signals that the animation is finished
      }
    }, speed); // "speed" controls the typing pace (lower is faster)
  });
}

function addMessage(role, content, isHistorical = false) {
  // Hide welcome screen
  welcomeScreen.style.display = "none";
  suggestedPrompts.classList.add("hidden");

  const msgEl = document.createElement("div");
  msgEl.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = role === "user" ? "Y" : "M";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";

  // If it's a historical message, render it immediately.
  // If it's an assistant response, we will handle its streaming separately inside sendQuery.
  if (role === "assistant") {
    if (isHistorical) {
      bubble.innerHTML = formatAnswer(content);
    } else {
      bubble.innerHTML = ""; // Starts empty for streaming
    }
  } else {
    bubble.textContent = content;
  }

  msgEl.appendChild(avatar);
  msgEl.appendChild(bubble);
  messagesArea.appendChild(msgEl);

  scrollToBottom();
  return bubble;
}

function addTypingIndicator() {
  const msgEl = document.createElement("div");
  msgEl.className = "message assistant";
  msgEl.id = "typingIndicator";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = "M";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;

  msgEl.appendChild(avatar);
  msgEl.appendChild(bubble);
  messagesArea.appendChild(msgEl);

  scrollToBottom();
}

function removeTypingIndicator() {
  const el = document.getElementById("typingIndicator");
  if (el) el.remove();
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  });
}

// ---- API Communication ----
async function sendQuery(query) {
  const context = getContext();

  addMessage("user", query);
  addTypingIndicator();

  // Update conversation context based on detected entities
  const detectedProject = detectProjectFromQuery(query);
  const detectedDomain = detectDomainFromQuery(query);

  const conversationContext = {};
  if (detectedProject) conversationContext.last_project = detectedProject;
  else if (context.last_project) conversationContext.last_project = context.last_project;

  if (detectedDomain) conversationContext.last_domain = detectedDomain;
  else if (context.last_domain) conversationContext.last_domain = context.last_domain;

  conversationContext.last_topic = query;

  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: query,
        conversation_context: conversationContext,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();

    removeTypingIndicator();
    
    // Create the assistant message container (initially empty)
    const assistantBubble = addMessage("assistant", "");
    
    // Fake stream the words into the container
    await streamTextEffect(assistantBubble, data.answer, 25);

    // Persist context
    setContext(conversationContext);

    // Save history (only save AFTER text streaming finishes to prevent weird race conditions)
    const history = getHistory();
    history.push({ role: "user", content: query });
    history.push({ role: "assistant", content: data.answer });
    saveHistory(history);

  } catch (err) {
    removeTypingIndicator();
    addMessage(
      "assistant",
      "Sorry, I'm having trouble connecting to the server right now. Please make sure the backend is running and try again.\n\n" +
      `(${err.message})`,
      true // Treat the error message like history so it doesn't try to stream
    );
  }
}

// ============================================
// INFO MODAL SYSTEM (Profile / Education / Skills / Certifications / Contact)
// Loads data directly from local knowledge/*.json — no backend calls.
// ============================================

const modalOverlay = document.getElementById("modalOverlay");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalClose = document.getElementById("modalClose");

const KNOWLEDGE_BASE_PATH = "knowledge";
const _jsonCache = {};

async function loadKnowledgeJson(filename) {
  if (_jsonCache[filename]) return _jsonCache[filename];
  const res = await fetch(`${KNOWLEDGE_BASE_PATH}/${filename}.json`);
  if (!res.ok) throw new Error(`Failed to load ${filename}.json`);
  const data = await res.json();
  _jsonCache[filename] = data;
  return data;
}

function escapeAttr(str) {
  return String(str ?? "").replace(/"/g, "&quot;");
}

// ---- Icon helpers ----
const ICONS = {
  globe: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/></svg>`,
  code: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  brain: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>`,
  layout: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`,
  phone: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>`,
  database: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  cloud: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`,
  zap: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  award: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>`,
  mail: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  linkedin: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>`,
  github: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>`,
  file: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  pin: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  arrow: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>`,
  externalLink: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
};

// ---- Renderers ----
async function renderProfileModal() {
  const profile = await loadKnowledgeJson("profile");

  const domains = (profile.domains || [])
    .map((d) => `<span class="chip">${escapeAttr(d)}</span>`)
    .join("");

  modalBody.innerHTML = `
    <div class="profile-modal-head">
      <div class="profile-modal-avatar">M</div>
      <div>
        <div class="profile-modal-name">${escapeAttr(profile.name)}</div>
        <div class="profile-modal-headline">${escapeAttr(profile.headline)}</div>
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Summary</div>
      <p class="modal-text">${escapeAttr(profile.summary)}</p>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Currently</div>
      <p class="modal-text">
        <strong>${escapeAttr(profile.current_status)}</strong><br/>
        ${escapeAttr(profile.university)} &middot; Graduating ${escapeAttr(profile.graduation_year)} &middot; CGPA ${escapeAttr(profile.cgpa)}
      </p>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Domains</div>
      <div class="chip-row">${domains}</div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Career Goal</div>
      <p class="modal-text">${escapeAttr(profile.career_goal)}</p>
    </div>
  `;
}

async function renderEducationModal() {
  const edu = await loadKnowledgeJson("education");

  const college = edu.college || {};
  const inter = edu.intermediate || {};
  const school = edu.school || {};

  modalBody.innerHTML = `
    <div class="edu-card">
      <div class="edu-card-title">${escapeAttr(college.institution)}</div>
      <div class="edu-card-sub">${escapeAttr(college.degree)} in ${escapeAttr(college.branch)} &middot; ${escapeAttr(college.location)}</div>
      <div class="edu-stats">
        <div class="edu-stat">
          <div class="edu-stat-value">${escapeAttr(college.cgpa)}</div>
          <div class="edu-stat-label">CGPA</div>
        </div>
        <div class="edu-stat">
          <div class="edu-stat-value">${escapeAttr(college.timeline)}</div>
          <div class="edu-stat-label">Timeline</div>
        </div>
      </div>
    </div>

    <div class="edu-card">
      <div class="edu-card-title">${escapeAttr(inter.institution)}</div>
      <div class="edu-card-sub">Stream: ${escapeAttr(inter.stream)} &middot; ${escapeAttr(inter.timeline)}</div>
      <div class="edu-stats">
        <div class="edu-stat">
          <div class="edu-stat-value">${escapeAttr(inter.percentage)}%</div>
          <div class="edu-stat-label">Percentage</div>
        </div>
      </div>
    </div>

    <div class="edu-card">
      <div class="edu-card-title">${escapeAttr(school.institution)}</div>
      <div class="edu-card-sub">${escapeAttr(school.timeline)}</div>
      <div class="edu-stats">
        <div class="edu-stat">
          <div class="edu-stat-value">${escapeAttr(school.percentage)}%</div>
          <div class="edu-stat-label">Percentage</div>
        </div>
      </div>
    </div>
  `;
}

async function renderSkillsModal() {
  const skills = await loadKnowledgeJson("skills");

  const categoryMeta = [
    { key: "programming_languages", title: "Languages", icon: ICONS.code },
    { key: "ai_ml_nlp", title: "AI / ML / NLP", icon: ICONS.brain },
    { key: "web_technologies", title: "Web Development", icon: ICONS.layout },
    { key: "mobile_development", title: "Mobile Development", icon: ICONS.phone },
    { key: "tools_and_infra", title: "Automation & Infra", icon: ICONS.zap },
    { key: "core_concepts", title: "Core Concepts", icon: ICONS.database },
    { key: "soft_skills", title: "Soft Skills", icon: ICONS.cloud },
  ];

  let html = "";

  for (const cat of categoryMeta) {
    const items = skills[cat.key];
    if (!items || items.length === 0) continue;

    const tags = items.map((item) => {
      if (typeof item === "string") {
        return `<span class="skill-tag">${escapeAttr(item)}</span>`;
      }
      const levelClass = item.level === "Advanced" ? " level-advanced" : "";
      return `<span class="skill-tag${levelClass}">${escapeAttr(item.name)}</span>`;
    }).join("");

    html += `
      <div class="skill-category">
        <div class="skill-category-title">${cat.icon} ${cat.title}</div>
        <div class="skill-tags">${tags}</div>
      </div>
    `;
  }

  modalBody.innerHTML = html;
}

async function renderCertificationsModal() {
  const certs = await loadKnowledgeJson("certifications");

  const sorted = [...certs].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const html = sorted.map((cert) => `
    <div class="cert-card">
      <div class="cert-icon">${ICONS.award}</div>
      <div class="cert-info">
        <div class="cert-name">${escapeAttr(cert.name)}</div>
        <div class="cert-meta">${escapeAttr(cert.issuer)} &middot; ${escapeAttr(cert.date)}</div>
      </div>
      <span class="cert-link-btn disabled">
        ${ICONS.externalLink} View
      </span>
    </div>
  `).join("");

  modalBody.innerHTML = `<div class="modal-section">${html}</div>`;
}

async function renderAchievementsModal() {
  const achievements = await loadKnowledgeJson("achievements");

  // Map over your achievements data using your beautiful CSS layout
  const html = achievements.map((ach) => `
    <div class="achievement-card">
      <div class="achievement-icon">${ICONS.award}</div>
      <div class="achievement-info">
        <div class="achievement-title">${escapeAttr(ach.title)}</div>
        <div class="achievement-meta">${escapeAttr(ach.issuer)} &middot; ${escapeAttr(ach.date)}</div>
        ${ach.category ? `<div class="achievement-category">${escapeAttr(ach.category)}</div>` : ''}
      </div>
    </div>
  `).join("");

  modalBody.innerHTML = `<div class="modal-section">${html}</div>`;
}

async function renderContactModal() {
  const [contact, links] = await Promise.all([
    loadKnowledgeJson("contact"),
    loadKnowledgeJson("links").catch(() => ({})),
  ]);

  const rows = [];

  if (contact.email) {
    rows.push(`
      <a class="contact-row" href="mailto:${escapeAttr(contact.email)}">
        <div class="contact-row-icon">${ICONS.mail}</div>
        <div class="contact-row-text">
          <div class="contact-row-label">Email</div>
          <div class="contact-row-value">${escapeAttr(contact.email)}</div>
        </div>
        <div class="contact-row-arrow">${ICONS.arrow}</div>
      </a>
    `);
  }

  if (contact.phone) {
    rows.push(`
      <a class="contact-row" href="tel:${escapeAttr(contact.phone.replace(/\s+/g, ""))}">
        <div class="contact-row-icon">${ICONS.phone}</div>
        <div class="contact-row-text">
          <div class="contact-row-label">Phone</div>
          <div class="contact-row-value">${escapeAttr(contact.phone)}</div>
        </div>
        <div class="contact-row-arrow">${ICONS.arrow}</div>
      </a>
    `);
  }

  if (links.linkedin) {
    const url = links.linkedin.startsWith("http") ? links.linkedin : `https://${links.linkedin}`;
    rows.push(`
      <a class="contact-row" href="${escapeAttr(url)}" target="_blank" rel="noopener">
        <div class="contact-row-icon">${ICONS.linkedin}</div>
        <div class="contact-row-text">
          <div class="contact-row-label">LinkedIn</div>
          <div class="contact-row-value">${escapeAttr(links.linkedin)}</div>
        </div>
        <div class="contact-row-arrow">${ICONS.arrow}</div>
      </a>
    `);
  }

  if (links.github) {
    const url = links.github.startsWith("http") ? links.github : `https://${links.github}`;
    rows.push(`
      <a class="contact-row" href="${escapeAttr(url)}" target="_blank" rel="noopener">
        <div class="contact-row-icon">${ICONS.github}</div>
        <div class="contact-row-text">
          <div class="contact-row-label">GitHub</div>
          <div class="contact-row-value">${escapeAttr(links.github)}</div>
        </div>
        <div class="contact-row-arrow">${ICONS.arrow}</div>
      </a>
    `);
  }

  rows.push(`
    <a class="contact-row" href="https://drive.google.com/file/d/1seMTTQMDc1HUz2iffV4QNnRyI__0T7We/view?usp=drive_link" target="_blank" rel="noopener">
      <div class="contact-row-icon">${ICONS.file}</div>
      <div class="contact-row-text">
        <div class="contact-row-label">Resume</div>
        <div class="contact-row-value">View / Download PDF</div>
      </div>
      <div class="contact-row-arrow">${ICONS.arrow}</div>
    </a>
  `);

  if (contact.location) {
    rows.push(`
      <div class="contact-row">
        <div class="contact-row-icon">${ICONS.pin}</div>
        <div class="contact-row-text">
          <div class="contact-row-label">Location</div>
          <div class="contact-row-value">${escapeAttr(contact.location)}</div>
        </div>
      </div>
    `);
  }

  modalBody.innerHTML = `<div class="contact-list">${rows.join("")}</div>`;
}

const MODAL_CONFIG = {
  profile: { title: "Profile", render: renderProfileModal },
  education: { title: "Education", render: renderEducationModal },
  skills: { title: "Skills & Technologies", render: renderSkillsModal },
  certifications: { title: "Certifications", render: renderCertificationsModal },
  achievements: { title: "Achievements", render: renderAchievementsModal },
  contact: { title: "Contact", render: renderContactModal },
};

let activeModal = null;

async function openModal(type) {
  const config = MODAL_CONFIG[type];
  if (!config) return;

  activeModal = type;
  modalTitle.textContent = config.title;
  modalBody.innerHTML = `<div class="modal-loading">Loading…</div>`;

  modalOverlay.classList.add("show");
  document.body.style.overflow = "hidden";

  try {
    await config.render();
  } catch (err) {
    modalBody.innerHTML = `<div class="modal-loading">Couldn't load this section. (${err.message})</div>`;
  }
}

function closeModal() {
  modalOverlay.classList.remove("show");
  document.body.style.overflow = "";
  activeModal = null;
}

modalClose.addEventListener("click", closeModal);

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalOverlay.classList.contains("show")) {
    closeModal();
  }
});

// ---- Wire up sidebar nav items with data-modal ----
document.querySelectorAll("[data-modal]").forEach((el) => {
  el.addEventListener("click", () => {
    const type = el.getAttribute("data-modal");
    openModal(type);
    closeSidebar();
  });
});


function autoResizeTextarea() {
  queryInput.style.height = "auto";
  queryInput.style.height = Math.min(queryInput.scrollHeight, 160) + "px";
}

function updateSendButton() {
  sendBtn.disabled = queryInput.value.trim().length === 0;
}

function handleSend() {
  const query = queryInput.value.trim();
  if (!query) return;

  sendQuery(query);
  queryInput.value = "";
  autoResizeTextarea();
  updateSendButton();
}

queryInput.addEventListener("input", () => {
  autoResizeTextarea();
  updateSendButton();
});

queryInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    // Check if textarea is disabled (means streaming is active) to prevent submission
    if (queryInput.disabled) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    handleSend();
  }
});

sendBtn.addEventListener("click", handleSend);

// ---- Suggested Prompts & Nav Items ----
document.querySelectorAll("[data-query]").forEach((el) => {
  el.addEventListener("click", () => {
    if (queryInput.disabled) return; // Prevent clicking suggestions while streaming
    const query = el.getAttribute("data-query");
    queryInput.value = query;
    handleSend();
    closeSidebar();
  });
});

// ---- New Chat ----
newChatBtn.addEventListener("click", () => {
  clearSession();
  messagesArea.innerHTML = "";
  welcomeScreen.style.display = "flex";
  suggestedPrompts.classList.remove("hidden");
  queryInput.value = "";
  // In case the user forces a new chat during streaming, ensure it is enabled
  queryInput.disabled = false; 
  updateSendButton();
  closeSidebar();
});

// ---- Resume Button ----
resumeBtn.addEventListener("click", () => {
  window.open("https://drive.google.com/file/d/1seMTTQMDc1HUz2iffV4QNnRyI__0T7We/view?usp=drive_link", "_blank");
});

// ---- Mobile Sidebar ----
function openSidebar() {
  sidebar.classList.add("open");
  sidebarOverlay.classList.add("show");
}

function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("show");
}

sidebarToggle.addEventListener("click", () => {
  if (sidebar.classList.contains("open")) {
    closeSidebar();
  } else {
    openSidebar();
  }
});

sidebarOverlay.addEventListener("click", closeSidebar);

// ---- Restore History on Load ----
(function restoreHistory() {
  const history = getHistory();
  if (history.length > 0) {
    welcomeScreen.style.display = "none";
    suggestedPrompts.classList.add("hidden");
    history.forEach((msg) => {
      // Pass 'true' to render immediately without streaming when loading history
      addMessage(msg.role, msg.content, true);
    });
  }
})();
(async function initializeApp() {
  await detectBackend();
  console.log("Using API:", CONFIG.API_BASE_URL);
})();