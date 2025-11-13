/**
 * File này chỉ dùng cho trang index.html
 * Logic đăng nhập: SỬ DỤNG MODAL
 * Tích hợp: DASS-21 (Hệ thống 1) + Matching (Hệ thống 2)
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
  addFindExpertButton(); // Thêm nút "Tìm chuyên gia" vào chatbot
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

    // --- LOGIC CHUYỂN HƯỚNG ---
    // Chỉ dùng MỘT lần setTimeout duy nhất
  setTimeout(() => {
        if (data.is_admin) {
          window.location.href = "/admin/dashboard";
        } else {
          // Cả User thường và Counselor đều reload trang chủ
          // Server sẽ tự lo việc hiển thị nội dung khác nhau dựa trên role
          window.location.reload(); 
        }
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

// Tính điểm và hiển thị kết quả (ĐÃ TÍCH HỢP)
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

  // --- BẮT ĐẦU TÍCH HỢP HỆ THỐNG 2 ---
  // 6. Dịch điểm DASS-21 ra tag
  const problemTags = getTagsFromDassScores(scores);

  // 7. Nếu có tag (tức là có vấn đề từ mức 'Nhẹ' trở lên), hỏi người dùng
  if (problemTags.length > 0) {
    // Chờ 1.5s để người dùng đọc kết quả
    setTimeout(() => {
      const formattedTags = problemTags.map(tag => formatTag(tag)).join(', ');
      if (confirm(`Kết quả của bạn cho thấy dấu hiệu về: ${formattedTags}.\n\nBạn có muốn tìm chuyên gia phù hợp ngay bây giờ không?`)) {
          // Gọi hàm tìm chuyên gia của Hệ thống 2
          findCounselorsFromTags(problemTags);
      }
    }, 1500);
  }
  // --- KẾT THÚC TÍCH HỢP ---
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
  const toggleChatbotBox = document.getElementById("chatbotToggle2");

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

// --- Matching System Functions (Hệ thống 2) ---
// --- Thêm vào ngày 10/11/2025 ---

/**
 * HÀM MỚI (TÍCH HỢP): Dịch điểm DASS-21 ra các tag
 * @param {object} scores - {D: 10, A: 8, S: 15}
 * @returns {array} - ['tram_cam', 'lo_au', 'stress']
 */
function getTagsFromDassScores(scores) {
  const tags = [];
  // Sử dụng logic: 'Nhẹ' (hoặc cao hơn) thì thêm tag
  if (scores.D >= 10) tags.push('tram_cam');
  if (scores.A >= 8) tags.push('lo_au');
  if (scores.S >= 15) tags.push('stress');
  return tags;
}

/**
 * Hàm tìm chuyên gia từ tags (được gọi từ DASS-21 hoặc Chatbot)
 */
async function findCounselorsFromTags(tags) {
  // Đóng modal kết quả DASS-21 nếu nó đang mở
  closeTestResultModal(); 
  
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

/**
 * Hiển thị modal kết quả matching
 */
function displayMatchingResults(data) {
  // Đảm bảo không có modal cũ
  closeMatchingModal();

  // Tạo modal hiển thị kết quả matching
  const modalHTML = `
      <div class="matching-modal" id="matchingModal">
          <div class="matching-modal-content">
              <span class="close-modal" onclick="closeMatchingModal()">&times;</span>
              <h2>Chuyên gia phù hợp cho bạn</h2>
              <p class="detected-tags">Vấn đề được phát hiện: ${data.search_tags.map(tag => formatTag(tag)).join(', ')}</p>
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

// ==========================================
// LOGIC ĐẶT LỊCH (Booking System) - ĐÃ SỬA FIX LỖI
// ==========================================

let currentBookingCounselorId = null;

// 1. Hàm kiểm tra và mở luồng đặt lịch (PHIÊN BẢN DEBUG & FIX)
async function checkAndOpenBooking(counselorUsername) {
    console.log("Bắt đầu check cho:", counselorUsername);
    
    try {
        const res = await fetch('/api/booking/check-existing');
        console.log("HTTP Status:", res.status); // Kiểm tra status

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const data = await res.json();
        console.log("Dữ liệu nhận được từ API:", data); // QUAN TRỌNG: Xem cái này trong F12

        // KIỂM TRA KỸ LƯỠNG TRƯỚC KHI DÙNG
        if (data && data.existing && data.existing.id) {
            // Trường hợp CÓ lịch cũ -> Hỏi hủy
            const confirmMsg = `Bạn đang có lịch hẹn với ${data.existing.counselor} vào ${data.existing.date}.\nBạn có muốn HỦY lịch cũ để đặt lịch mới không?`;
            if(confirm(confirmMsg)) {
                await fetch('/api/booking/cancel', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({id: data.existing.id})
                });
                fetchDatesAndOpenModal(counselorUsername);
            }
        } else {
            // Trường hợp data.existing là NULL hoặc undefined -> Mở luôn
            console.log("Không có lịch cũ, mở modal ngay.");
            fetchDatesAndOpenModal(counselorUsername);
        }

    } catch (e) {
        console.error("LỖI JS:", e);
        // Fallback: Nếu lỗi, cứ mở modal cho người dùng (đừng chặn họ)
        fetchDatesAndOpenModal(counselorUsername);
    }
}

// 2. Hàm lấy ngày rảnh từ Server (Logic ĐÚNG: Hỏi Server xem Counselor rảnh ngày nào)
async function fetchDatesAndOpenModal(counselorId) {
    currentBookingCounselorId = counselorId;
    document.body.style.cursor = 'wait';

    try {
        // Gọi API lấy danh sách ngày rảnh của Counselor
        const res = await fetch(`/api/counselor/get-dates?username=${counselorId}`);
        const data = await res.json();
        document.body.style.cursor = 'default';

        // Nếu Counselor không có ngày rảnh nào -> Báo lỗi
        if (!data.dates || data.dates.length === 0) {
            alert("Chuyên gia này chưa cập nhật lịch rảnh. Vui lòng quay lại sau!");
            return; 
        }

        // Nếu có lịch -> Mở Modal và điền ngày vào Dropdown
        openBookingModal(counselorId, data.dates);

    } catch (e) {
        document.body.style.cursor = 'default';
        console.error(e);
        alert("Lỗi tải lịch.");
    }
}

// 3. Hàm hiển thị Modal với Dropdown ngày (User chỉ được chọn trong list này)
function openBookingModal(counselorId, availableDates) {
    const modal = document.getElementById('bookingModal');
    const dateSelect = document.getElementById('bookingDate'); // Đây phải là thẻ <select>
    const slotsDiv = document.getElementById('bookingSlots');
    const msgDiv = document.getElementById('bookingMessage');
    
    if(!modal) return;

    // Reset giao diện
    slotsDiv.innerHTML = '<p style="grid-column: span 3; text-align: center; color: #666;">Vui lòng chọn ngày.</p>';
    msgDiv.style.display = 'none';
    document.getElementById('selectedTime').value = '';
    document.getElementById('bookingCounselorName').textContent = "Đặt lịch với " + counselorId;

    // --- ĐIỀN DỮ LIỆU VÀO DROPDOWN ---
    // Xóa hết option cũ
    dateSelect.innerHTML = '<option value="">-- Chọn ngày rảnh --</option>';
    
    // Tạo option mới từ danh sách server trả về
    availableDates.forEach(date => {
        const option = document.createElement('option');
        option.value = date;
        option.textContent = date; // Hiển thị: 2025-11-14
        dateSelect.appendChild(option);
    });

    // Mở Modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// 4. Hàm Đóng Modal (Gán vào nút X)
function closeBookingModal() {
    const modal = document.getElementById('bookingModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto'; // Mở khóa cuộn
    }
}

// 5. Sự kiện khi chọn ngày -> Tải Slot (Giờ)
document.getElementById('bookingDate')?.addEventListener('change', async function() {
    const date = this.value;
    const slotsDiv = document.getElementById('bookingSlots');
    
    if (!date) {
        slotsDiv.innerHTML = '<p style="grid-column: span 3; text-align: center; color: #666;">Vui lòng chọn ngày trước.</p>';
        return;
    }

    slotsDiv.innerHTML = '<div class="spinner" style="grid-column: span 3; margin: 0 auto; width: 30px; height: 30px;"></div>';

    try {
        const response = await fetch(`/api/counselor/get-slots?username=${currentBookingCounselorId}&date=${date}`);
        const data = await response.json();

        slotsDiv.innerHTML = ''; 

        if (data.slots && data.slots.length > 0) {
            data.slots.forEach(time => {
                const btn = document.createElement('button');
                btn.type = 'button'; // Để không submit form
                btn.className = 'slot-btn';
                btn.textContent = time;
                // Style cho nút
                btn.style.cssText = "padding: 10px; border: 1px solid #ddd; background: white; border-radius: 8px; cursor: pointer; transition: all 0.2s;";
                
                btn.onclick = function() {
                    // Xóa active cũ
                    document.querySelectorAll('.slot-btn').forEach(b => {
                        b.style.background = 'white';
                        b.style.color = 'var(--dark)';
                        b.style.borderColor = '#ddd';
                    });
                    // Active nút mới
                    this.style.background = 'var(--primary)';
                    this.style.color = 'white';
                    this.style.borderColor = 'var(--primary)';
                    
                    // Gán giá trị vào input ẩn
                    document.getElementById('selectedTime').value = time;
                };
                
                slotsDiv.appendChild(btn);
            });
        } else {
            slotsDiv.innerHTML = '<p style="grid-column: span 3; text-align: center; color: #ef4444;">Ngày này đã kín lịch. Vui lòng chọn ngày khác.</p>';
        }
    } catch (error) {
        console.error(error);
        slotsDiv.innerHTML = '<p style="grid-column: span 3; text-align: center; color: red;">Lỗi tải giờ.</p>';
    }
});

// 6. Xử lý Submit Form Đặt lịch
document.getElementById('bookingForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const date = document.getElementById('bookingDate').value;
    const time = document.getElementById('selectedTime').value;
    const msgDiv = document.getElementById('bookingMessage');
    const btnSubmit = this.querySelector('.btn-submit');

    if (!date || !time) {
        msgDiv.textContent = "Vui lòng chọn ngày và giờ!";
        msgDiv.style.color = "red";
        msgDiv.style.display = "block";
        return;
    }

    // UI Loading
    const originalText = btnSubmit.textContent;
    btnSubmit.textContent = "Đang xử lý...";
    btnSubmit.disabled = true;

    try {
        const response = await fetch('/api/booking/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                counselor_username: currentBookingCounselorId,
                date: date,
                time: time
            })
        });

        const result = await response.json();

        if (response.ok) {
            msgDiv.textContent = "Đặt lịch thành công! Đang chuyển hướng...";
            msgDiv.style.color = "green";
            msgDiv.style.display = "block";
            setTimeout(() => {
                window.location.reload(); // Reload để cập nhật lịch sử và Dashboard
            }, 1500);
        } else {
            throw new Error(result.message || "Lỗi đặt lịch");
        }
    } catch (error) {
        msgDiv.textContent = error.message;
        msgDiv.style.color = "red";
        msgDiv.style.display = "block";
        btnSubmit.textContent = originalText;
        btnSubmit.disabled = false;
    }
});

// --- Utility functions (Hỗ trợ cho Hệ thống 2) ---

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

// Hàm này dùng để đóng modal của bài test 3 câu hỏi (không còn dùng)
// Nhưng có thể `findCounselorsFromTags` gọi nó, nên ta cứ để nó
// làm rỗng để tránh lỗi.
function closeTestResultModal() {
  // const modal = document.getElementById('testResultModal');
  // if (modal) modal.remove();
  // Không làm gì cả, vì chúng ta không dùng testResultModal
}

// Loading modal
function showLoadingModal(message) {
  hideLoadingModal(); // Đảm bảo không có modal cũ
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
  const chatInputContainer = document.querySelector('.chatbot-input');
  if (!chatInputContainer) return;

  // Kiểm tra xem nút đã tồn tại chưa
  if (chatInputContainer.querySelector('.btn-find-expert')) {
    return;
  }
  
  const findExpertBtn = document.createElement('button');
  findExpertBtn.innerHTML = '<i class="fas fa-user-md"></i>';
  findExpertBtn.className = 'btn-find-expert'; // Thêm class để CSS
  findExpertBtn.title = 'Tìm chuyên gia phù hợp';
  findExpertBtn.type = 'button'; // Ngăn không cho submit form
  
  findExpertBtn.onclick = async () => {
      const conversationId = getConversationId();
      
      try {
          showLoadingModal("Đang phân tích hội thoại...");
          const response = await fetch(`http://127.0.0.1:5000/api/match/from-chat/${conversationId}`);
          hideLoadingModal();
          const data = await response.json();
          
          if (data.matches && data.matches.length > 0) {
              displayMatchingResults(data);
          } else {
              addMessageToChat("Chưa phát hiện được vấn đề cụ thể. Hãy chia sẻ thêm với tôi về cảm xúc của bạn nhé!", "bot");
          }
      } catch (error) {
          hideLoadingModal();
          console.error("Error matching from chat:", error);
          addMessageToChat("Lỗi khi tìm chuyên gia. Vui lòng thử lại!", "bot");
      }
  };
  
  // Thêm vào TRƯỚC nút send
  chatInputContainer.appendChild(findExpertBtn);
}

// --- LOGIC RIÊNG CHO COUNSELOR (Đã nâng cấp) ---
document.addEventListener('DOMContentLoaded', function() {
    // Chỉ chạy nếu đang ở giao diện Counselor
    if (!document.getElementById('counselorDatePicker')) return;

    // --- 1. KHỞI TẠO BIẾN & LỊCH ---
    let fpInstance; // Flatpickr instance
    const slots = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
    const container = document.getElementById("counselorSlotContainer");

    // Khởi tạo Flatpickr
    if (typeof flatpickr !== 'undefined') {
        fpInstance = flatpickr("#counselorDatePicker", { 
            minDate: "today", 
            dateFormat: "Y-m-d",
            locale: "vn"
        });
    }

    // Vẽ các nút giờ
    if(container) {
        container.innerHTML = ''; // Clear cũ
        slots.forEach(time => {
            const div = document.createElement("div");
            div.className = "time-slot-item";
            div.textContent = time;
            div.dataset.time = time; // Để dễ query
            div.onclick = () => div.classList.toggle("selected");
            container.appendChild(div);
        });
    }

    // --- 2. XỬ LÝ CHUYỂN TAB (Sidebar) ---
    const tabs = {
        'tab-overview': 'view-overview',
        'tab-schedule': 'view-schedule',
        'tab-history': 'view-history'
    };

    Object.keys(tabs).forEach(tabId => {
        const tabEl = document.getElementById(tabId);
        if (tabEl) {
            tabEl.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Update Active Class cho Sidebar
                document.querySelectorAll('.dashboard-menu a').forEach(a => a.classList.remove('active'));
                this.classList.add('active');

                // Ẩn hết các view, hiện view tương ứng
                Object.values(tabs).forEach(viewId => {
                    const el = document.getElementById(viewId);
                    if(el) el.style.display = 'none';
                });
                document.getElementById(tabs[tabId]).style.display = 'block';

                // Nếu bấm vào tab Lịch sử, tải dữ liệu ngay
                if (tabId === 'tab-history') {
                    loadHistoryLogs();
                }
            });
        }
    });

    // --- 3. LOGIC LƯU LỊCH (Tab Lịch hẹn) ---
    const saveBtn = document.getElementById('btnSaveAvailability');
    if(saveBtn) {
        saveBtn.addEventListener('click', async function() {
            const date = document.getElementById("counselorDatePicker").value;
            if(!date) return alert("Vui lòng chọn ngày!");
            
            const selectedSlots = Array.from(document.querySelectorAll(".time-slot-item.selected"))
                                       .map(el => el.textContent);
            
            if(selectedSlots.length === 0) return alert("Vui lòng chọn ít nhất 1 khung giờ rảnh!");

            const originalText = this.textContent;
            this.textContent = "Đang lưu...";
            this.disabled = true;

            try {
                const res = await fetch("/api/counselor/availability", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({ date, slots: selectedSlots })
                });
                
                if(res.ok) {
                    alert("Đã cập nhật lịch rảnh thành công!");
                    // Sau khi lưu, có thể muốn reset hoặc giữ nguyên tùy trải nghiệm
                } else {
                    alert("Lỗi khi lưu lịch.");
                }
            } catch (err) {
                console.error(err);
                alert("Lỗi kết nối server.");
            } finally {
                this.textContent = originalText;
                this.disabled = false;
            }
        });
    }

    // --- 4. LOGIC TẢI & HIỂN THỊ LỊCH SỬ (Tab Lịch sử) ---
    async function loadHistoryLogs() {
        const tbody = document.getElementById('historyTableBody');
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Đang tải...</td></tr>';

        try {
            const res = await fetch("/api/counselor/history-logs");
            const data = await res.json();

            tbody.innerHTML = ''; // Clear loading

            if (data.logs && data.logs.length > 0) {
                data.logs.forEach(log => {
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = "1px solid #eee";
                    tr.style.cursor = "pointer"; // Để biết là click được
                    tr.title = "Click để sửa lại lịch này";
                    
                    // Sự kiện click vào dòng -> Chuyển sang tab Lịch hẹn để sửa
                    tr.onclick = () => editLog(log.target_date, log.slots);

                    tr.innerHTML = `
                        <td style="padding: 12px;">${log.action_time}</td>
                        <td style="padding: 12px; color: var(--primary); font-weight: bold;">${log.target_date}</td>
                        <td style="padding: 12px;">${log.slots.join(', ')}</td>
                        <td style="padding: 12px;">
                            <button class="btn-edit-log" style="background:none; border:none; color:var(--primary); cursor:pointer;">
                                <i class="fas fa-edit"></i> Sửa
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Chưa có lịch sử cập nhật nào.</td></tr>';
            }
        } catch (err) {
            console.error(err);
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Lỗi tải dữ liệu.</td></tr>';
        }
    }

    // --- 5. HÀM SỬA LỊCH (Chuyển Tab & Điền dữ liệu) ---
    window.editLog = function(date, slots) {
        // 1. Chuyển sang tab Lịch hẹn
        document.getElementById('tab-schedule').click(); 

        // 2. Điền ngày vào DatePicker
        if(fpInstance) {
            fpInstance.setDate(date);
        } else {
            document.getElementById('counselorDatePicker').value = date;
        }

        // 3. Reset các slot và chọn lại các slot từ log
        document.querySelectorAll(".time-slot-item").forEach(el => {
            el.classList.remove("selected"); // Reset hết
            if (slots.includes(el.textContent)) {
                el.classList.add("selected"); // Chọn lại slot trong log
            }
        });

        // Cuộn lên đầu để thấy form
        document.querySelector('.dashboard-content').scrollIntoView({behavior: 'smooth'});
    };
});

// --- LOGIC RIÊNG CHO USER THƯỜNG (Booking & History) ---
document.addEventListener('DOMContentLoaded', function() {
    // Kiểm tra nếu là User thường (có tab overview nhưng ko có datepicker của counselor)
    if (!document.getElementById('user-view-overview')) return;

    // 1. XỬ LÝ CHUYỂN TAB
    const userTabs = {
        'tab-overview': 'user-view-overview',
        'tab-schedule': 'user-view-booking', // Tab Lịch hẹn
        'tab-history': 'user-view-history'   // Tab Lịch sử
    };

    Object.keys(userTabs).forEach(tabId => {
        const tabEl = document.getElementById(tabId);
        if (tabEl) {
            tabEl.addEventListener('click', function(e) {
                e.preventDefault();
                document.querySelectorAll('.dashboard-menu a').forEach(a => a.classList.remove('active'));
                this.classList.add('active');

                Object.values(userTabs).forEach(viewId => {
                    const el = document.getElementById(viewId);
                    if(el) el.style.display = 'none';
                });
                document.getElementById(userTabs[tabId]).style.display = 'block';

                // Load dữ liệu khi chuyển tab
                if (tabId === 'tab-schedule') loadAvailableCounselors();
                if (tabId === 'tab-history') loadUserHistory();
            });
        }
    });

    // 2. LOAD DANH SÁCH COUNSELOR RẢNH
    async function loadAvailableCounselors() {
        const container = document.getElementById('available-counselors-list');
        container.innerHTML = '<div class="spinner"></div>';

        try {
            const res = await fetch('/api/counselors/available');
            const data = await res.json();
            container.innerHTML = '';

            if (data.counselors && data.counselors.length > 0) {
                data.counselors.forEach(c => {
                    const card = document.createElement('div');
                    card.className = 'expert-card';
                    card.innerHTML = `
                        <div class="expert-info" style="padding: 1.5rem; text-align: center;">
                            <div style="width: 60px; height: 60px; background: #e0e7ff; color: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin: 0 auto 10px;">
                                ${c.name.charAt(0)}
                            </div>
                            <h4>${c.name}</h4>
                            <p style="font-size: 0.9rem; color: #666;">${c.specialties}</p>
                            <button class="btn-connect" onclick="checkAndOpenBooking('${c.username}')" style="margin-top: 10px; width: 100%;">
                                Đặt lịch ngay
                            </button>
                        </div>
                    `;
                    container.appendChild(card);
                });
            } else {
                container.innerHTML = '<p style="grid-column: span 3; text-align: center;">Hiện chưa có chuyên gia nào cập nhật lịch rảnh.</p>';
            }
        } catch (e) {
            container.innerHTML = '<p style="color: red;">Lỗi tải dữ liệu.</p>';
        }
    }

    // 3. LOAD LỊCH SỬ
    async function loadUserHistory() {
        const tbody = document.getElementById('user-history-body');
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Đang tải...</td></tr>';
        
        try {
            const res = await fetch('/api/user/appointments');
            const data = await res.json();
            tbody.innerHTML = '';

            if (data.appointments && data.appointments.length > 0) {
                data.appointments.forEach(appt => {
                    const statusColor = appt.status === 'confirmed' ? 'green' : 'gray';
                    const statusText = appt.status === 'confirmed' ? 'Đã xác nhận' : 'Đã hủy';
                    
                    let actionHtml = '';
                    if(appt.status === 'confirmed') {
                        actionHtml = `<button onclick="cancelBooking('${appt.id}')" style="color: red; border: 1px solid red; padding: 4px 8px; border-radius: 4px; background: white; cursor: pointer;">Hủy</button>`;
                    }

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="padding: 12px;">${appt.date} <br> <b>${appt.time}</b></td>
                        <td style="padding: 12px;">${appt.counselor}</td>
                        <td style="padding: 12px; color: ${statusColor}; font-weight: bold;">${statusText}</td>
                        <td style="padding: 12px;">${actionHtml}</td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Chưa có lịch sử đặt hẹn.</td></tr>';
            }
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: red;">Lỗi tải.</td></tr>';
        }
    }
});

// --- GLOBAL FUNCTIONS (Để gọi từ HTML onclick) ---

// Hàm kiểm tra trước khi mở modal đặt lịch

async function cancelBooking(apptId) {
    if(!confirm("Bạn chắc chắn muốn hủy lịch hẹn này?")) return;
    
    try {
        const res = await fetch('/api/booking/cancel', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id: apptId})
        });
        if(res.ok) {
            alert("Đã hủy thành công.");
            // Reload tab history (giả lập click lại tab)
            document.getElementById('tab-history').click();
        }
    } catch (e) {
        alert("Lỗi khi hủy.");
    }
}