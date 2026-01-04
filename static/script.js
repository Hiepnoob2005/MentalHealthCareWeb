
/**
 * File này chỉ dùng cho trang index.html
 * Logic đăng nhập: SỬ DỤNG MODAL
 * Tích hợp: DASS-21 (Hệ thống 1) + Matching (Hệ thống 2)
 */
// --- Global Initializations & DOM Loading ---
const socket = io();
document.addEventListener("DOMContentLoaded", function () {
  // 1. Kiểm tra trạng thái đăng nhập
  checkLoginStatus();
  refreshExpertStatusOnLoadAll();
  socket.on('expert_status_change', (data) => {
    console.log(`🔥 Home Update: ${data.username} -> ${data.status}`);
    updateExpertStatusUI(data.username, data.status);
  });

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
  loadOldChatHistory(); // Tải lịch sử chat cũ nếu có
  loadAvailableCounselors(); // Tải danh sách chuyên gia có lịch trống
  loadHomeExperts();
  loadAllCounselorsPage();
});

// --- Authentication (Đăng nhập/Đăng xuất) ---

/**
 * 1. Kiểm tra xem người dùng đã đăng nhập chưa khi tải trang
 */
async function checkLoginStatus() {
  try {
    const response = await fetch("/api/status");
    
    // NẾU LỖI MẠNG HOẶC SERVER -> Coi như chưa đăng nhập
    if (!response.ok) {
      initializeCTAListeners();
      return;
    }

    const data = await response.json();
    if (data.logged_in && data.username) {
      // --- ĐÃ ĐĂNG NHẬP ---
      
      // 1. Cập nhật UI (nút Xin chào, Dropdown)
      updateUIAfterLogin(data.username);
      
      // 2. Khởi tạo Chat (nếu cần)
      const messengerContainer = document.querySelector('.messenger-container');
      if (messengerContainer) {
          initializeCounselorChat(data.username);
      }

    } else {
      // --- CHƯA ĐĂNG NHẬP ---
      initializeCTAListeners(); 
    }
  } catch (err) {
    console.error("Lỗi kiểm tra trạng thái:", err);
    initializeCTAListeners();
  }
}

/**
 * 2. Cập nhật nút CTA trên Navbar VÀ THAY ĐỔI STYLE
 */
function updateUIAfterLogin(username) {
  const ctaButton = document.getElementById("navbarCtaButton");
  currentUserUsername = username;
  
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

    // --- THAY ĐỔI CHÍNH ---
    // Gán sự kiện MỚI để MỞ dropdown (thay vì gọi handleLogout)
    ctaButton.onclick = (e) => {
      e.preventDefault();
      toggleProfileDropdown(); // Gọi hàm bật/tắt dropdown
    };
    // --- KẾT THÚC THAY ĐỔI ---
  }

  // Gán sự kiện cho nút "Đăng xuất" BÊN TRONG dropdown
  // (Phải chạy sau khi đăng nhập)
  const logoutButton = document.getElementById("dropdownLogoutButton");
  if (logoutButton) {
    logoutButton.onclick = (e) => {
      e.preventDefault();
      handleLogout(); // Gọi hàm logout gốc của bạn
    };
  }

  // --- BẮT ĐẦU STYLE MỚI KHI ĐĂNG NHẬB (Giữ nguyên code cũ của bạn) ---
  const heroTitle = document.querySelector(".hero-content h1");
  if (heroTitle) {
    heroTitle.innerHTML = `Chào mừng trở lại, <span class="highlight">${username}</span>!`;
  }
  const heroSubtitle = document.querySelector(".hero-content p");
  if (heroSubtitle) {
    heroSubtitle.textContent =
      "Bạn đã sẵn sàng cho buổi đánh giá tiếp theo, trò chuyện với AI hay kết nối với một chuyên gia chưa?";
  }
  document.querySelectorAll(".btn-connect:not(.btn-chat):not([disabled])").forEach((btn) => {
    btn.textContent = "Đặt lịch hẹn";
  });
  // --- KẾT THÚC STYLE MỚI ---
}

/* === THÊM 2 HÀM MỚI NÀY VÀO script.js === */

/**
 * HÀM MỚI: Bật/tắt dropdown
 */
function toggleProfileDropdown() {
  const dropdown = document.getElementById("profileDropdown");
  if (dropdown) {
    dropdown.classList.toggle("active");
  }
}

/**
 * HÀM MỚI: Đóng dropdown khi click ra ngoài
 */
window.addEventListener("click", function(event) {
  const ctaButton = document.getElementById("navbarCtaButton");
  const dropdown = document.getElementById("profileDropdown");

  if (!dropdown || !ctaButton) return; // Thoát nếu không tìm thấy element

  // Kiểm tra xem có đang click VÀO NÚT hoặc VÀO DROPDOWN không
  const isClickInside = ctaButton.contains(event.target) || dropdown.contains(event.target);

  if (!isClickInside) {
    dropdown.classList.remove("active"); // Nếu click ra ngoài, đóng lại
  }
});
/**
 * 3. Xử lý Đăng xuất
 */
async function handleLogout() {
  if (!confirm("Bạn có chắc chắn muốn đăng xuất?")) {
    return;
  }
  try {
    const response = await fetch("/api/logout", {
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
    const response = await fetch("/api/login", {
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
    ".btn-cta", // Lưu ý: Class này có thể bao gồm cả nút Navbar
    ".btn-primary", 
    ".btn-connect:not([disabled])", 
  ];

  ctaSelectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((btn) => {
      
      // [THÊM ĐOẠN NÀY] Kiểm tra: Nếu nút này là Navbar Button VÀ đã đổi thành "Xin chào..." 
      // thì ĐỪNG gán sự kiện mở modal nữa.
      if (btn.id === "navbarCtaButton" && btn.textContent.includes("Xin chào")) {
          return; 
      }

      // Nếu không phải trường hợp trên, gán sự kiện mở modal bình thường
      // Để tránh gán trùng lặp (nếu hàm này chạy nhiều lần), nên dùng onclick hoặc removeEventListener trước
      btn.onclick = function (e) {
        e.preventDefault();
        openLoginModal();
      };
    });
  });

  // Đoạn code cũ gán riêng cho Navbar (nếu có) cũng cần kiểm tra tương tự
  const navbarCta = document.getElementById("navbarCtaButton");
  if (navbarCta && !navbarCta.textContent.includes("Xin chào")) {
     navbarCta.onclick = (e) => {
      e.preventDefault();
      openLoginModal();
    };
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
  saveDass21Results(userAnswers, problemTags, scores);

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

/**
 * HÀM MỚI: Gửi kết quả DASS-21 lên server
 */
async function saveDass21Results(answers, tags, scores) {
  console.log("Đang lưu kết quả DASS-21...");
  try {
    const response = await fetch('/api/save-dass21-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers: answers,       // Mảng [0, 1, 2, ...]
        problem_tags: tags, // Mảng ['stress', 'lo_au']
        scores: scores          // Object {'D': 10, 'A': 8, 'S': 15}
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(data.message); // In ra "Kết quả đã được lưu."
    } else {
      console.error("Không thể lưu kết quả test.");
    }
  } catch (error) {
    console.error("Lỗi khi kết nối API lưu test:", error);
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
    const response = await fetch("/api/chat", {
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

// Thêm vào script.js

async function loadOldChatHistory() {
    const conversationId = getConversationId();
    try {
        // Gọi API mới tạo
        const response = await fetch(`/api/chat/history?conversationId=${conversationId}`);
        const data = await response.json();

        if (data.messages && data.messages.length > 0) {
            const messagesContainer = document.getElementById("chatMessages");
            // Xóa tin nhắn chào mặc định (nếu có)
            messagesContainer.innerHTML = ''; 
            
            data.messages.forEach(msg => {
                // msg.role là 'user' hoặc 'model' (của Gemini)
                // convert 'model' -> 'bot' để hàm UI hiểu
                const sender = msg.role === 'user' ? 'user' : 'bot';
                addMessageToChat(msg.text, sender);
            });
        }
    } catch (error) {
        console.error("Không thể tải lịch sử chat cũ:", error);
    }
}

// Gọi hàm này khi trang vừa load xong
document.addEventListener("DOMContentLoaded", function () {
    // ... các hàm init khác ...
    loadOldChatHistory(); // <--- THÊM DÒNG NÀY
});

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
/**
 * Hàm tìm chuyên gia từ tags (được gọi từ DASS-21 hoặc Chatbot)
 */
async function findCounselorsFromTags(tags) {
    // 1. Ẩn modal kết quả DASS-21 (nếu đang ở trang Test)
    const resultContainer = document.getElementById('result-container');
    const questionContainer = document.getElementById('question-container');
    
    // Nếu muốn reset giao diện test về ban đầu:
    // if(resultContainer) resultContainer.style.display = 'none';
    // if(questionContainer) questionContainer.style.display = 'block'; 
    // restartTest(); 

    // Hoặc đóng modal nếu DASS-21 nằm trong modal (tùy implementation của bạn)
    // closeTestResultModal(); 
     
    try {
        showLoadingModal("Hệ thống đang phân tích hồ sơ chuyên gia...");
          
        const response = await fetch("/api/match/find", {
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
            alert("Rất tiếc, hiện chưa tìm thấy chuyên gia phù hợp với tiêu chí cụ thể này. Bạn hãy thử xem danh sách tất cả chuyên gia nhé.");
            window.location.href = "/experts";
        }
          
    } catch (error) {
        console.error("Error finding counselors:", error);
        hideLoadingModal();
        alert("Có lỗi xảy ra khi kết nối server!");
    }
}

/**
 * Hiển thị modal kết quả matching
 */
function displayMatchingResults(data) {
    closeMatchingModal();

    const modalHTML = `
        <div class="matching-modal" id="matchingModal">
            <div class="matching-modal-content" style="max-width: 900px; width: 95%;">
                <span class="close-modal" onclick="closeMatchingModal()">&times;</span>
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: var(--primary);">Chuyên gia phù hợp cho bạn</h2>
                    <p class="detected-tags" style="background: #f3f4f6; display: inline-block; padding: 5px 15px; border-radius: 20px; margin-top: 10px;">
                        <i class="fas fa-search"></i> Vấn đề được phát hiện: 
                        <strong>${data.search_tags.map(tag => formatTag(tag)).join(', ')}</strong>
                    </p>
                </div>
                <div class="matching-results experts-grid" id="matchingResultsList" 
                     style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 25px; padding: 10px;">
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const container = document.getElementById('matchingResultsList');
    
    if (data.matches && data.matches.length > 0) {
        data.matches.forEach(counselor => {
            const card = document.createElement('div');
            card.className = 'expert-card';
            
            const expertId = counselor.username || counselor.id;
            card.setAttribute('data-expert-id', expertId);

            const coverImage = `https://picsum.photos/seed/${expertId}/400/200`;
            const isOnline = counselor.status === 'online';
            const statusClass = isOnline ? 'online' : 'offline';
            const statusText = isOnline ? 'Online' : 'Offline';
            
            // --- THAY ĐỔI: Luôn là nút Chat ---
            const btnText = 'Kết nối ngay'; // Có thể để Chat ngay cũng được
            const btnAction = `onclick="window.location.href='/user/chat?expert=${expertId}'"`;
            const btnClass = 'btn-connect btn-chat';
            // ----------------------------------

            const profileAction = `onclick="openExpertProfile('${expertId}')" style="cursor: pointer;"`;

            let specsHtml = '';
            if (Array.isArray(counselor.specialties)) {
                specsHtml = counselor.specialties.map(s => `<span class="specialty-tag">${formatTag(s)}</span>`).join('');
            } else {
                specsHtml = `<span class="specialty-tag">${formatTag(counselor.specialties)}</span>`;
            }
            const ratingVal = parseFloat(counselor.rating) || 0;
            const starsHtml = '<i class="fas fa-star" style="color: #fbbf24;"></i>'.repeat(Math.round(ratingVal));

            card.innerHTML = `
                <div class="expert-cover" style="background-image: url('${coverImage}');"></div>
                <div class="expert-info">
                    <div class="expert-avatar-wrapper" ${profileAction}>
                        <div class="expert-avatar-inner">${counselor.name.charAt(0)}</div>
                        <span class="status-dot ${statusClass}" style="position:absolute; bottom:5px; right:5px; width:14px; height:14px; border-radius:50%; border:2px solid white;"></span>
                    </div>
                    <h4 ${profileAction}>${counselor.name} <i class="fas fa-info-circle" style="font-size:0.8em; color:#aaa;"></i></h4>
                    <div style="margin: 5px 0;">
                        <span style="background: #ecfdf5; color: #059669; padding: 2px 8px; border-radius: 12px; font-size: 0.85rem; font-weight: bold; border: 1px solid #a7f3d0;">
                            <i class="fas fa-check-circle"></i> Phù hợp: ${counselor.match_score}%
                        </span>
                    </div>
                    <div style="margin: 5px 0;">
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="expert-rating" style="justify-content: center; margin-bottom: 5px;">
                        <div class="stars">${starsHtml}</div>
                        <span style="font-size: 0.85em; color:#666;">(${counselor.rating})</span>
                    </div>
                    <div style="font-size: 0.9rem; color: #666; margin-bottom: 15px; height: 40px; overflow: hidden;">
                        ${specsHtml}
                    </div>
                    <button class="${btnClass} btn-dynamic" ${btnAction} style="width: 100%;">
                        ${btnText}
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    } else {
        container.innerHTML = '<p style="text-align: center; width: 100%; color: #666;">Không tìm thấy chuyên gia phù hợp với tiêu chí này.</p>';
    }
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
      'tam_ly_xa_hoi': 'Tâm lý xã hội',
      'ap_luc_cong_viec': 'Áp lực công việc',
      'quan_he_gia_dinh': 'Quan hệ gia đình',
      'quan_he_tinh_cam': 'Quan hệ tình cảm',
      'ap_luc_xa_hoi': 'Áp lực xã hội',
      'ap_luc_thi_cu': 'Áp lực thi cử',
      'Tu_van_chung': 'Tư vấn chung'
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
          const response = await fetch(`/api/match/from-chat/${conversationId}`);
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
        'tab-history': 'user-view-history'   // Tab Lịch sử
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

// ==========================================
// LOGIC CHAT VỚI CHUYÊN GIA 
// ==========================================

// Biến toàn cục để giữ kết nối socket
let expertSocket = null;
let currentExpertRoom = null;
let currentUserUsername = null;

/**
 * 1. Hàm chính được gọi từ nút "Chat với chuyên gia"
 * (Hàm này cũng sửa lỗi cho 'connectToCounselor' chưa được định nghĩa)
 */
async function openChat(counselorUsername) {
  console.log(`Yêu cầu chat với: ${counselorUsername}`);
  
  // KIỂM TRA QUAN TRỌNG:
  // Nếu người dùng chưa đăng nhập, hàm initializeCTAListeners đã bắt
  // sự kiện click và mở modal đăng nhập. 
  // Hàm này chỉ chạy khi người dùng đã đăng nhập.

  try {
    showLoadingModal("Đang kiểm tra trạng thái chuyên gia...");
    
    // Giả định bạn có 1 API để check status
    // BẠN CẦN TẠO API NÀY Ở FLASK
    const response = await fetch(`/api/chat/check-expert-status?username=${counselorUsername}`);
    const data = await response.json();
    
    hideLoadingModal();

    if (response.ok && data.status === 'online') {
      // Nếu chuyên gia online -> Mở modal chat
      launchExpertChatModal(counselorUsername, data.expert_name || counselorUsername);
    } else {
      // Nếu chuyên gia offline
      alert("Chuyên gia hiện không online hoặc đang bận. Bạn vui lòng đặt lịch hẹn.");
    }

  } catch (error) {
    hideLoadingModal();
    console.error("Lỗi khi kiểm tra trạng thái chuyên gia:", error);
    alert("Không thể kết nối với chuyên gia. Vui lòng thử lại sau.");
  }
}

/**
 * 2. Hàm xử lý khi người dùng bấm "Kết nối" từ modal matching
 * (Đây là hàm bị thiếu trong code của bạn, giờ ta trỏ nó về openChat)
 */
function connectToCounselor(counselorId) {
    // counselorId ở đây chính là username (ví dụ: 'nvan')
    openChat(counselorId);
}


/**
 * 1. HÀM CHUẨN ĐỂ THÊM TIN NHẮN VÀO GIAO DIỆN
 * (Hàm này tạo cấu trúc <div class="message"><div class="bubble">...</div></div>)
 */
function addMessageToExpertChat(text, type) {
  // Lấy ID của khung chat chuyên gia
  const messagesContainer = document.getElementById("expertChatMessages");
  if (!messagesContainer) return;

  // 1. Tạo thẻ div.message cha
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${type}`; // vd: "message sent", "message received", "message system"

  // 2. Tạo "bong bóng" bên trong
  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = "bubble";
  bubbleDiv.textContent = text; // Gán nội dung tin nhắn

  // 3. Gắn bubble vào message
  messageDiv.appendChild(bubbleDiv);

  // 4. Gắn message vào khung chat
  messagesContainer.appendChild(messageDiv);

  // 5. Tự động cuộn xuống dưới cùng
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}


/**
 * 2. HÀM MỞ CỬA SỔ CHAT (Đã cập nhật)
 * (Hàm này phải XÓA tin nhắn cũ và THÊM tin nhắn 'system' đầu tiên)
 */
function launchExpertChatModal(counselorUsername, expertName) {
  const chatWindow = document.getElementById('expertChatWindow');
  if (!chatWindow) return;

  // Cập nhật tên chuyên gia
  document.getElementById('expertChatName').textContent = `Chat với ${expertName}`;
  chatWindow.classList.add('active'); 

  // --- Khởi tạo Socket.IO (Giữ nguyên logic của bạn) ---
  if (expertSocket) {
    expertSocket.disconnect();
  }
  expertSocket = io();
  currentExpertRoom = counselorUsername; 
  
  // Gán sự kiện cho form
  const chatForm = document.getElementById('expertChatForm');
  const chatInput = document.getElementById('expertChatInput');
  
  chatForm.onsubmit = function(e) {
    e.preventDefault();
    sendExpertMessage();
  };

  if (chatInput) {
      // Xóa các event cũ (nếu có) bằng cách gán lại
      chatInput.onkeypress = null; 
      
      chatInput.onkeydown = function(e) {
          if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendExpertMessage();
          }
      };
  }
  
  // Gán các listener cho socket
  setupSocketListeners();
}

/**
 * HÀM GỬI TIN NHẮN (User gửi)
 * CHỈ GỬI, KHÔNG HIỂN THỊ
 */
function sendExpertMessage() {
  const input = document.getElementById('expertChatInput');
  const messageText = input.value.trim();
  
  if (input) {
    input.addEventListener("keypress", handleChatInputKey);
  }

  if (messageText && expertSocket && currentExpertRoom) {
    // 1. Chỉ gửi tin nhắn lên server
    expertSocket.emit('send_expert_message', {
      room: currentExpertRoom,
      message: messageText
    });
    
    input.value = ''; // Xóa input
  }
}

/**
 * HÀM LẮNG NGHE SỰ KIỆN SOCKET (User nhận)
 * (Thay thế hàm setupSocketListeners hoặc on('receive_message') của bạn)
 */
function setupSocketListeners() {
  if (!expertSocket) return;

  expertSocket.on('connect', () => {
    expertSocket.emit('join_expert_chat', { room: currentExpertRoom });
  });

  expertSocket.on('receive_message', (data) => {
  
    // 2. Tin nhắn từ NGƯỜI DÙNG KHÁC (User khác chat cùng chuyên gia) -> BỎ QUA
    // Nếu sender là user, nhưng không phải là TÔI -> return
    if (data.sender_type === 'user' && data.sender_id !== currentUserUsername) {
        return; 
    }

    // 3. Tin nhắn từ CHUYÊN GIA gửi cho NGƯỜI KHÁC -> BỎ QUA
    // Nếu sender là counselor, nhưng target không phải TÔI -> return
    if (data.sender_type === 'counselor' && data.target_student_id && data.target_student_id !== currentUserUsername) {
        return;
    }

    // --- NẾU VƯỢT QUA CÁC BỘ LỌC TRÊN THÌ MỚI HIỂN THỊ ---

    if (data.sender_type === 'user') {
      // Tin nhắn của CHÍNH TÔI
      addMessageToExpertChat(data.text, 'sent'); 
    } 
    else if (data.sender_type === 'counselor') {
      // Tin nhắn của CHUYÊN GIA gửi cho TÔI
      addMessageToExpertChat(data.text, 'received'); 
    }
  });
}

// (Hàm 'addMessageToExpertChat' của bạn giữ nguyên, nó đã đúng)

/**
 * 5. HÀM ĐÓNG CỬA SỔ CHAT
 * (Giữ nguyên)
 */
function closeExpertChatModal() {
  const chatWindow = document.getElementById('expertChatWindow');
  if (chatWindow) {
    chatWindow.classList.remove('active');
  }
  
  if (expertSocket) {
    expertSocket.emit('leave_room', { room: currentExpertRoom });
    expertSocket.disconnect();
    expertSocket = null;
    currentExpertRoom = null;
  }
}

// =========================================================
// PHẦN 2: LOGIC DÀNH RIÊNG CHO CHUYÊN GIA (MESSENGER MODE)
// =========================================================

function initializeCounselorChat(expertUsername) {
    console.log("Khởi tạo Messenger cho chuyên gia:", expertUsername);

    // 1. Sử dụng lại biến expertSocket toàn cục đã khai báo ở trên
    // Nếu chưa có kết nối, tạo mới
    if (!expertSocket) {
        expertSocket = io();
    }

    let currentStudentId = null; 
    let chatsData = {}; 

    // 2. Kết nối và Join Room (Dùng sự kiện counselor_join_room)
    expertSocket.on('connect', () => {
        console.log("Expert socket connected");
        expertSocket.emit('counselor_join_room', { room: expertUsername });
    });

    // 3. Xử lý tin nhắn đến
    expertSocket.on('receive_message', (data) => {
        if (data.sender_type === 'system') return;

        // Xác định ID của sinh viên liên quan đến tin nhắn này
        let relatedStudentId = null;
        if (data.sender_type === 'user') {
            relatedStudentId = data.sender_id;
        } else if (data.sender_type === 'counselor' && data.target_student_id) {
            relatedStudentId = data.target_student_id;
        }

        if (relatedStudentId) {
            // Lưu tin nhắn
            saveMessageToLocal(relatedStudentId, data);

            // --- CẬP NHẬT LAST MESSAGE ---
            const previewText = data.sender_type === 'counselor' ? `Bạn: ${data.text}` : data.text;
            updateStudentPreview(relatedStudentId, previewText);

            // Nếu đang mở chat với sinh viên này -> Vẽ tin nhắn
            if (currentStudentId === relatedStudentId) {
                // Logic sent/received
                const type = (data.sender_type === 'counselor' || data.sender_id === expertUsername) ? 'sent' : 'received';
                addMessageToUI(data.text, type);
                scrollToBottom();
            } else {
                // Nếu không -> Hiện thông báo badge
                const badge = document.getElementById(`badge-${relatedStudentId}`);
                if (badge) {
                    let count = parseInt(badge.textContent) || 0;
                    badge.textContent = count + 1;
                    badge.classList.add('show');
                }
            }
        }
    });

    // 2. Xử lý Load History (Khi F5 trang)
    expertSocket.on('load_history', (history) => {
        // history là danh sách tất cả tin nhắn lộn xộn
        // Ta cần nhóm lại để biết tin nhắn cuối cùng của từng sinh viên
        
        // Reset data
        chatsData = {}; 
        const list = document.getElementById('studentList');
        if(list) list.innerHTML = ''; // Xóa danh sách cũ để render lại từ đầu

        // Duyệt qua lịch sử để xây dựng data
        history.forEach(msg => {
            let studentId = null;
            if (msg.sender_type === 'user') studentId = msg.sender_id;
            else if (msg.sender_type === 'counselor') studentId = msg.target_student_id;

            if (studentId) {
                saveMessageToLocal(studentId, msg);
            }
        });

        // Sau khi đã lưu hết vào chatsData, duyệt qua từng student để vẽ Sidebar
        Object.keys(chatsData).forEach(studentId => {
            const msgs = chatsData[studentId];
            const lastMsgObj = msgs[msgs.length - 1]; // Lấy tin cuối cùng
            
            let lastMsgText = "Chưa có tin nhắn";
            if (lastMsgObj) {
                lastMsgText = (lastMsgObj.sender_type === 'counselor') 
                    ? `Bạn: ${lastMsgObj.text}` 
                    : lastMsgObj.text;
            }

            // Thêm vào sidebar với lastMessage chuẩn
            addStudentToSidebar(studentId, lastMsgText);
        });

        expertSocket.on('connect', () => {
          console.log("Expert socket connected");
          // Đảm bảo luôn join lại room của chính mình khi kết nối lại
          expertSocket.emit('counselor_join_room', { room: expertUsername });
        });
    });

    // 4. Khi có User mới vào phòng (Backend emit 'show_chat_notification')
    expertSocket.on('show_chat_notification', (data) => {
        const studentId = data.username;
        // Tự động thêm vào sidebar nhưng chưa có tin nhắn
        if (!chatsData[studentId]) {
            chatsData[studentId] = [];
            addStudentToSidebar(studentId, "Đang chờ tin nhắn...");
            showNotification(studentId, "Đã tham gia phòng chat");
        }
    });

    expertSocket.on('load_history', (history) => {
        // history là mảng chứa tin nhắn của TẤT CẢ sinh viên chat với chuyên gia này
        history.forEach(msg => {
            let studentId = null;

            // Xác định tin nhắn này thuộc về hội thoại với sinh viên nào
            if (msg.sender_type === 'user') {
                studentId = msg.sender_id;
            } else if (msg.sender_type === 'counselor' && msg.target_student_id) {
                studentId = msg.target_student_id;
            }

            if (studentId) {
                // Lưu vào bộ nhớ local
                saveMessageToLocal(studentId, msg);
                
                // Nếu đang mở chat với sinh viên này thì render ra luôn
                if (currentStudentId === studentId) {
                    // Logic phân biệt sent/received
                    const type = (msg.sender_type === 'counselor') ? 'sent' : 'received';
                    addMessageToUI(msg.text, type); 
                }
            }
        });
      });

    // Hàm hiển thị thông báo nhỏ góc màn hình (Toast)
    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'custom-toast';
        toast.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
        document.body.appendChild(toast);

        // Xóa element khỏi DOM sau 2.5s (animation chạy 2s + 0.5s buffer)
        setTimeout(() => {
            toast.remove();
        }, 2500);
    }

    // Logic nút bấm Zoom
    const btnZoom = document.getElementById('meetingLink');
    if (btnZoom) {
        btnZoom.onclick = async function() {
            if (!currentStudentId) {
                showToast("⚠️ Vui lòng chọn người cần gửi link!");
                return;
            }

            // Hiển thị thông báo đang tạo
            showToast("⏳ Đang tạo phòng họp Zoom...");

            try {
                const res = await fetch("/create_meeting");
                const data = await res.json();

                if (data.join_url) {
                    // Tạo nội dung HTML đẹp mắt
                    const htmlContent = `
                        <div class="zoom-invite-card">
                            <div class="zoom-header">
                                <i class="fas fa-video"></i> Video Call
                            </div>
                            <div style="font-size: 0.9em; color: #555;">
                                Bác sĩ mời bạn tham gia cuộc họp trực tuyến.
                            </div>
                            <a href="${data.join_url}" target="_blank" class="zoom-btn">
                                Tham gia ngay
                            </a>
                        </div>
                    `;

                    // Gửi HTML qua Socket
                    expertSocket.emit('send_expert_message', {
                        room: expertUsername,
                        message: htmlContent, // Gửi cả cục HTML
                        target_student_id: currentStudentId
                    });

                    showToast("✅ Đã gửi link Zoom thành công!");
                    
                    // (Tùy chọn) Tự vẽ tin nhắn lên màn hình mình luôn nếu server không emit lại cho sender
                    // addMessageToUI(htmlContent, 'sent'); 

                } else {
                    showToast("❌ Không tạo được link Zoom.");
                }

            } catch (err) {
                console.error("Zoom error:", err);
                showToast("❌ Lỗi kết nối Server.");
            }
        };
    }

    // --- CÁC HÀM UI ---
    
    function saveMessageToLocal(studentId, msgData) {
        if (!chatsData[studentId]) {
            chatsData[studentId] = [];
            addStudentToSidebar(studentId, "Tin nhắn mới ...");
        }
        chatsData[studentId].push(msgData);
    }
        // --- Helper: Tạo màu ngẫu nhiên cho Avatar dựa trên tên ---
    function stringToColor(string) {
        let hash = 0;
        for (let i = 0; i < string.length; i++) {
            hash = string.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return '#' + '00000'.substring(0, 6 - c.length) + c;
    }

    // --- Helper: Tạo HTML Avatar ---
    function getAvatarHTML(username, size = 'normal') {
        const firstLetter = username.charAt(0).toUpperCase();
        const bgColor = stringToColor(username);
        // Nếu size nhỏ dùng cho tin nhắn, size lớn cho danh sách
        return `<div class="avatar-circle" style="background-color: ${bgColor};">${firstLetter}</div>`;
    }

    // --- Hàm hiển thị tin nhắn (Cập nhật logic cũ của bạn) ---
    function renderMessage(sender, text, isExpert = false) {
        const messageBox = document.getElementById('expertMessagesBox');
        
        const div = document.createElement('div');
        // Nếu là expert (mình) -> class 'sent', người dùng -> 'received'
        const typeClass = isExpert ? 'sent' : 'received';
        
        div.className = `message-row ${typeClass}`;
        
        // Tạo HTML: Avatar + Bubble
        // Lưu ý: với 'sent' avatar bị CSS ẩn đi, nhưng 'received' sẽ hiện
        const avatarHTML = getAvatarHTML(sender); 
        
        div.innerHTML = `
            ${!isExpert ? avatarHTML : ''} <div class="message-bubble">
                ${text}
            </div>
        `;

        messageBox.appendChild(div);
        messageBox.scrollTop = messageBox.scrollHeight; // Tự động cuộn xuống
    }


    // --- Ví dụ cách dùng trong logic Socket.IO của bạn ---
    // Giả sử bạn có sự kiện nhận tin nhắn từ server
    /*
    socket.on('receive_message', function(data) {
        // data.sender: tên người gửi
        // data.message: nội dung
        // currentExpertName: tên của chuyên gia đang đăng nhập

        const isMe = data.sender === currentExpertUsername; 
        renderMessage(data.sender, data.message, isMe);
    });
    */

    // --- Cập nhật danh sách sinh viên (Sidebar) ---
    function addStudentToSidebar(studentId, lastMessage = "Bắt đầu cuộc trò chuyện") {
      const list = document.getElementById('studentList');
      
      // Kiểm tra nếu đã tồn tại thì không thêm mới
      if (document.getElementById(`item-${studentId}`)) return;

      const li = document.createElement('li');
      li.className = 'student-item';
      li.id = `item-${studentId}`;
      
      // Gán sự kiện click
      li.onclick = () => selectStudent(studentId);

      // Xử lý hiển thị tin nhắn cuối cùng (cắt ngắn nếu quá dài)
      // const displayMsg = lastMessage.length > 30 ? lastMessage.substring(0, 30) + '...' : lastMessage;

      li.innerHTML = `
          ${getAvatarHTML(studentId)}
          <div style="flex: 1; min-width: 0;"> <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-weight: bold; font-size: 0.95rem;">${studentId}</span>
                  <span class="badge" id="badge-${studentId}">0</span>
              </div>
              <span class="student-preview" id="preview-${studentId}">${lastMessage}</span>
          </div>
      `;
      list.appendChild(li);
  }

    function showNotification(studentId, lastText) {
        const preview = document.getElementById(`preview-${studentId}`);
        if (preview) preview.textContent = lastText;

        const badge = document.getElementById(`badge-${studentId}`);
        if (badge) {
            let count = parseInt(badge.textContent) || 0;
            badge.textContent = count + 1;
            badge.classList.add('show');
        }
    }

    function updateStudentPreview(studentId, text) {
    const previewEl = document.getElementById(`preview-${studentId}`);
    if (previewEl) {
        // Nếu là tin nhắn ảnh hoặc HTML đặc biệt, bạn có thể thay đổi text hiển thị
        if (text.includes('<div class="zoom-invite-card"')) {
            previewEl.textContent = "📞 Cuộc gọi video...";
        } else {
            previewEl.textContent = text;
        }
    } else {
        // Nếu chưa có trong sidebar thì thêm mới
        addStudentToSidebar(studentId, text);
    }
}

    function selectStudent(studentId) {
      currentStudentId = studentId;
      
      // 1. Active UI (Đổi màu nền item được chọn)
      document.querySelectorAll('.student-item').forEach(el => el.classList.remove('active'));
      const activeItem = document.getElementById(`item-${studentId}`);
      if(activeItem) activeItem.classList.add('active');

      // 2. Reset Badge (Số tin nhắn chưa đọc) về 0
      const badge = document.getElementById(`badge-${studentId}`);
      if (badge) {
          badge.textContent = '0';
          badge.classList.remove('show');
      }

      // 3. Cập nhật Header Chat
      const header = document.getElementById('currentChatHeader');
      if(header) {
          header.innerHTML = `${getAvatarHTML(studentId)} <span style="margin-left:10px;">Chat với: <strong>${studentId}</strong></span>`;
      }

      // 4. HIỂN THỊ KHUNG NHẬP LIỆU (Load inputChat)
      const form = document.getElementById('expertReplyForm');
      if(form) {
          form.style.display = 'flex'; // Hiển thị form
          const input = document.getElementById('expertInput');
          if(input) input.focus(); // Tự động focus vào ô nhập
      }

      // 5. Render tin nhắn cũ
      renderMessages(studentId);
  }

    function renderMessages(studentId) {
        const container = document.getElementById('expertMessagesBox');
        if(!container) return;
        container.innerHTML = '';
        
        const messages = chatsData[studentId] || [];
        messages.forEach(msg => {
            // Logic phân biệt màu: counselor = sent, user = received
            const type = (msg.sender_type === 'counselor') ? 'sent' : 'received';
            addMessageToUI(msg.text, type);
        });
        scrollToBottom();
    }

    function addMessageToUI(text, type) {
        const container = document.getElementById('expertMessagesBox');
        if(!container) return;
        const div = document.createElement('div');
        div.className = `message ${type}`;
        div.innerHTML = `<div class="bubble">${text}</div>`;
        container.appendChild(div);
    }

    function scrollToBottom() {
        const container = document.getElementById('expertMessagesBox');
        if(container) container.scrollTop = container.scrollHeight;
    }

    // Gửi tin nhắn
    const replyForm = document.getElementById('expertReplyForm');
    if (replyForm) {
        replyForm.onsubmit = (e) => {
            e.preventDefault();
            const input = document.getElementById('expertInput');
            const text = input.value.trim();
            
            if (text && currentStudentId) {
                // Emit lên server
                expertSocket.emit('send_expert_message', {
                    room: expertUsername, // Room của chuyên gia
                    message: text,
                    target_student_id: currentStudentId
                    // Server session sẽ tự gắn sender_type='counselor'
                });
                input.value = '';
            }
        };
    }
}

// ==========================================
// --- 2. LẮNG NGHE SỰ KIỆN TỪ SERVER ---

function updateExpertStatusUI(username, status) {
    // Tìm tất cả thẻ card của chuyên gia này
    const cards = document.querySelectorAll(`.expert-card[data-expert-id="${username}"]`);
    const isOnline = status === 'online';
    const statusText = isOnline ? 'Online' : 'Offline';

    cards.forEach(card => {
        // Cập nhật chấm tròn
        const dot = card.querySelector('.status-dot');
        if (dot) dot.className = `status-dot ${status}`;

        // Cập nhật text badge
        const badge = card.querySelector('.status-badge');
        if (badge) {
            badge.className = `status-badge ${status}`;
            badge.textContent = statusText;
        }
        
        // (Không cần cập nhật nút Chat vì bạn đã yêu cầu luôn hiện nút Chat)
    });
}

// 3. Hàm tải trạng thái ban đầu (Chạy khi load trang)
async function refreshExpertStatusOnLoadAll() {
    try {
        // Gọi API lấy danh sách tất cả chuyên gia kèm trạng thái hiện tại
        const response = await fetch('/api/counselors/all');
        const data = await response.json();
        
        if (data.counselors) {
            data.counselors.forEach(c => {
                // Cập nhật UI ngay lập tức theo dữ liệu từ server
                updateExpertStatusUI(c.id, c.status);
            });
        }
    } catch (e) {
        console.error("Lỗi đồng bộ trạng thái:", e);
    }
}

function renderExpertCard(c, container) {
    const card = document.createElement('div');
    card.className = 'expert-card';
    card.setAttribute('data-expert-id', c.id);

    const coverImage = `https://picsum.photos/seed/${c.id}/400/200`;
    const isOnline = c.status === 'online';
    const statusClass = isOnline ? 'online' : 'offline';
    const statusText = isOnline ? 'Online' : 'Offline';

    const btnAction = `onclick="window.location.href='/user/chat?expert=${c.id}'"`;
    const profileAction = `onclick="openExpertProfile('${c.id}')" style="cursor: pointer;"`;

    let specs = c.specialties;
    if (typeof specs === 'string') specs = specs.split(',');
    else if (!Array.isArray(specs)) specs = ['Tư vấn chung'];
    const tagsHtml = specs.map(tag => `<span class="specialty-tag">${formatTag(tag.trim())}</span>`).join('');

    const rating = parseFloat(c.rating) || 0;
    const starsHtml = '<i class="fas fa-star" style="color: #fbbf24;"></i>'.repeat(Math.round(rating));

    card.innerHTML = `
        <div class="expert-cover" style="background-image: url('${coverImage}');"></div>
        
        <div class="expert-info1"> <div class="expert-avatar-wrapper" ${profileAction}>
                <div class="expert-avatar-inner">${c.name.charAt(0)}
                <span class="status-dot ${statusClass}"></span>
                </div>
            </div>
            
            <h4 ${profileAction}>${c.name} <i class="fas fa-info-circle" style="font-size:0.8em; color:#aaa;"></i></h4>
            
            <div style="margin: 5px 0;">
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>

            <div class="expert-rating" style="justify-content: center; margin-bottom: 5px;">
                <div class="stars">${starsHtml}</div>
                <span style="font-size: 0.85em; color:#666; margin-left: 5px;">(${rating})</span>
            </div>

            <div style="font-size: 0.9rem; color: #666; margin-bottom: 15px; height: 40px; overflow: hidden;">
                ${tagsHtml}
            </div>
            
            <button class="btn-connect btn-chat btn-dynamic" ${btnAction}>
                Chat ngay
            </button>
        </div>
    `;
    container.appendChild(card);
}

async function loadAvailableCounselors() {
    const container = document.getElementById('available-counselors-list');
    if (!container) return;

    container.innerHTML = '<div class="spinner"></div>';

    try {
        const res = await fetch('/api/counselors/availability');
        const data = await res.json();
        container.innerHTML = '';

        if (data.counselors && data.counselors.length > 0) {
            data.counselors.forEach(c => {
                renderExpertCard(c, container);
              });
        } else {
            container.innerHTML = '<p style="grid-column: span 3; text-align: center; color: #666;">Hiện chưa có chuyên gia nào cập nhật lịch rảnh.</p>';
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="color: red; text-align: center;">Lỗi tải dữ liệu.</p>';
    }
}

async function loadAllCounselorsPage() {
    const container = document.getElementById('all-experts-container');
    if (!container) return; 

    container.innerHTML = '<div class="spinner" style="grid-column: span 3; margin: 50px auto;"></div>';

    try {
        const response = await fetch('/api/counselors/all');
        const data = await response.json();
        container.innerHTML = ''; 

        if (data.counselors && data.counselors.length > 0) {
            data.counselors.forEach(c => {
                renderExpertCard(c, container);
            });
        } else {
            container.innerHTML = '<p style="grid-column: span 3; text-align: center; color: #666;">Chưa có chuyên gia nào.</p>';
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="color: red; text-align: center;">Lỗi tải dữ liệu.</p>';
    }
}

// --- LOGIC MODAL PROFILE CHUYÊN GIA ---

async function openExpertProfile(username) {
    const modal = document.getElementById('expertProfileModal');
    modal.setAttribute('data-current-expert', username);
    // Hiển thị loading nhẹ hoặc reset nội dung cũ
    document.getElementById('modalProfileCerts').innerHTML = '<p>Đang tải...</p>';
    
    try {
        const response = await fetch(`/api/counselor/${username}/profile`);
        if (!response.ok) throw new Error("Không thể tải thông tin");
        
        const data = await response.json();
        
        // 1. Điền thông tin cơ bản
        document.getElementById('modalProfileName').textContent = data.name;
        document.getElementById('modalProfileExp').textContent = `Kinh nghiệm: ${data.experience}`;
        
        // Rating
        const rating = Math.round(parseFloat(data.rating) || 0);
        document.getElementById('modalProfileRating').innerHTML = '<i class="fas fa-star"></i>'.repeat(rating);

        // 2. Điền Tags chuyên môn
        const specsContainer = document.getElementById('modalProfileSpecialties');
        let specs = data.specialties.split(',');
        specsContainer.innerHTML = specs.map(tag => 
            `<span class="specialty-tag">${formatTag(tag.trim())}</span>`
        ).join('');

        // 3. Điền nút hành động (Chat/Book)
        const btnChat = document.getElementById('modalBtnChat');
        const btnBook = document.getElementById('modalBtnBook');
        
        // Giả sử lấy status từ UI card bên ngoài (hoặc gọi API check status riêng nếu cần chính xác realtime)
        // Ở đây ta set cứng link, việc check online/offline sẽ do logic chat xử lý
        btnChat.onclick = () => window.location.href = `/user/chat?expert=${data.username}`;
        btnBook.onclick = () => {
            closeExpertProfileModal();
            checkAndOpenBooking(data.username);
        };

        // 4. LOAD ẢNH BẰNG CẤP TỪ FOLDER PAPERWORKS
        const certsContainer = document.getElementById('modalProfileCerts');
        certsContainer.innerHTML = '';
        
        if (data.cert_images && data.cert_images.length > 0) {
            data.cert_images.forEach(img => {
                const imgEl = document.createElement('img');
                imgEl.src = `/paperworks/${img}`;
                imgEl.style.width = '100%';
                imgEl.style.borderRadius = '8px';
                imgEl.style.border = '1px solid #ddd';
                imgEl.style.cursor = 'pointer';
                imgEl.onclick = () => window.open(imgEl.src, '_blank'); // Click để xem ảnh to
                certsContainer.appendChild(imgEl);
            });
        } else {
            certsContainer.innerHTML = '<p style="color:#666; font-style:italic;">Chưa cập nhật hình ảnh bằng cấp.</p>';
        }

        // Mở Modal
        if (modal) modal.classList.add('active');
        document.body.style.overflow = 'hidden';

    } catch (error) {
        console.error(error);
        alert("Lỗi khi tải hồ sơ chuyên gia.");
    }
}

function closeExpertProfileModal() {
    const modal = document.getElementById('expertProfileModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// Đóng modal khi click ra ngoài
document.getElementById('expertProfileModal')?.addEventListener('click', function(e) {
    if (e.target === this) closeExpertProfileModal();
});


async function loadHomeExperts() {
    const container = document.getElementById('home-experts-container');
    if (!container) return;

    container.innerHTML = '<div class="spinner" style="grid-column: span 3; margin: 50px auto;"></div>';

    try {
        const response = await fetch('/api/counselors/all');
        const data = await response.json();
        container.innerHTML = '';

        if (data.counselors && data.counselors.length > 0) {
            const top3Counselors = data.counselors.slice(0, 3);

            top3Counselors.forEach(c => {
                renderExpertCard(c, container);
            });
        } else {
            container.innerHTML = '<p style="grid-column: span 3; text-align: center; color: #666;">Chưa có chuyên gia nào.</p>';
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="color: red; text-align: center;">Lỗi tải dữ liệu.</p>';
    }
}