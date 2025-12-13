// ==========================================
// LOGIC CHAT NGƯỜI DÙNG (Tách từ script.js cũ)
// ==========================================

// Biến toàn cục từ script.js cũ
let expertSocket = null;
let currentExpertRoom = null;
const currentUserUsername = window.currentUser ? window.currentUser.username : null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Kết nối Socket ngay khi vào trang
    initializeSocket();

    // 2. Tải danh sách chuyên gia (Sidebar)
    await loadExpertListForSidebar();

    // 3. Kiểm tra xem URL có yêu cầu chat với ai không (?expert=...)
    const urlParams = new URLSearchParams(window.location.search);
    const targetExpert = urlParams.get('expert');
    if (targetExpert) {
        // Cần tìm tên chuyên gia từ danh sách để hiển thị đẹp hơn, nếu không dùng tạm ID
        // Chúng ta đợi loadExpertListForSidebar chạy xong rồi mới tìm element
        setTimeout(() => {
             const expertItem = document.getElementById(`expert-item-${targetExpert}`);
             const expertName = expertItem ? expertItem.querySelector('.expert-name').textContent : targetExpert;
             openChat(targetExpert, expertName);
        }, 500); // Delay nhẹ để DOM kịp render
    }
});

// --- PHẦN 1: LOGIC KẾT NỐI & SOCKET (Giữ nguyên logic cũ) ---

function initializeSocket() {
    if (expertSocket) expertSocket.disconnect();
    
    // Kết nối đến server
    expertSocket = io("http://127.0.0.1:5000");

    expertSocket.on('connect', () => {
        console.log("Đã kết nối Socket!");
    });

    // Lắng nghe tin nhắn (Logic cũ của bạn)
    expertSocket.on('receive_message', (data) => {
        // 1. Tin nhắn hệ thống
        if (data.sender_type === 'system') {
            addMessageToExpertChat(data.text, 'system');
            return;
        }

        // 2. Bộ lọc tin nhắn (Logic từ script.js cũ)
        // Nếu là user khác gửi -> Bỏ qua
        if (data.sender_type === 'user' && data.sender_id !== currentUserUsername) {
            return;
        }
        // Nếu chuyên gia gửi cho người khác -> Bỏ qua
        if (data.sender_type === 'counselor' && data.target_student_id && data.target_student_id !== currentUserUsername) {
            return;
        }

        // 3. Hiển thị
        if (data.sender_type === 'user') {
            addMessageToExpertChat(data.text, 'sent'); // Tin của mình
        } else if (data.sender_type === 'counselor') {
            addMessageToExpertChat(data.text, 'received'); // Tin chuyên gia
        }

        if (currentExpertRoom) {
            console.log("Đang khôi phục kết nối vào phòng:", currentExpertRoom);
            expertSocket.emit('join_expert_chat', { room: currentExpertRoom });
        }
    });

    // [CẬP NHẬT] Tải lịch sử chat từ Server và xử lý hiển thị HTML
    expertSocket.on('load_history', (history) => {
        console.log("Đang tải lịch sử chat...", history);
        
        // Xóa sạch tin nhắn cũ trên giao diện trước khi load
        const container = document.getElementById("expertChatMessages");
        if (container) container.innerHTML = ''; 

        // Duyệt qua từng tin nhắn trong lịch sử
        history.forEach(msg => {
            let content = msg.text;

            // --- ĐIỀU KIỆN MỚI: Xử lý nếu tin nhắn chứa thẻ HTML (div) ---
            if (content && typeof content === 'string' && content.includes('<div')) {
                // 1. Loại bỏ dấu ngoặc kép bao quanh (nếu có)
                if (content.startsWith('"') && content.endsWith('"')) {
                    content = content.slice(1, -1);
                }
                
                // 2. Loại bỏ các ký tự escape do JSON tạo ra (ví dụ \" thành ")
                content = content.replace(/\\"/g, '"');
            }
            // ------------------------------------------------------------

            // Hiển thị tin nhắn
            if (msg.sender_type === 'user' && msg.sender_id === currentUserUsername) {
                addMessageToExpertChat(content, 'sent');
            }
            else if (msg.sender_type === 'counselor' && msg.target_student_id === currentUserUsername) {
                addMessageToExpertChat(content, 'received');
            }
        });
        
        // Cuộn xuống cuối
        if (container) container.scrollTop = container.scrollHeight;
    });
}

// --- PHẦN 2: LOGIC GIAO DIỆN (Điều chỉnh ID cho phù hợp HTML mới) ---

async function loadExpertListForSidebar() {
    try {
        // [THAY ĐỔI] Gọi API mới: Chỉ lấy người đã chat
        const res = await fetch('/api/user/chat-partners'); 
        const data = await res.json();
        const listEl = document.getElementById('expertList');
        listEl.innerHTML = '';

        let counselors = data.counselors || [];

        // --- XỬ LÝ LOGIC NGƯỜI MỚI (Từ trang chủ chuyển sang) ---
        const urlParams = new URLSearchParams(window.location.search);
        const targetExpertId = urlParams.get('expert');

        // Nếu có targetExpert từ URL mà chưa có trong danh sách đã chat
        if (targetExpertId && !counselors.find(c => c.id === targetExpertId)) {
            // Gọi API lấy thông tin chi tiết của người mới này để thêm vào list tạm
            try {
                // Chúng ta dùng lại API lấy all nhưng lọc phía client, 
                // hoặc tốt hơn là bạn viết API get-one-counselor. 
                // Ở đây dùng cách nhanh: fetch all rồi tìm.
                const allRes = await fetch('/api/counselors/all');
                const allData = await allRes.json();
                const newExpert = allData.counselors.find(c => c.id === targetExpertId);
                
                if (newExpert) {
                    // Thêm người mới vào đầu danh sách
                    counselors.unshift(newExpert);
                }
            } catch (err) {
                console.error("Không thể tải thông tin chuyên gia mới");
            }
        }
        // -------------------------------------------------------

        if (counselors.length > 0) {
            counselors.forEach(exp => {
                const li = document.createElement('li');
                li.className = 'expert-item';
                li.id = `expert-item-${exp.id}`;
                li.onclick = () => openChat(exp.id, exp.name);

                li.innerHTML = `
                    <div class="avatar">${exp.name.charAt(0)}</div>
                    <div class="info">
                        <div class="expert-name">${exp.name}</div>
                        <div class="expert-specialty">${exp.specialties}</div>
                    </div>
                `;
                listEl.appendChild(li);
            });
        } else {
            listEl.innerHTML = '<li class="loading-text">Bạn chưa có cuộc trò chuyện nào.</li>';
        }
    } catch (e) {
        console.error("Lỗi tải danh sách chuyên gia:", e);
        document.getElementById('expertList').innerHTML = '<li class="loading-text" style="color:red;">Lỗi kết nối.</li>';
    }
}
/**
 * Hàm openChat (Đã điều chỉnh từ script.js cũ để không mở modal)
 */
async function openChat(counselorUsername, expertName) {
    console.log(`Chuyển sang chat với: ${counselorUsername}`);
    
    // Cập nhật biến phòng chat
    currentExpertRoom = counselorUsername;

    // 1. Cập nhật Giao diện (Active Sidebar)
    document.querySelectorAll('.expert-item').forEach(el => el.classList.remove('active'));
    const activeItem = document.getElementById(`expert-item-${counselorUsername}`);
    if(activeItem) activeItem.classList.add('active');

    // 2. Cập nhật Header
    document.getElementById('currentExpertName').textContent = expertName || counselorUsername;
    document.getElementById('currentExpertStatus').textContent = "Đang kết nối...";
    document.getElementById('currentExpertAvatar').innerHTML = (expertName || counselorUsername).charAt(0);

    // 3. Hiển thị Form chat
    document.getElementById('expertChatForm').style.display = 'flex';
    document.getElementById('expertChatInput').focus();

    // 4. Xóa tin nhắn cũ trên màn hình
    const messagesContainer = document.getElementById("expertChatMessages");
    messagesContainer.innerHTML = '';

    // 5. Join Room (Logic cũ) -> Server sẽ tự động emit 'load_history' về sau khi join
    expertSocket.emit('join_expert_chat', { room: counselorUsername });
}

/**
 * Hàm thêm tin nhắn vào giao diện
 * [ĐÃ SỬA] Dùng innerHTML để hiển thị thẻ HTML (Zoom card)
 */
function addMessageToExpertChat(text, type) {
    const messagesContainer = document.getElementById("expertChatMessages");
    if (!messagesContainer) return;

    // Xóa empty state nếu có
    const emptyState = messagesContainer.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}`;

    const bubbleDiv = document.createElement("div");
    bubbleDiv.className = "bubble";
    
    // --- SỬA TẠI ĐÂY ---
    // Cũ: bubbleDiv.textContent = text; 
    // Mới: Dùng innerHTML để render thẻ <a>, <div>
    bubbleDiv.innerHTML = text; 
    // -------------------

    messageDiv.appendChild(bubbleDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Hàm gửi tin nhắn (Giữ logic cũ)
 */
function sendExpertMessage() {
    const input = document.getElementById('expertChatInput');
    const messageText = input.value.trim();

    if (messageText && expertSocket && currentExpertRoom) {
        // Emit lên server
        expertSocket.emit('send_expert_message', {
            room: currentExpertRoom,
            message: messageText
        });
        input.value = '';
    }
}

// Gán sự kiện cho Form gửi
const chatForm = document.getElementById('expertChatForm');
if (chatForm) {
    chatForm.onsubmit = (e) => {
        e.preventDefault();
        sendExpertMessage();
    };
}