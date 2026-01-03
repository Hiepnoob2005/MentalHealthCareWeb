/**
 * File này dùng cho toàn bộ logic Frontend (index.html)
 * Bao gồm: Auth, Chatbot, Quick Test, Matching, Booking, Real-time Socket
 */

// --- GLOBAL VARIABLES ---
let expertSocket = null;
let currentExpertRoom = null;
let currentUserUsername = null; // Biến lưu username người dùng hiện tại
let currentBookingCounselorId = null;

// ============================================================
// 1. MAIN INITIALIZATION (CHẠY 1 LẦN DUY NHẤT KHI LOAD TRANG)
// ============================================================
document.addEventListener("DOMContentLoaded", function () {
    console.log("Website Loaded - Initializing...");

    // 1. Kiểm tra đăng nhập & Cập nhật UI
    checkLoginStatus();

    // 2. Chatbot AI Init
    const currentConversationId = getConversationId();
    console.log(`Chatbot Session ID: ${currentConversationId}`);
    initializeChatbotListeners();
    addFindExpertButton();
    loadOldChatHistory();

    // 3. UI Interactions
    initializeScrollEffects();
    initializeLoginModalListeners();
    initializeResourceFilters();

    // 4. Quick Test (DASS-21)
    initializeQuickTestListeners();

    // 5. Expert System Init
    loadAvailableCounselors(); // Tải list chuyên gia ở trang chủ
    refreshExpertStatusOnLoadAll(); // Cập nhật trạng thái Online/Offline

    // 6. Logic riêng cho từng Role (User Dashboard / Counselor Dashboard)
    initializeCounselorScheduleLogic(); // <--- CODE MỚI CỦA BẠN Ở ĐÂY
    initializeUserDashboardLogic();

    // 7. Kiểm tra hàm global nếu có (cho trang danh sách chuyên gia full)
    if (typeof loadAllCounselorsPage === 'function') {
        loadAllCounselorsPage();
    }
});


// ============================================================
// 2. AUTHENTICATION & LOGIN MODAL
// ============================================================

async function checkLoginStatus() {
    try {
        const response = await fetch("/api/status");
        if (!response.ok) {
            initializeCTAListeners();
            return;
        }
        const data = await response.json();

        if (data.logged_in && data.username) {
            // ĐÃ ĐĂNG NHẬP
            updateUIAfterLogin(data.username);

            // Khởi tạo Chat Socket nếu đang ở trang có khung chat
            const messengerContainer = document.querySelector('.messenger-container');
            if (messengerContainer) {
                initializeCounselorChat(data.username);
            }
        } else {
            // CHƯA ĐĂNG NHẬP
            initializeCTAListeners();
        }
    } catch (err) {
        console.error("Lỗi auth:", err);
        initializeCTAListeners();
    }
}

function updateUIAfterLogin(username) {
    currentUserUsername = username; // Lưu vào biến toàn cục
    const ctaButton = document.getElementById("navbarCtaButton");

    if (ctaButton) {
        ctaButton.textContent = `Xin chào, ${username}`;
        ctaButton.href = "#";

        // Style lại nút
        ctaButton.style.maxWidth = "200px";
        ctaButton.style.overflow = "hidden";
        ctaButton.style.textOverflow = "ellipsis";
        ctaButton.style.whiteSpace = "nowrap";
        ctaButton.style.display = "inline-block";
        ctaButton.style.verticalAlign = "middle";

        ctaButton.onclick = (e) => {
            e.preventDefault();
            toggleProfileDropdown();
        };
    }

    const logoutButton = document.getElementById("dropdownLogoutButton");
    if (logoutButton) {
        logoutButton.onclick = (e) => {
            e.preventDefault();
            handleLogout();
        };
    }

    // Cập nhật text Hero section
    const heroTitle = document.querySelector(".hero-content h1");
    if (heroTitle) heroTitle.innerHTML = `Chào mừng trở lại, <span class="highlight">${username}</span>!`;

    // Đổi nút kết nối thành đặt lịch
    document.querySelectorAll(".btn-connect:not(.btn-chat):not([disabled])").forEach((btn) => {
        btn.textContent = "Đặt lịch hẹn";
    });
}

function toggleProfileDropdown() {
    const dropdown = document.getElementById("profileDropdown");
    if (dropdown) dropdown.classList.toggle("active");
}

window.addEventListener("click", function (event) {
    const ctaButton = document.getElementById("navbarCtaButton");
    const dropdown = document.getElementById("profileDropdown");
    if (!dropdown || !ctaButton) return;
    if (!ctaButton.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.classList.remove("active");
    }
});

async function handleLogout() {
    if (!confirm("Bạn có chắc chắn muốn đăng xuất?")) return;
    try {
        await fetch("/api/logout", { method: "POST" });
        window.location.reload();
    } catch (err) {
        console.error(err);
    }
}

function initializeLoginModalListeners() {
    const loginModal = document.getElementById("loginModal");
    if (loginModal) {
        loginModal.addEventListener("click", function (e) {
            if (e.target === this) closeLoginModal();
        });
        const closeBtn = loginModal.querySelector(".modal-close");
        if (closeBtn) closeBtn.onclick = closeLoginModal;
        const loginForm = document.getElementById("loginForm");
        if (loginForm) loginForm.addEventListener("submit", handleLoginSubmit);
    }
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    showFormMessage("loginMessage", "Đang xử lý...", false);

    const form = event.target;
    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: form.username.value, password: form.password.value }),
        });
        const data = await response.json();

        if (!response.ok) throw new Error(data.message);

        showFormMessage("loginMessage", "Thành công! Đang tải lại...", false);
        setTimeout(() => {
            if (data.is_admin) window.location.href = "/admin/dashboard";
            else window.location.reload();
        }, 1000);
    } catch (err) {
        showFormMessage("loginMessage", err.message, true);
    }
}

function openLoginModal() {
    document.getElementById("loginModal")?.classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeLoginModal() {
    document.getElementById("loginModal")?.classList.remove("active");
    document.body.style.overflow = "auto";
}

function showFormMessage(elId, msg, isError) {
    const el = document.getElementById(elId);
    if (el) {
        el.textContent = msg;
        el.style.color = isError ? "#ef4444" : "#10b981";
        el.style.display = "block";
    }
}

function initializeCTAListeners() {
    const selectors = [".btn-cta", ".btn-primary", ".btn-connect:not([disabled])"];
    selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(btn => {
            if (btn.id === "navbarCtaButton" && btn.textContent.includes("Xin chào")) return;
            btn.onclick = (e) => { e.preventDefault(); openLoginModal(); };
        });
    });
}

// ============================================================
// 3. UI EFFECTS & NAVIGATION
// ============================================================

function initializeScrollEffects() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener("click", function (e) {
            e.preventDefault();
            const isLoggedIn = !!document.getElementById("navbarCtaButton")?.href.endsWith("#");
            const targetHref = this.getAttribute("href");

            if (!isLoggedIn && ["#test", "#experts", "#dashboard"].includes(targetHref)) {
                openLoginModal();
                return;
            }

            const target = document.querySelector(targetHref);
            if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });

    window.addEventListener("scroll", function () {
        const navbar = document.querySelector(".navbar");
        if (window.scrollY > 50) navbar.classList.add("scrolled");
        else navbar.classList.remove("scrolled");
    });
}

function initializeResourceFilters() {
    document.querySelectorAll(".category-btn").forEach((btn) => {
        btn.addEventListener("click", function () {
            document.querySelectorAll(".category-btn").forEach((b) => b.classList.remove("active"));
            this.classList.add("active");
        });
    });
}


// ============================================================
// 4. CHATBOT AI (GEMINI)
// ============================================================

function getConversationId() {
    let id = localStorage.getItem("gemini-chat-session-id");
    if (!id) {
        id = self.crypto.randomUUID();
        localStorage.setItem("gemini-chat-session-id", id);
    }
    return id;
}

function toggleChatbot() {
    document.getElementById("chatbotWindow")?.classList.toggle("active");
}

function initializeChatbotListeners() {
    const chatInput = document.getElementById("chatInput");
    const sendButton = document.getElementById("sendButton");
    const toggleButtons = [document.getElementById("chatbotToggle"), document.getElementById("chatbotToggle2")];

    if (chatInput) chatInput.addEventListener("keypress", handleChatInputKey);
    if (sendButton) sendButton.addEventListener("click", handleSendMessage);
    toggleButtons.forEach(btn => { if (btn) btn.addEventListener("click", toggleChatbot); });
}

async function handleSendMessage(event) {
    if (event) event.preventDefault();
    const input = document.getElementById("chatInput");
    const message = input.value.trim();
    if (!message) return;

    addMessageToChat(message, "user");
    input.value = "";
    showTypingIndicator();

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, conversationId: getConversationId() }),
        });
        const data = await response.json();
        removeTypingIndicator();
        addMessageToChat(data.reply, "bot");
    } catch (err) {
        removeTypingIndicator();
        addMessageToChat("Lỗi kết nối AI server.", "bot");
    }
}

function addMessageToChat(text, sender) {
    const container = document.getElementById("chatMessages");
    if (!container) return;
    const div = document.createElement("div");
    div.className = `message ${sender}`;
    div.innerHTML = `<div class="message-avatar">${sender === "bot" ? "AI" : "You"}</div><div class="message-content">${text}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
    const container = document.getElementById("chatMessages");
    if (!container) return;
    const div = document.createElement("div");
    div.className = "message bot typing-message";
    div.innerHTML = `<div class="message-avatar">AI</div><div class="typing-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator() {
    document.querySelector(".typing-message")?.remove();
}

function handleChatInputKey(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage();
    }
}

async function loadOldChatHistory() {
    try {
        const res = await fetch(`/api/chat/history?conversationId=${getConversationId()}`);
        const data = await res.json();
        const container = document.getElementById("chatMessages");
        if (data.messages?.length > 0 && container) {
            container.innerHTML = '';
            data.messages.forEach(msg => {
                addMessageToChat(msg.text, msg.role === 'user' ? 'user' : 'bot');
            });
        }
    } catch (e) { console.error(e); }
}

function addFindExpertButton() {
    const container = document.querySelector('.chatbot-input');
    if (!container || container.querySelector('.btn-find-expert')) return;

    const btn = document.createElement('button');
    btn.innerHTML = '<i class="fas fa-user-md"></i>';
    btn.className = 'btn-find-expert';
    btn.title = 'Tìm chuyên gia từ hội thoại';
    btn.type = 'button';
    btn.onclick = async () => {
        showLoadingModal("Đang phân tích hội thoại...");
        try {
            const res = await fetch(`/api/match/from-chat/${getConversationId()}`);
            const data = await res.json();
            hideLoadingModal();
            if (data.matches?.length > 0) displayMatchingResults(data);
            else addMessageToChat("Chưa phát hiện vấn đề cụ thể.", "bot");
        } catch (e) {
            hideLoadingModal();
            addMessageToChat("Lỗi tìm chuyên gia.", "bot");
        }
    };
    container.insertBefore(btn, container.lastElementChild); // Insert trước nút gửi
}


// ============================================================
// 5. QUICK TEST (DASS-21)
// ============================================================
// (Giữ nguyên logic của bạn, chỉ thu gọn code hiển thị)

let currentTestData = null;
let userAnswers = [];
let currentQuestionIndex = 0;

function initializeQuickTestListeners() {
    startTest("dass21");
    const n = document.getElementById('btn-next'), p = document.getElementById('btn-prev');
    if (n) n.onclick = nextQuestion;
    if (p) p.onclick = prevQuestion;
}

async function startTest(topic) {
    try {
        const res = await fetch(`/static/${topic}.json`);
        currentTestData = await res.json();
        currentQuestionIndex = 0;
        userAnswers = new Array(currentTestData.questions.length).fill(null);

        if (document.getElementById("test-title"))
            document.getElementById("test-title").textContent = currentTestData.topic;

        displayQuestion(0);
        document.getElementById("question-container").style.display = "block";
        document.getElementById("result-container").style.display = "none";
        if (document.getElementById('btn-next')) document.getElementById('btn-next').style.display = "inline-block";
    } catch (e) { console.error(e); }
}

function displayQuestion(index) {
    if (!currentTestData) return;
    const q = currentTestData.questions[index];
    document.getElementById("question-text").textContent = q.text;
    const opts = document.getElementById("answer-options");
    opts.innerHTML = "";

    currentTestData.options.forEach(opt => {
        const div = document.createElement("div");
        div.className = "answer-option" + (userAnswers[index] === opt.value ? " selected" : "");
        div.textContent = opt.text;
        div.onclick = () => {
            userAnswers[index] = opt.value;
            Array.from(opts.children).forEach(c => c.classList.remove("selected"));
            div.classList.add("selected");
            updateProgressBar();
        };
        opts.appendChild(div);
    });
    updateNavigation();
    updateProgressBar();
}

function updateProgressBar() {
    const filled = userAnswers.filter(a => a !== null).length;
    document.getElementById("progressFill").style.width = `${(filled / currentTestData.questions.length) * 100}%`;
}

function updateNavigation() {
    const prev = document.getElementById('btn-prev');
    const next = document.getElementById('btn-next');
    if (prev) prev.style.display = currentQuestionIndex === 0 ? "none" : "inline-block";
    if (next) {
        if (currentQuestionIndex === currentTestData.questions.length - 1) next.innerHTML = 'Hoàn thành <i class="fas fa-check"></i>';
        else next.innerHTML = 'Tiếp theo <i class="fas fa-arrow-right"></i>';
    }
}

function nextQuestion() {
    if (userAnswers[currentQuestionIndex] === null) return alert("Vui lòng chọn câu trả lời!");
    if (currentQuestionIndex < currentTestData.questions.length - 1) {
        currentQuestionIndex++;
        displayQuestion(currentQuestionIndex);
    } else showResults();
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion(currentQuestionIndex);
    }
}

function showResults() {
    let scores = { D: 0, A: 0, S: 0 };
    currentTestData.questions.forEach((q, i) => scores[q.type] += (userAnswers[i] || 0) * 2);

    document.getElementById("question-container").style.display = "none";
    document.getElementById("btn-prev").style.display = "none";
    document.getElementById("btn-next").style.display = "none";
    document.getElementById("result-container").style.display = "block";

    const resultList = document.getElementById("result-list");
    resultList.innerHTML = `
        <li>Trầm cảm: ${scores.D} - <b>${getLevel(scores.D, 28, 21, 14, 10)}</b></li>
        <li>Lo âu: ${scores.A} - <b>${getLevel(scores.A, 20, 15, 10, 8)}</b></li>
        <li>Stress: ${scores.S} - <b>${getLevel(scores.S, 34, 26, 19, 15)}</b></li>
    `;

    const tags = getTagsFromDassScores(scores);
    saveDass21Results(userAnswers, tags, scores);

    if (tags.length > 0) {
        setTimeout(() => {
            if (confirm(`Phát hiện dấu hiệu: ${tags.map(formatTag).join(', ')}. Tìm chuyên gia?`)) findCounselorsFromTags(tags);
        }, 1500);
    }
}

function getLevel(s, v1, v2, v3, v4) {
    if (s >= v1) return "Rất nặng";
    if (s >= v2) return "Nặng";
    if (s >= v3) return "Vừa";
    if (s >= v4) return "Nhẹ";
    return "Bình thường";
}

function getTagsFromDassScores(scores) {
    const tags = [];
    if (scores.D >= 10) tags.push('tram_cam');
    if (scores.A >= 8) tags.push('lo_au');
    if (scores.S >= 15) tags.push('stress');
    return tags;
}

async function saveDass21Results(ans, tags, scores) {
    try {
        await fetch('/api/save-dass21-results', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers: ans, problem_tags: tags, scores: scores })
        });
    } catch (e) { }
}

function restartTest() { startTest("dass21"); }


// ============================================================
// 6. MATCHING SYSTEM & MODALS
// ============================================================

async function findCounselorsFromTags(tags) {
    showLoadingModal("Đang tìm chuyên gia...");
    try {
        const res = await fetch("/api/match/find", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ problem_tags: tags, only_online: true, min_rating: 4.0 })
        });
        const data = await res.json();
        hideLoadingModal();
        if (data.matches?.length > 0) displayMatchingResults(data);
        else alert("Không tìm thấy chuyên gia phù hợp lúc này.");
    } catch (e) { hideLoadingModal(); alert("Lỗi hệ thống."); }
}

function displayMatchingResults(data) {
    closeMatchingModal();
    const html = `
        <div class="matching-modal" id="matchingModal">
            <div class="matching-modal-content">
                <span class="close-modal" onclick="closeMatchingModal()">&times;</span>
                <h2>Chuyên gia phù hợp</h2>
                <div class="matching-results" id="matchingResultsList"></div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const container = document.getElementById('matchingResultsList');

    data.matches.forEach(c => {
        const div = document.createElement('div');
        div.className = 'match-card';
        div.setAttribute('data-expert-id', c.id); // Socket ID
        const isOnline = c.status === 'online';

        div.innerHTML = `
            <div class="match-info">
                <div style="display:flex; justify-content:space-between;">
                    <h3>${c.name}</h3>
                    <span class="status-badge ${isOnline ? 'online' : 'offline'}">${isOnline ? 'Online' : 'Offline'}</span>
                </div>
                <p>Độ phù hợp: ${c.match_score}%</p>
                <button class="btn-connect" onclick="${isOnline ? `window.location.href='/user/chat?expert=${c.id}'` : `checkAndOpenBooking('${c.id}')`}">
                    ${isOnline ? 'Kết nối ngay' : 'Đặt lịch hẹn'}
                </button>
            </div>`;
        container.appendChild(div);
    });
}

function closeMatchingModal() { document.getElementById('matchingModal')?.remove(); }
function showLoadingModal(msg) { hideLoadingModal(); document.body.insertAdjacentHTML('beforeend', `<div class="loading-modal" id="loadingModal"><div class="loading-content"><div class="spinner"></div><p>${msg}</p></div></div>`); }
function hideLoadingModal() { document.getElementById('loadingModal')?.remove(); }
function formatTag(t) { const map = { 'stress': 'Stress', 'lo_au': 'Lo âu', 'tram_cam': 'Trầm cảm', 'hoc_tap': 'Học tập' }; return map[t] || t; }


// ============================================================
// 7. COUNSELOR LOGIC (CALENDAR & REAL-TIME - NEW CODE)
// ============================================================

function initializeCounselorScheduleLogic() {
    // Chỉ chạy nếu có DatePicker (Giao diện Counselor)
    const datePickerEl = document.getElementById('counselorDatePicker');
    if (!datePickerEl) return;

    // --- BIẾN CỤC BỘ (QUAN TRỌNG: Để tất cả hàm bên dưới đều dùng được) ---
    let selectedDate = null;
    let currentSelectedSlot = null;
    let fpInstance;

    // 1. Hàm vẽ giao diện (Render Slots)
    function renderSlots(savedSlots, bookedInfo) {
        const container = document.getElementById('counselorSlotContainer');
        if (!container) return;
        container.innerHTML = ''; 
        
        currentSelectedSlot = null; // Reset lựa chọn

        // Tạo giờ cố định 08:00 - 17:00
        const allTimeSlots = [];
        for (let i = 8; i <= 17; i++) {
            allTimeSlots.push((i < 10 ? '0' : '') + i + ":00");
        }

        allTimeSlots.forEach(time => {
            const btn = document.createElement('button');
            btn.className = 'slot-btn';
            
            // Style inline (Nên đưa vào CSS)
            btn.style.width = '100%';
            btn.style.minHeight = '60px';
            btn.style.padding = '10px';
            btn.style.borderRadius = '8px';
            btn.style.border = '1px solid #ddd';
            btn.style.cursor = 'pointer';
            btn.style.display = 'flex';
            btn.style.flexDirection = 'column';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.fontWeight = 'bold';
            btn.style.background = 'white';

            // Check trạng thái
            const studentName = bookedInfo ? bookedInfo[time] : null;

            if (studentName) {
                // ĐÃ CÓ HẸN -> MÀU ĐỎ
                btn.style.backgroundColor = '#fee2e2'; 
                btn.style.color = '#b91c1c';
                btn.style.borderColor = '#fca5a5';
                btn.disabled = true;
                btn.innerHTML = `
                    <span>${time}</span>
                    <span style="font-size: 11px; font-weight: normal; margin-top: 5px;">
                        <i class="fas fa-user"></i> ${studentName}
                    </span>
                `;
            } else {
                // TRỐNG -> MÀU TRẮNG
                btn.style.backgroundColor = 'white';
                btn.style.color = '#333';
                btn.innerHTML = `<span>${time}</span>`;
                
                btn.onclick = function() {
                    // Reset các nút khác
                    container.querySelectorAll('.slot-btn').forEach(b => {
                        if (!b.disabled) {
                            b.style.backgroundColor = 'white';
                            b.style.color = '#333';
                            b.dataset.selected = "false";
                        }
                    });
                    // Highlight nút chọn
                    this.style.backgroundColor = '#4f46e5';
                    this.style.color = 'white';
                    this.dataset.selected = "true";
                    currentSelectedSlot = time;
                };
            }
            container.appendChild(btn);
        });
    }

    // 2. Hàm tải dữ liệu từ Server
    async function loadSlotsForDate(date) {
        const container = document.getElementById('counselorSlotContainer');
        if (!container) return;
        container.innerHTML = '<div class="spinner"></div>';

        try {
            // Gọi API lấy slot và thông tin booking
            const res = await fetch(`/api/counselor/get-slots?username=${currentUserUsername}&date=${date}`);
            const data = await res.json();
            
            // Gọi hàm render đã định nghĩa ở trên
            renderSlots(data.slots || [], data.booked || {});
        } catch (e) {
            console.error(e);
            container.innerHTML = '<p style="color:red">Lỗi tải dữ liệu.</p>';
        }
    }

    // 3. Khởi tạo Lịch (Flatpickr)
    if (typeof flatpickr !== 'undefined') {
        fpInstance = flatpickr("#counselorDatePicker", { 
            minDate: "today", 
            dateFormat: "Y-m-d", 
            locale: "vn",
            onChange: function(dates, dateStr) {
                selectedDate = dateStr;
                
                // Mở khóa vùng hiển thị (Quan trọng)
                const slotArea = document.getElementById('slot-selection-area');
                if (slotArea) slotArea.style.display = 'block'; 
                
                document.getElementById('counselorSlotContainer').style.display = 'grid'; 
                loadSlotsForDate(dateStr);
            }
        });
    }

    // 4. Xử lý nút "Tạo cuộc hẹn"
    const btnCreate = document.getElementById('btnCreateAppointment');
    if (btnCreate) {
        // Xóa listener cũ (nếu có) để tránh double click
        const newBtn = btnCreate.cloneNode(true);
        btnCreate.parentNode.replaceChild(newBtn, btnCreate);

        newBtn.addEventListener('click', async () => {
            const studentInput = document.getElementById('manualStudentInput');
            const studentName = studentInput ? studentInput.value.trim() : "";

            if (!selectedDate) return alert("Vui lòng chọn ngày!");
            if (!currentSelectedSlot) return alert("Vui lòng chọn một khung giờ trống!");
            if (!studentName) return alert("Vui lòng nhập tên sinh viên!");

            const originalText = newBtn.innerHTML;
            newBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
            newBtn.disabled = true;

            try {
                const res = await fetch('/api/counselor/create-manual-appointment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        date: selectedDate,
                        time: currentSelectedSlot,
                        student_name: studentName
                    })
                });
                const data = await res.json();

                if (res.ok) {
                    alert("Tạo lịch hẹn thành công!");
                    if(studentInput) studentInput.value = ""; 
                    loadSlotsForDate(selectedDate); // Reload lại màu đỏ
                } else {
                    alert(data.message || "Lỗi khi tạo lịch.");
                }
            } catch (e) {
                alert("Lỗi kết nối server.");
            } finally {
                newBtn.innerHTML = originalText;
                newBtn.disabled = false;
            }
        });
    }

    // 5. Real-time Listener (Cập nhật màu đỏ ngay khi có người đặt)
    // Đặt trong setTimeout để đảm bảo socket đã kết nối
    setTimeout(() => {
        if (typeof expertSocket !== 'undefined' && expertSocket) {
            expertSocket.off('booking_confirmed'); // Xóa listener cũ tránh trùng
            expertSocket.on('booking_confirmed', (data) => {
                // Nếu đúng là ngày đang xem và đúng là mình
                if (selectedDate === data.date && currentUserUsername === data.counselor_username) {
                    loadSlotsForDate(selectedDate);
                    
                    // Toast thông báo
                    const toast = document.createElement('div');
                    toast.className = 'custom-toast'; // Cần CSS
                    toast.style.position = 'fixed';
                    toast.style.bottom = '20px';
                    toast.style.right = '20px';
                    toast.style.background = '#10b981';
                    toast.style.color = 'white';
                    toast.style.padding = '12px 20px';
                    toast.style.borderRadius = '8px';
                    toast.style.zIndex = '9999';
                    toast.innerHTML = `📅 Khách mới đặt lịch lúc ${data.time}`;
                    document.body.appendChild(toast);
                    setTimeout(() => toast.remove(), 3000);
                }
            });
        }
    }, 2000);

    // 6. Xử lý chuyển Tab (Giữ nguyên)
    const tabs = { 'tab-overview': 'view-overview', 'tab-schedule': 'view-schedule', 'tab-history': 'view-history' };
    Object.keys(tabs).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('.dashboard-menu a').forEach(a => a.classList.remove('active'));
            el.classList.add('active');
            Object.values(tabs).forEach(v => {
                const view = document.getElementById(v);
                if(view) view.style.display = 'none';
            });
            const activeView = document.getElementById(tabs[id]);
            if(activeView) activeView.style.display = 'block';
            
            if (id === 'tab-history') loadHistoryLogs();
        }
    });

    // 7. Hàm tải lịch sử log (cho tab History)
    // 7. Hàm tải lịch sử cuộc hẹn (ĐÃ CẬP NHẬT: Hiển thị tên SV)
    async function loadHistoryLogs() {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Đang tải dữ liệu...</td></tr>';
        
        try {
            // Gọi API mới vừa tạo ở Bước 1
            const res = await fetch("/api/counselor/appointments");
            const data = await res.json();
            
            tbody.innerHTML = '';
            
            if (data.appointments && data.appointments.length > 0) {
                data.appointments.forEach(appt => {
                    const tr = document.createElement('tr');
                    
                    // Xác định màu trạng thái
                    let statusColor = 'green';
                    let statusText = 'Đã xác nhận';
                    if (appt.status === 'cancelled') {
                        statusColor = 'red';
                        statusText = 'Đã hủy';
                    }

                    tr.innerHTML = `
                        <td style="padding: 12px; border-bottom: 1px solid #eee;">
                            <div style="font-weight:bold; color:var(--primary)">${appt.time}</div>
                            <div style="font-size:0.9em; color:#666">${appt.date}</div>
                        </td>
                        <td style="padding: 12px; border-bottom: 1px solid #eee;">
                            <i class="fas fa-user-graduate" style="color:#666; margin-right:5px;"></i>
                            <b>${appt.student_name}</b>
                        </td>
                        <td style="padding: 12px; border-bottom: 1px solid #eee;">
                            <span style="color:${statusColor}; font-weight:500; padding: 4px 8px; background: ${statusColor === 'red' ? '#fee2e2' : '#dcfce7'}; border-radius: 4px;">
                                ${statusText}
                            </span>
                        </td>
                        <td style="padding: 12px; border-bottom: 1px solid #eee;">
                            ${appt.status === 'confirmed' ? 
                                `<button onclick="cancelAppointment('${appt.id}')" style="color:red; background:none; border:1px solid red; padding:5px 10px; border-radius:5px; cursor:pointer; font-size:0.8em;">
                                    Hủy
                                </button>` : '-'}
                        </td> 
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Chưa có cuộc hẹn nào.</td></tr>';
            }
        } catch (e) { 
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Lỗi tải dữ liệu.</td></tr>'; 
        }
    }

    // Hàm hỗ trợ hủy lịch (Thêm vào bên ngoài hoặc bên trong initializeCounselorScheduleLogic đều được, nhưng tốt nhất để global scope để HTML gọi được)
    window.cancelAppointment = async function(id) {
        if(!confirm("Bạn có chắc chắn muốn hủy cuộc hẹn này không?")) return;
        
        try {
            const res = await fetch('/api/booking/cancel', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({id: id})
            });
            
            if(res.ok) {
                alert("Đã hủy thành công!");
                loadHistoryLogs(); // Tải lại bảng
                // Reload lại các slot ở tab Lịch
                if(selectedDate) loadSlotsForDate(selectedDate);
            } else {
                alert("Lỗi khi hủy.");
            }
        } catch(e) {
            alert("Lỗi kết nối.");
        }
    };
}
    // ============================================================
    // 8. USER DASHBOARD LOGIC
    // ============================================================

    function initializeUserDashboardLogic() {
        if (!document.getElementById('user-view-overview')) return;

        const userTabs = { 'tab-overview': 'user-view-overview', 'tab-schedule': 'user-view-booking', 'tab-history': 'user-view-history' };
        Object.keys(userTabs).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.onclick = (e) => {
                e.preventDefault();
                document.querySelectorAll('.dashboard-menu a').forEach(a => a.classList.remove('active'));
                el.classList.add('active');
                Object.values(userTabs).forEach(v => document.getElementById(v).style.display = 'none');
                document.getElementById(userTabs[id]).style.display = 'block';
                if (id === 'tab-schedule') loadAvailableCounselors();
                if (id === 'tab-history') loadUserHistory();
            }
        });

        async function loadUserHistory() {
            const tbody = document.getElementById('user-history-body');
            if (!tbody) return;
            tbody.innerHTML = '<tr><td colspan="4">Đang tải...</td></tr>';
            try {
                const res = await fetch('/api/user/appointments');
                const data = await res.json();
                tbody.innerHTML = '';
                if (data.appointments?.length) {
                    data.appointments.forEach(a => {
                        const isConf = a.status === 'confirmed';
                        const btn = isConf ? `<button onclick="cancelBooking('${a.id}')" style="color:red;border:1px solid red;">Hủy</button>` : '';
                        const tr = document.createElement('tr');
                        tr.innerHTML = `<td>${a.date}<br><b>${a.time}</b></td><td>${a.counselor}</td><td style="color:${isConf ? 'green' : 'gray'}">${isConf ? 'Đã xác nhận' : 'Đã hủy'}</td><td>${btn}</td>`;
                        tbody.appendChild(tr);
                    });
                } else tbody.innerHTML = '<tr><td colspan="4">Chưa có lịch hẹn.</td></tr>';
            } catch (e) { tbody.innerHTML = '<tr><td colspan="4">Lỗi tải.</td></tr>'; }
        }
    }

    async function cancelBooking(id) {
        if (!confirm("Hủy lịch hẹn này?")) return;
        try {
            await fetch('/api/booking/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
            document.getElementById('tab-history').click(); // Reload
        } catch (e) { alert("Lỗi khi hủy."); }
    }


    // ============================================================
    // 9. BOOKING SYSTEM & STATUS CHECK
    // ============================================================

    async function checkAndOpenBooking(counselorId) {
        try {
            const res = await fetch('/api/booking/check-existing');
            if (res.ok) {
                const data = await res.json();
                if (data.existing) {
                    if (confirm(`Bạn đã có lịch với ${data.existing.counselor}. Hủy lịch cũ để đặt mới?`)) {
                        await fetch('/api/booking/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: data.existing.id }) });
                        fetchDatesAndOpenModal(counselorId);
                    }
                } else fetchDatesAndOpenModal(counselorId);
            } else fetchDatesAndOpenModal(counselorId);
        } catch (e) { fetchDatesAndOpenModal(counselorId); }
    }

    async function fetchDatesAndOpenModal(counselorId) {
        currentBookingCounselorId = counselorId;
        try {
            const res = await fetch(`/api/counselor/get-dates?username=${counselorId}`);
            const data = await res.json();
            if (!data.dates?.length) return alert("Chuyên gia chưa cập nhật lịch rảnh.");

            const sel = document.getElementById('bookingDate');
            sel.innerHTML = '<option value="">-- Chọn ngày --</option>';
            data.dates.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d; opt.textContent = d;
                sel.appendChild(opt);
            });
            document.getElementById('bookingModal').classList.add('active');
            document.getElementById('bookingSlots').innerHTML = '';
            document.getElementById('bookingCounselorName').textContent = "Đặt lịch với " + counselorId;
        } catch (e) { alert("Lỗi tải lịch."); }
    }

    function closeBookingModal() { document.getElementById('bookingModal')?.classList.remove('active'); }

    // Event listener cho Modal Booking
    const bookingDateEl = document.getElementById('bookingDate');
    if (bookingDateEl) {
        bookingDateEl.addEventListener('change', async function () {
            const date = this.value;
            const slotsDiv = document.getElementById('bookingSlots');
            if (!date) return;
            slotsDiv.innerHTML = 'Loading...';

            const res = await fetch(`/api/counselor/get-slots?username=${currentBookingCounselorId}&date=${date}`);
            const data = await res.json();
            slotsDiv.innerHTML = '';

            if (data.slots?.length) {
                data.slots.forEach(t => {
                    const btn = document.createElement('button');
                    btn.className = 'slot-btn'; btn.textContent = t; type = "button";
                    btn.style.cssText = "padding:10px; margin:5px; border:1px solid #ddd; cursor:pointer;";
                    btn.onclick = () => {
                        document.querySelectorAll('#bookingSlots .slot-btn').forEach(b => b.style.background = 'white');
                        btn.style.background = '#4f46e5'; btn.style.color = 'white';
                        document.getElementById('selectedTime').value = t;
                    };
                    slotsDiv.appendChild(btn);
                });
            } else slotsDiv.textContent = "Ngày này đã kín.";
        });
    }

    document.getElementById('bookingForm')?.addEventListener('submit', async function (e) {
        e.preventDefault();
        const date = document.getElementById('bookingDate').value;
        const time = document.getElementById('selectedTime').value;
        if (!date || !time) return alert("Chọn ngày giờ!");

        try {
            const res = await fetch('/api/booking/book', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ counselor_username: currentBookingCounselorId, date, time })
            });
            if (res.ok) { alert("Đặt lịch thành công!"); window.location.reload(); }
            else alert("Lỗi đặt lịch.");
        } catch (e) { alert("Lỗi kết nối."); }
    });


    // ============================================================
    // 10. REAL-TIME CHAT & EXPERT SOCKET
    // ============================================================

    function initializeCounselorChat(username) {
        if (!expertSocket) expertSocket = io();

        expertSocket.on('connect', () => {
            expertSocket.emit('counselor_join_room', { room: username });
        });

        expertSocket.on('receive_message', (data) => {
            // Logic xử lý tin nhắn đến (hiển thị sidebar, badge,...)
            // (Rút gọn cho ngắn, bạn có thể giữ nguyên logic cũ nếu cần chi tiết hơn)
            if (data.sender_type !== 'system') {
                // Cập nhật UI tin nhắn...
                const sender = data.sender_type === 'user' ? data.sender_id : data.target_student_id;
                if (sender) {
                    // saveMessageToLocal... (cần định nghĩa hàm lưu trữ nếu muốn persistent ở Client)
                    // updateSidebar...
                }
            }
        });

        // Status Updates
        expertSocket.on('expert_status_change', (data) => {
            updateExpertStatusUI(data.username, data.status);
        });
    }
    async function refreshExpertStatusOnLoadAll() {
        try {
            const res = await fetch('/api/counselors/all');
            const data = await res.json();
            data.counselors?.forEach(c => updateExpertStatusUI(c.id, c.status));
        } catch (e) { console.error(e); }
    }

    function updateExpertStatusUI(id, status) {
        const cards = document.querySelectorAll(`[data-expert-id="${id}"]`);
        cards.forEach(card => {
            const badge = card.querySelector('.status-badge') || card.querySelector('.expert-status');
            const btn = card.querySelector('.btn-chat') || card.querySelector('.btn-connect-counselor');

            if (status === 'online') {
                if (badge) { badge.className = 'status-badge online'; badge.innerHTML = 'Online'; }
                if (btn) { btn.textContent = 'Chat ngay'; btn.disabled = false; btn.onclick = () => window.location.href = `/user/chat?expert=${id}`; }
            } else {
                if (badge) { badge.className = 'status-badge offline'; badge.innerHTML = 'Offline'; }
                if (btn) { btn.textContent = 'Chat (Offline)'; btn.disabled = true; }
            }
        });
    }

    // -------------------------------------------------------------
    // HELPER: Load Expert List with Status
    // -------------------------------------------------------------
    async function loadAvailableCounselors() {
        const el = document.getElementById('available-counselors-list');
        if (!el) return;
        el.innerHTML = '<div class="spinner"></div>';
        try {
            const res = await fetch('/api/counselors/availability'); // Hoặc API all
            const data = await res.json();
            el.innerHTML = '';
            if (data.counselors?.length) {
                data.counselors.forEach(c => {
                    const isOnline = c.status === 'online';
                    const div = document.createElement('div');
                    div.className = 'expert-card';
                    div.setAttribute('data-expert-id', c.username);
                    div.innerHTML = `
                    <div style="padding:1.5rem;text-align:center;">
                        <h4>${c.name}</h4>
                        <span class="status-badge ${isOnline ? 'online' : 'offline'}">${isOnline ? 'Online' : 'Offline'}</span>
                        <button class="btn-connect" onclick="${isOnline ? `window.location.href='/user/chat?expert=${c.username}'` : `checkAndOpenBooking('${c.username}')`}">
                            ${isOnline ? 'Chat ngay' : 'Đặt lịch'}
                        </button>
                    </div>`;
                    el.appendChild(div);
                });
            } else el.innerHTML = '<p>Chưa có chuyên gia rảnh.</p>';
        } catch (e) { el.innerHTML = 'Lỗi tải.'; }
    }
