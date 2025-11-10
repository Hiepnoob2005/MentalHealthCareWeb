/**
 * File này chỉ dùng cho trang index.html
 * Logic đăng nhập: SỬ DỤNG MODAL
 */

// --- Global Initializations & DOM Loading ---
document.addEventListener("DOMContentLoaded", function () {
  // 1. Kiểm tra trạng thái đăng nhập
  checkLoginStatus();

  // 2. Khởi tạo Conversation ID cho Chatbot
  const currentConversationId = getConversationId();
  console.log(`Chatbot Session ID: ${currentConversationId}`);

  // 3. Gán Event Listeners
  initializeScrollEffects();
  initializeLoginModalListeners();
  initializeQuickTestListeners();
  initializeChatbotListeners();
  initializeResourceFilters();

  // Khởi tạo thanh tiến độ cho Quick Test
  updateProgress();
});

// --- Authentication (Đăng nhập/Đăng xuất) ---

/**
 * 1. Kiểm tra xem người dùng đã đăng nhập chưa khi tải trang
 */
async function checkLoginStatus() {
  try {
    const response = await fetch("http://127.0.0.1:5000/api/status");
    if (!response.ok) {
      // NẾU CHƯA ĐĂNG NHẬP (hoặc server lỗi):
      // Gán sự kiện cho các nút CTA khác để MỞ MODAL
      initializeCTAListeners();
      return; 
    }

    const data = await response.json();
    if (data.logged_in && data.username) {
      // Nếu đã đăng nhập, cập nhật giao diện
      updateUIAfterLogin(data.username);
    } else {
      // NẾU CHƯA ĐĂNG NHẬP:
      // Gán sự kiện cho các nút CTA khác để MỞ MODAL
      initializeCTAListeners();
    }
  } catch (err) {
    console.error("Lỗi kiểm tra trạng thái:", err);
    // Nếu không kết nối được server, vẫn gán listener cho modal
    initializeCTAListeners();
  }
}

/**
 * 2. Cập nhật nút CTA trên Navbar VÀ THAY ĐỔI STYLE
 */
function updateUIAfterLogin(username) {
  const ctaButton = document.getElementById("navbarCtaButton");
  if (ctaButton) {
    // SỬA LỖI: Hiển thị đúng tên username
    ctaButton.textContent = `Xin chào, ${username}`;
    ctaButton.href = "#"; // Bỏ link đến trang login/modal

    // --- SỬA LỖI LAYOUT VỚI TÊN DÀI ---
    // Thêm các style này để đảm bảo nút vừa vặn và không vỡ layout
    ctaButton.style.maxWidth = "200px"; // Giới hạn chiều rộng tối đa
    ctaButton.style.overflow = "hidden"; // Ẩn phần bị tràn
    ctaButton.style.textOverflow = "ellipsis"; // Thêm dấu "..."
    ctaButton.style.whiteSpace = "nowrap"; // Giữ trên một dòng
    ctaButton.style.display = 'inline-block'; // Đảm bảo các thuộc tính overflow hoạt động
    ctaButton.style.verticalAlign = 'middle'; // Căn giữa
    // --- KẾT THÚC SỬA LỖI LAYOUT ---

    // Thêm sự kiện click để Đăng xuất
    ctaButton.onclick = (e) => {
      e.preventDefault();
      handleLogout();
    };
  }

  // --- BẮT ĐẦU STYLE MỚI KHI ĐĂNG NHẬP ---

  // 1. Thay đổi tiêu đề Hero
  const heroTitle = document.querySelector('.hero-content h1');
  if (heroTitle) {
    heroTitle.innerHTML = `Chào mừng trở lại, <span class="highlight">${username}</span>!`;
  }

  // 2. Thay đổi phụ đề Hero
  const heroSubtitle = document.querySelector('.hero-content p');
  if (heroSubtitle) {
    heroSubtitle.textContent = "Bạn đã sẵn sàng cho buổi đánh giá tiếp theo, trò chuyện với AI hay kết nối với một chuyên gia chưa?";
  }

  // 3. Thay đổi nút "Kết nối ngay"
  document.querySelectorAll('.btn-connect:not([disabled])').forEach(btn => {
    btn.textContent = 'Đặt lịch hẹn';
    // Tùy chọn: Thêm một hành động mới (ví dụ: chuyển đến trang /booking)
    // btn.onclick = () => { window.location.href = '/booking.html'; };
  });
  
  // --- KẾT THÚC STYLE MỚI ---
}

/**
 * 3. Xử lý Đăng xuất
 */
async function handleLogout() {
  if (!confirm("Bạn có chắc chắn muốn đăng xuất?")) {
    return;
  }
  try {
    const response = await fetch("http://127.0.0.1:5000/api/logout", {
      method: "POST",
    });
    const data = await response.json();
    if (response.ok) {
      alert(data.message);
      window.location.reload(); // Tải lại trang
    } else {
      alert("Đăng xuất thất bại. Vui lòng thử lại.");
    }
  } catch (err) {
    console.error("Lỗi đăng xuất:", err);
  }
}

// --- Login Modal Functions (Logic Modal) ---

/**
 * HÀM MỚI (THÊM VÀO): Xử lý submit form đăng nhập từ Modal
 */
async function handleLoginSubmit(event) {
  event.preventDefault();
  const messageElId = "loginMessage"; // ID của div thông báo trong modal
  showFormMessage(messageElId, "Đang xử lý...", false);

  const form = event.target;
  const username = form.username.value;
  const password = form.password.value;

  if (!username || !password) {
    showFormMessage(messageElId, "Vui lòng nhập tên đăng nhập và mật khẩu.", true);
    return;
  }

  try {
    const response = await fetch("http://127.0.0.1:5000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Đăng nhập thất bại.");
    }

    // ĐĂNG NHẬP THÀNH CÔNG
    showFormMessage(messageElId, "Đăng nhập thành công! Đang tải lại...", false);
    setTimeout(() => {
      window.location.reload(); // Tải lại trang để cập nhật giao diện
    }, 1000);

  } catch (err) {
    showFormMessage(messageElId, err.message, true);
  }
}

function openLoginModal() {
  const modal = document.getElementById("loginModal");
  if(modal) modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeLoginModal() {
  const modal = document.getElementById("loginModal");
  if(modal) modal.classList.remove("active");
  document.body.style.overflow = "auto";
}

/**
 * SỬA LỖI: Gắn hàm handleLoginSubmit vào form
 */
function initializeLoginModalListeners() {
  const loginModal = document.getElementById("loginModal");
  if (loginModal) {
    // Đóng modal khi bấm ra ngoài
    loginModal.addEventListener("click", function (e) {
      if (e.target === this) {
        closeLoginModal();
      }
    });
    
    // Đóng modal khi bấm nút close
    const closeBtn = loginModal.querySelector(".modal-close");
    if(closeBtn) closeBtn.onclick = closeLoginModal;

    // Gắn hàm xử lý submit form
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", handleLoginSubmit); // <- SỬA Ở ĐÂY
    }
  }
}

/**
 * SỬA LỖI: Đây là hàm gán sự kiện cho các nút CTA khi CHƯA đăng nhập
 */
function initializeCTAListeners() {
  const ctaSelectors = [
    ".btn-cta",
    ".btn-primary", // Hero section "Đánh giá ngay"
    ".btn-connect:not([disabled])", // Connect buttons on expert cards
  ];

  ctaSelectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((btn) => {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        // Mở modal đăng nhập
        openLoginModal();
      });
    });
  });

  // Gán sự kiện cho nút CTA chính trên Navbar (nếu nó tồn tại)
  const navbarCta = document.getElementById("navbarCtaButton");
  if (navbarCta && navbarCta.getAttribute('href') !== '#') { // Chỉ gán nếu chưa đăng nhập
      navbarCta.addEventListener("click", (e) => {
          e.preventDefault();
          openLoginModal();
      });
  }
}

/**
 * HÀM MỚI (THÊM VÀO): Hiển thị thông báo trên form
 */
function showFormMessage(elementId, message, isError = false) {
  const messageEl = document.getElementById(elementId);
  if (messageEl) {
    messageEl.textContent = message;
    messageEl.style.color = isError ? "#ef4444" : "#10b981"; // Đỏ hoặc Xanh
    messageEl.style.display = "block";
  }
}

// --- Navigation and Scrolling ---
function initializeScrollEffects() {
  // Smooth scroll for navigation links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      // Chỉ cuộn nếu người dùng đã đăng nhập (hoặc nếu link là an toàn)
      const isLoggedIn = !!document.getElementById("navbarCtaButton")?.href.endsWith("#");
      const targetHref = this.getAttribute("href");

      // Nếu chưa đăng nhập VÀ link là #test, #experts, #dashboard -> Mở modal
      if (!isLoggedIn && (targetHref === '#test' || targetHref === '#experts' || targetHref === '#dashboard')) {
        openLoginModal();
        return;
      }
      
      // Nếu đã đăng nhập hoặc link an toàn (như #home, #features)
      const target = document.querySelector(targetHref);
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });

  // Navbar scroll effect
  window.addEventListener("scroll", function () {
    const navbar = document.querySelector(".navbar");
    if (window.scrollY > 50) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }
  });
}

// --- Quick Test functionality ---
let currentQuestion = 1;
const totalQuestions = 3;

function initializeQuickTestListeners() {
    // Không cần gán sự kiện ở đây nếu các nút Next/Prev gọi trực tiếp hàm
    // trong HTML (ví dụ: onclick="nextQuestion()").
}

function selectAnswer(element) {
    const options = element.parentElement.querySelectorAll(".answer-option");
    options.forEach((opt) => opt.classList.remove("selected"));
    element.classList.add("selected");
}

function nextQuestion() {
    if (currentQuestion < totalQuestions) {
        document
            .querySelector(`.question-card[data-question="${currentQuestion}"]`)
            .classList.remove("active");
        currentQuestion++;
        document
            .querySelector(`.question-card[data-question="${currentQuestion}"]`)
            .classList.add("active");
        updateProgress();
    } else {
        showTestResults();
    }
}

function prevQuestion() {
    if (currentQuestion > 1) {
        document
            .querySelector(`.question-card[data-question="${currentQuestion}"]`)
            .classList.remove("active");
        currentQuestion--;
        document
            .querySelector(`.question-card[data-question="${currentQuestion}"]`)
            .classList.add("active");
        updateProgress();
    }
}

function updateProgress() {
    const progressFill = document.getElementById("progressFill");
    if (progressFill) {
        progressFill.style.width = `${(currentQuestion / totalQuestions) * 100}%`;
    }
}

function showTestResults() {
    alert(
        "Cảm ơn bạn đã hoàn thành bài đánh giá! Kết quả sẽ được gửi đến dashboard của bạn."
    );
    currentQuestion = 1;
    document
        .querySelectorAll(".question-card")
        .forEach((card) => card.classList.remove("active"));
    // Đảm bảo thẻ câu hỏi đầu tiên luôn được kích hoạt lại
    const firstQuestion = document.querySelector('.question-card[data-question="1"]');
    if (firstQuestion) {
        firstQuestion.classList.add("active");
    }
    document
        .querySelectorAll(".answer-option")
        .forEach((opt) => opt.classList.remove("selected"));
    updateProgress();
}


// --- Chatbot functionality (Integrated Gemini AI) ---

// Quản lý phiên chat (Conversation ID)
function getConversationId() {
    let conversationId = localStorage.getItem('gemini-chat-session-id');
    if (!conversationId) {
        // Tạo ID duy nhất nếu chưa tồn tại
        conversationId = self.crypto.randomUUID(); 
        localStorage.setItem('gemini-chat-session-id', conversationId);
    }
    return conversationId;
}

function toggleChatbot() {
    const chatWindow = document.getElementById("chatbotWindow");
    if (chatWindow) {
        chatWindow.classList.toggle("active");
    }
}

function addMessageToChat(text, sender) { // Đổi tên hàm từ 'addMessage'
    const messagesContainer = document.getElementById("chatMessages");
    if (!messagesContainer) return;

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = sender === "bot" ? "AI" : "You";

    const content = document.createElement("div");
    content.className = "message-content";
    content.textContent = text;

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    messagesContainer.appendChild(messageDiv);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById("chatMessages");
    if (!messagesContainer) return;

    const typingDiv = document.createElement("div");
    typingDiv.className = "message bot typing-message";
    typingDiv.innerHTML = `
                <div class="message-avatar">AI</div>
                <div class="typing-indicator">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                </div>
            `;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeTypingIndicator() {
    const typingMessage = document.querySelector(".typing-message");
    if (typingMessage) {
        typingMessage.remove();
    }
}

async function handleSendMessage(event) {
    if (event) event.preventDefault(); // Ngăn chặn submit form nếu được gọi từ form

    const input = document.getElementById("chatInput");
    const message = input.value.trim();
    const conversationId = getConversationId();

    if (!message) return;

    // 1. Hiển thị tin nhắn người dùng
    addMessageToChat(message, "user");
    input.value = ""; // Xóa nội dung input

    // 2. Hiển thị chỉ báo "đang gõ"
    showTypingIndicator();

    try {
        // 3. Gửi tin nhắn đến API backend Flask (cổng 5000)
        const response = await fetch("http://127.0.0.1:5000/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                message: message,
                conversationId: conversationId // Gửi ID phiên chat để duy trì ngữ cảnh
            }),
        });

        if (!response.ok) {
            // Xử lý lỗi HTTP (ví dụ: 404, 500)
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // 4. Xóa chỉ báo và hiển thị phản hồi AI
        removeTypingIndicator();
        addMessageToChat(data.reply, "bot");

    } catch (err) {
        removeTypingIndicator();
        console.error("Lỗi kết nối Gemini API:", err);
        addMessageToChat("Xin lỗi, hệ thống AI đang gặp sự cố. Vui lòng thử lại hoặc kiểm tra server backend.", "bot");
    }
}

function handleChatInputKey(event) {
    // Xử lý Enter key (không phải Shift+Enter)
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault(); 
        handleSendMessage();
    }
}

function initializeChatbotListeners() {
    const chatInput = document.getElementById("chatInput");
    const sendButton = document.getElementById("sendButton"); 
    const toggleButton = document.getElementById("chatbotToggle");
    const toggleChatbotBox = document.getElementById("chatbotTogglen")

    if (chatInput) {
        chatInput.addEventListener('keypress', handleChatInputKey);
    }
    
    // Gắn sự kiện cho nút gửi (nếu có)
    if (sendButton) {
        sendButton.addEventListener('click', handleSendMessage);
    }

    // Gắn sự kiện cho nút toggle (nếu có)
    if (toggleButton) {
        toggleButton.addEventListener('click', toggleChatbot);
    }

    if (toggleChatbotBox) {
        toggleChatbotBox.addEventListener('click', toggleChatbot);
    }
}

// --- Category filter for resources ---
function initializeResourceFilters() {
    document.querySelectorAll(".category-btn").forEach((btn) => {
        btn.addEventListener("click", function () {
            document
                .querySelectorAll(".category-btn")
                .forEach((b) => b.classList.remove("active"));
            this.classList.add("active");
            // Add actual filtering logic here (cần triển khai logic lọc tài nguyên)
        });
    });
}

// --- Matching System Functions ---
// --- Thêm vào ngày 10/11/2025 ---
async function findMatchingCounselors(problemTags) {
    try {
        const response = await fetch("http://127.0.0.1:5000/api/match/find", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                problem_tags: problemTags,
                only_online: true,
                min_rating: 4.0
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error("Error finding matches:", error);
        return null;
    }
}

async function matchFromTestResults() {
    // Lấy câu trả lời từ Quick Test
    const answers = {};
    
    // Question 1
    const q1Selected = document.querySelector('.question-card[data-question="1"] .answer-option.selected');
    if (q1Selected) answers.q1 = q1Selected.textContent.trim();
    
    // Question 2  
    const q2Selected = document.querySelector('.question-card[data-question="2"] .answer-option.selected');
    if (q2Selected) answers.q2 = q2Selected.textContent.trim();
    
    // Question 3
    const q3Selected = document.querySelector('.question-card[data-question="3"] .answer-option.selected');
    if (q3Selected) answers.q3 = q3Selected.textContent.trim();
    
    if (Object.keys(answers).length === 0) {
        alert("Vui lòng trả lời các câu hỏi trước!");
        return;
    }

    try {
        const response = await fetch("http://127.0.0.1:5000/api/match/from-test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answers })
        });

        const data = await response.json();
        
        if (data.matches && data.matches.length > 0) {
            displayMatchingResults(data);
        } else {
            alert("Không tìm thấy chuyên gia phù hợp. Vui lòng thử lại!");
        }

    } catch (error) {
        console.error("Error matching from test:", error);
        alert("Lỗi khi tìm chuyên gia. Vui lòng thử lại!");
    }
}

function displayMatchingResults(data) {
    // Tạo modal hiển thị kết quả matching
    const modalHTML = `
        <div class="matching-modal" id="matchingModal">
            <div class="matching-modal-content">
                <span class="close-modal" onclick="closeMatchingModal()">&times;</span>
                <h2>Chuyên gia phù hợp cho bạn</h2>
                <p class="detected-tags">Vấn đề được phát hiện: ${data.search_tags.join(', ')}</p>
                <div class="matching-results">
                    ${data.matches.map(counselor => `
                        <div class="match-card">
                            <div class="match-info">
                                <h3>${counselor.name}</h3>
                                <p class="match-score">Độ phù hợp: ${counselor.match_score}%</p>
                                <p>Kinh nghiệm: ${counselor.experience}</p>
                                <div class="specialties">
                                    ${counselor.specialties.map(s => `<span class="tag">${s}</span>`).join('')}
                                </div>
                                <div class="rating">
                                    <span class="stars">${'⭐'.repeat(Math.round(counselor.rating))}</span>
                                    ${counselor.rating}
                                </div>
                                <button class="btn-connect-counselor" data-counselor-id="${counselor.id}">
                                    ${counselor.status === 'online' ? 'Kết nối ngay' : 'Đặt lịch hẹn'}
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // Thêm modal vào body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Thêm event listeners cho buttons
    document.querySelectorAll('.btn-connect-counselor').forEach(btn => {
        btn.addEventListener('click', function() {
            const counselorId = this.dataset.counselorId;
            connectToCounselor(counselorId);
        });
    });
}

function closeMatchingModal() {
    const modal = document.getElementById('matchingModal');
    if (modal) modal.remove();
}

function connectToCounselor(counselorId) {
    alert(`Đang kết nối với chuyên gia ${counselorId}...`);
    // TODO: Implement actual connection logic
}

// Cập nhật hàm showTestResults
async function showTestResults() {
    // Thu thập câu trả lời
    const answers = collectTestAnswers();
    
    if (Object.keys(answers).length < 3) {
        alert("Vui lòng trả lời tất cả câu hỏi!");
        return;
    }
    
    try {
        // Hiển thị loading
        showLoadingModal("Đang phân tích kết quả...");
        
        // Gửi kết quả lên server
        const response = await fetch("http://127.0.0.1:5000/api/test/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answers })
        });
        
        const data = await response.json();
        hideLoadingModal();
        
        if (data.success) {
            // Hiển thị kết quả test
            showTestResultModal(data);
            
            // Nếu cần tìm chuyên gia (điểm cao)
            if (data.should_find_counselor) {
                setTimeout(() => {
                    if (confirm("Bạn có muốn tìm chuyên gia phù hợp không?")) {
                        findCounselorsFromTags(data.problem_tags);
                    }
                }, 2000);
            }
        } else {
            alert("Có lỗi xảy ra. Vui lòng thử lại!");
        }
        
    } catch (error) {
        console.error("Error submitting test:", error);
        hideLoadingModal();
        alert("Không thể kết nối đến server!");
    }
}

// Hàm thu thập câu trả lời
function collectTestAnswers() {
    const answers = {};
    
    // Lặp qua 3 câu hỏi
    for (let i = 1; i <= 3; i++) {
        const selected = document.querySelector(
            `.question-card[data-question="${i}"] .answer-option.selected`
        );
        if (selected) {
            answers[`q${i}`] = selected.textContent.trim();
        }
    }
    
    return answers;
}

// Hiển thị modal kết quả test
function showTestResultModal(data) {
    const modalHTML = `
        <div class="test-result-modal" id="testResultModal">
            <div class="test-result-content">
                <span class="close-modal" onclick="closeTestResultModal()">&times;</span>
                <h2>Kết quả đánh giá của bạn</h2>
                
                <div class="result-score">
                    <div class="score-circle ${getScoreClass(data.level)}">
                        <span class="score-number">${data.score}</span>
                        <span class="score-max">/9</span>
                    </div>
                    <h3 class="score-level">${data.level}</h3>
                </div>
                
                <p class="result-message">${data.message}</p>
                
                ${data.problem_tags.length > 0 ? `
                    <div class="detected-issues">
                        <h4>Vấn đề được phát hiện:</h4>
                        <div class="issue-tags">
                            ${data.problem_tags.map(tag => 
                                `<span class="issue-tag">${formatTag(tag)}</span>`
                            ).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="result-actions">
                    ${data.should_find_counselor ? 
                        `<button class="btn-find-counselor" onclick="findCounselorsFromTags(${JSON.stringify(data.problem_tags)})">
                            <i class="fas fa-user-md"></i> Tìm chuyên gia phù hợp
                        </button>` : ''
                    }
                    <button class="btn-retake" onclick="retakeTest()">
                        <i class="fas fa-redo"></i> Làm lại
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Hàm tìm chuyên gia từ tags
async function findCounselorsFromTags(tags) {
    closeTestResultModal(); // Đóng modal kết quả test
    
    try {
        showLoadingModal("Đang tìm chuyên gia phù hợp...");
        
        const response = await fetch("http://127.0.0.1:5000/api/match/find", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                problem_tags: tags,
                only_online: true,
                min_rating: 4.0
            })
        });
        
        const data = await response.json();
        hideLoadingModal();
        
        if (data.matches && data.matches.length > 0) {
            displayMatchingResults(data);
        } else {
            alert("Không tìm thấy chuyên gia phù hợp. Vui lòng thử lại sau!");
        }
        
    } catch (error) {
        console.error("Error finding counselors:", error);
        hideLoadingModal();
        alert("Có lỗi xảy ra!");
    }
}

// Utility functions
function getScoreClass(level) {
    switch(level) {
        case 'Tốt': return 'good';
        case 'Trung bình': return 'medium';
        case 'Cần hỗ trợ': return 'need-support';
        default: return '';
    }
}

function formatTag(tag) {
    const tagNames = {
        'stress': 'Stress',
        'lo_au': 'Lo âu',
        'tram_cam': 'Trầm cảm',
        'hoc_tap': 'Học tập',
        'roi_loan_giac_ngu': 'Rối loạn giấc ngủ',
        'tam_ly_xa_hoi': 'Tâm lý xã hội'
    };
    return tagNames[tag] || tag;
}

function closeTestResultModal() {
    const modal = document.getElementById('testResultModal');
    if (modal) modal.remove();
}

function retakeTest() {
    closeTestResultModal();
    // Reset lại test
    currentQuestion = 1;
    document.querySelectorAll('.answer-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    document.querySelectorAll('.question-card').forEach(card => {
        card.classList.remove('active');
    });
    document.querySelector('.question-card[data-question="1"]').classList.add('active');
    updateProgress();
}

// Loading modal
function showLoadingModal(message) {
    const loadingHTML = `
        <div class="loading-modal" id="loadingModal">
            <div class="loading-content">
                <div class="spinner"></div>
                <p>${message}</p>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', loadingHTML);
}

function hideLoadingModal() {
    const modal = document.getElementById('loadingModal');
    if (modal) modal.remove();
}

// Thêm nút "Tìm chuyên gia" vào chatbot
function addFindExpertButton() {
    const chatInput = document.querySelector('.chatbot-input');
    if (!chatInput) return;
    
    const findExpertBtn = document.createElement('button');
    findExpertBtn.innerHTML = '<i class="fas fa-user-md"></i>';
    findExpertBtn.className = 'btn-find-expert';
    findExpertBtn.title = 'Tìm chuyên gia phù hợp';
    findExpertBtn.onclick = async () => {
        const conversationId = getConversationId();
        
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/match/from-chat/${conversationId}`);
            const data = await response.json();
            
            if (data.matches && data.matches.length > 0) {
                displayMatchingResults(data);
            } else {
                addMessageToChat("Chưa phát hiện được vấn đề cụ thể. Hãy chia sẻ thêm với tôi nhé!", "bot");
            }
        } catch (error) {
            console.error("Error matching from chat:", error);
        }
    };
    
    chatInput.appendChild(findExpertBtn);
}

// Gọi khi DOM loaded
document.addEventListener("DOMContentLoaded", function() {
    // ... existing code ...
    addFindExpertButton();
});