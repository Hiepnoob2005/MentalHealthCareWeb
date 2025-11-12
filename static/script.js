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
  initializeQuickTestListeners(); // Sẽ khởi tạo DASS-21
  initializeChatbotListeners();
  initializeResourceFilters();
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
    ctaButton.style.maxWidth = "200px";
    ctaButton.style.overflow = "hidden";
    ctaButton.style.textOverflow = "ellipsis";
    ctaButton.style.whiteSpace = "nowrap";
    ctaButton.style.display = "inline-block";
    ctaButton.style.verticalAlign = "middle";
    // --- KẾT THÚC SỬA LỖI LAYOUT ---

    // Thêm sự kiện click để Đăng xuất
    ctaButton.onclick = (e) => {
      e.preventDefault();
      handleLogout();
    };
  }

  // --- BẮT ĐẦU STYLE MỚI KHI ĐĂNG NHẬP ---
  const heroTitle = document.querySelector(".hero-content h1");
  if (heroTitle) {
    heroTitle.innerHTML = `Chào mừng trở lại, <span class="highlight">${username}</span>!`;
  }
  const heroSubtitle = document.querySelector(".hero-content p");
  if (heroSubtitle) {
    heroSubtitle.textContent =
      "Bạn đã sẵn sàng cho buổi đánh giá tiếp theo, trò chuyện với AI hay kết nối với một chuyên gia chưa?";
  }
  document.querySelectorAll(".btn-connect:not([disabled])").forEach((btn) => {
    btn.textContent = "Đặt lịch hẹn";
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
    showFormMessage(
      messageElId,
      "Vui lòng nhập tên đăng nhập và mật khẩu.",
      true
    );
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
    showFormMessage(
      messageElId,
      "Đăng nhập thành công! Đang tải lại...",
      false
    );
    setTimeout(() => {
      window.location.reload(); // Tải lại trang để cập nhật giao diện
    }, 1000);
  } catch (err) {
    showFormMessage(messageElId, err.message, true);
  }
}

function openLoginModal() {
  const modal = document.getElementById("loginModal");
  if (modal) modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeLoginModal() {
  const modal = document.getElementById("loginModal");
  if (modal) modal.classList.remove("active");
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
    if (closeBtn) closeBtn.onclick = closeLoginModal;

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
  if (navbarCta && navbarCta.getAttribute("href") !== "#") {
    // Chỉ gán nếu chưa đăng nhập
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
      const isLoggedIn = !!document
        .getElementById("navbarCtaButton")
        ?.href.endsWith("#");
      const targetHref = this.getAttribute("href");

      // Nếu chưa đăng nhập VÀ link là #test, #experts, #dashboard -> Mở modal
      if (
        !isLoggedIn &&
        (targetHref === "#test" ||
          targetHref === "#experts" ||
          targetHref === "#dashboard")
      ) {
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

// --- Quick Test functionality (DASS-21) ---

function initializeQuickTestListeners() {
  // Bắt đầu bài test DASS-21
  startTest("dass21");

  // Gán sự kiện cho các nút
  const btnNext = document.getElementById('btn-next');
  const btnPrev = document.getElementById('btn-prev');
  
  if(btnNext) btnNext.onclick = nextQuestion;
  if(btnPrev) btnPrev.onclick = prevQuestion;
}

// Lấy các phần tử DOM cho bài test
const testTitle = document.getElementById("test-title");
const progressFill = document.getElementById("progressFill");
const questionContainer = document.getElementById("question-container");
const questionText = document.getElementById("question-text");
const answerOptions = document.getElementById("answer-options");
const resultContainer = document.getElementById("result-container");
const resultList = document.getElementById("result-list");

// Biến trạng thái của bài test
let currentQuestionIndex = 0;
let currentTestData = null;
let userAnswers = []; // Mảng lưu trữ điểm số của người dùng

// Bắt đầu một bài test (ví dụ: 'dass21')
async function startTest(topic) {
  try {
    // Tải file JSON tương ứng
    // Dòng mới (thêm /static/)
    const response = await fetch(`/static/${topic}.json`);
    if (!response.ok) {
      throw new Error(
        "Không thể tải file dữ liệu test. Hãy chắc chắn file dass21.json đang ở cùng thư mục."
      );
    }
    currentTestData = await response.json();

    // Khởi tạo
    currentQuestionIndex = 0;
    userAnswers = new Array(currentTestData.questions.length).fill(null);
    if(testTitle) testTitle.textContent = currentTestData.topic;

    // Hiển thị câu hỏi đầu tiên
    displayQuestion(currentQuestionIndex);

    // Reset giao diện
    if(questionContainer) questionContainer.style.display = "block";
    if(resultContainer) resultContainer.style.display = "none";
    
    const btnNext = document.getElementById('btn-next');
    if(btnNext) btnNext.style.display = "inline-block"; // Hiển thị lại nút next
    
  } catch (error) {
    console.error(error);
    if(questionText) questionText.textContent = "Đã xảy ra lỗi khi tải bài test. " + error.message;
  }
}

// Hiển thị câu hỏi dựa trên chỉ số (index)
function displayQuestion(index) {
  if (!currentTestData) return; // Kiểm tra nếu dữ liệu chưa tải
  
  const question = currentTestData.questions[index];
  const options = currentTestData.options; // Lấy options chung

  if(questionText) questionText.textContent = question.text;
  if(answerOptions) answerOptions.innerHTML = ""; // Xóa lựa chọn cũ

  // Tạo các lựa chọn mới từ options chung
  options.forEach((option, optionIndex) => {
    const optionElement = document.createElement("div");
    optionElement.classList.add("answer-option");
    optionElement.textContent = option.text;

    // Gán giá trị (0, 1, 2, 3) vào
    const value = option.value;

    optionElement.onclick = () => selectAnswer(index, value, optionElement);

    if (userAnswers[index] === value) {
      optionElement.classList.add("selected");
    }
    if(answerOptions) answerOptions.appendChild(optionElement);
  });

  updateNavigation();
  updateProgressBar();
}

// Khi người dùng chọn một câu trả lời
function selectAnswer(questionIndex, value, selectedElement) {
  // Lưu điểm
  userAnswers[questionIndex] = value;

  // Cập nhật giao diện (highlight)
  const siblings = selectedElement.parentNode.children;
  for (let i = 0; i < siblings.length; i++) {
    siblings[i].classList.remove("selected");
  }
  selectedElement.classList.add("selected");

  // Cập nhật thanh tiến trình ngay khi chọn
  updateProgressBar();
}

// Cập nhật thanh tiến trình
function updateProgressBar() {
  if (!currentTestData || !progressFill) return;
  const totalQuestions = currentTestData.questions.length;
  // Đếm số câu đã trả lời
  const answeredCount = userAnswers.filter((answer) => answer !== null).length;
  const progressPercent = (answeredCount / totalQuestions) * 100;
  progressFill.style.width = `${progressPercent}%`;
}

// Cập nhật các nút điều hướng
function updateNavigation() {
  if (!currentTestData) return;
  
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  if(!btnPrev || !btnNext) return;

  // Ẩn/hiện nút "Quay lại"
  btnPrev.style.display = currentQuestionIndex === 0 ? "none" : "inline-block";

  // Đổi chữ nút "Tiếp theo" thành "Hoàn thành" ở câu cuối
  if (currentQuestionIndex === currentTestData.questions.length - 1) {
    btnNext.innerHTML = 'Hoàn thành <i class="fas fa-check"></i>';
  } else {
    btnNext.innerHTML = 'Tiếp theo <i class="fas fa-arrow-right"></i>';
  }
}

// Chuyển câu hỏi tiếp theo
function nextQuestion() {
  if (!currentTestData) return;
  // Kiểm tra xem đã trả lời câu hiện tại chưa
  if (userAnswers[currentQuestionIndex] === null) {
    alert("Vui lòng chọn một câu trả lời!");
    return;
  }

  if (currentQuestionIndex < currentTestData.questions.length - 1) {
    currentQuestionIndex++;
    displayQuestion(currentQuestionIndex);
  } else {
    // Đã đến câu cuối, bấm "Hoàn thành"
    showResults();
  }
}

// Quay lại câu hỏi trước
function prevQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    displayQuestion(currentQuestionIndex);
  }
}

// Tính điểm và hiển thị kết quả
function showResults() {
  // 1. Tính tổng điểm thô cho 3 nhóm
  let scores = { D: 0, A: 0, S: 0 };

  currentTestData.questions.forEach((question, index) => {
    const type = question.type; // 'D', 'A', hoặc 'S'
    const value = userAnswers[index] || 0; // Lấy điểm đã trả lời
    scores[type] += value;
  });

  // 2. Nhân 2 theo quy tắc DASS-21
  scores.D *= 2;
  scores.A *= 2;
  scores.S *= 2;

  // 3. Ẩn câu hỏi, hiện kết quả
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  
  if(questionContainer) questionContainer.style.display = "none";
  if(btnPrev) btnPrev.style.display = "none";
  if(btnNext) btnNext.style.display = "none";
  if(resultContainer) resultContainer.style.display = "block";

  // 4. Phân loại kết quả
  const depressionResult = getDepressionLevel(scores.D);
  const anxietyResult = getAnxietyLevel(scores.A);
  const stressResult = getStressLevel(scores.S);

  // 5. Hiển thị kết quả ra HTML
  if(resultList) {
    resultList.innerHTML = `
      <li>
        <strong>Trầm cảm:</strong> ${scores.D} điểm - <strong>${depressionResult}</strong>
      </li>
      <li>
        <strong>Lo âu:</strong> ${scores.A} điểm - <strong>${anxietyResult}</strong>
      </li>
      <li>
        <strong>Stress:</strong> ${scores.S} điểm - <strong>${stressResult}</strong>
      </li>
    `;

    // Thêm một lưu ý quan trọng
    const disclaimer = document.createElement("p");
    disclaimer.style.marginTop = "15px";
    disclaimer.style.fontSize = "14px";
    disclaimer.style.textAlign = "center";
    disclaimer.innerHTML =
      "<i><strong>Lưu ý:</strong> Bài test này chỉ mang tính chất tham khảo, không thay thế cho chẩn đoán y tế chuyên nghiệp.</i>";
    resultList.appendChild(disclaimer);
  }
}

// --- Các hàm phụ trợ để diễn giải điểm ---
function getDepressionLevel(score) {
  if (score >= 28) return "Rất nặng";
  if (score >= 21) return "Nặng";
  if (score >= 14) return "Vừa";
  if (score >= 10) return "Nhẹ";
  return "Bình thường";
}

function getAnxietyLevel(score) {
  if (score >= 20) return "Rất nặng";
  if (score >= 15) return "Nặng";
  if (score >= 10) return "Vừa";
  if (score >= 8) return "Nhẹ";
  return "Bình thường";
}

function getStressLevel(score) {
  if (score >= 34) return "Rất nặng";
  if (score >= 26) return "Nặng";
  if (score >= 19) return "Vừa";
  if (score >= 15) return "Nhẹ";
  return "Bình thường";
}

function restartTest() {
  startTest("dass21"); // Khởi động lại test DASS-21
}


// --- Chatbot functionality (Integrated Gemini AI) ---

// Quản lý phiên chat (Conversation ID)
function getConversationId() {
  let conversationId = localStorage.getItem("gemini-chat-session-id");
  if (!conversationId) {
    // Tạo ID duy nhất nếu chưa tồn tại
    conversationId = self.crypto.randomUUID();
    localStorage.setItem("gemini-chat-session-id", conversationId);
  }
  return conversationId;
}

function toggleChatbot() {
  const chatWindow = document.getElementById("chatbotWindow");
  if (chatWindow) {
    chatWindow.classList.toggle("active");
  }
}

function addMessageToChat(text, sender) {
  // Đổi tên hàm từ 'addMessage'
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
        conversationId: conversationId, // Gửi ID phiên chat để duy trì ngữ cảnh
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
    addMessageToChat(
      "Xin lỗi, hệ thống AI đang gặp sự cố. Vui lòng thử lại hoặc kiểm tra server backend.",
      "bot"
    );
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
  const toggleChatbotBox = document.getElementById("chatbotTogglen");

  if (chatInput) {
    chatInput.addEventListener("keypress", handleChatInputKey);
  }

  // Gắn sự kiện cho nút gửi (nếu có)
  if (sendButton) {
    sendButton.addEventListener("click", handleSendMessage);
  }

  // Gắn sự kiện cho nút toggle (nếu có)
  if (toggleButton) {
    toggleButton.addEventListener("click", toggleChatbot);
  }

  if (toggleChatbotBox) {
    toggleChatbotBox.addEventListener("click", toggleChatbot);
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