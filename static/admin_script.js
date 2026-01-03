// admin_script.js - Logic cho trang Admin Dashboard

// --- 1. Chức năng Đăng xuất ---
async function handleLogout() {
    if(confirm('Bạn có chắc chắn muốn đăng xuất khỏi trang Admin?')) {
        try {
            const response = await fetch('/api/logout', {method: 'POST'});
            if (response.ok) {
                window.location.href = '/'; 
            } else {
                alert("Lỗi khi đăng xuất");
            }
        } catch (error) {
            console.error("Logout error:", error);
        }
    }
}

// --- 2. Chức năng Duyệt (Approve) ---
async function approveExpert(btnElement, username) {
    if(confirm(`Xác nhận DUYỆT hồ sơ và nâng cấp tài khoản cho: ${username}?`)) {
        
        const originalText = btnElement.innerText;
        btnElement.innerText = "Đang xử lý...";
        btnElement.disabled = true;

        try {
            // Backend sẽ tự đọc file _meta.json để lấy Tags và Experience
            const response = await fetch('/api/admin/approve-expert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username })
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message);
                removeProfileCard(btnElement); // Xóa UI
            } else {
                alert("Lỗi: " + data.message);
                resetButton(btnElement, originalText);
            }
        } catch (error) {
            console.error("Lỗi approval:", error);
            alert("Đã xảy ra lỗi kết nối đến server.");
            resetButton(btnElement, originalText);
        }
    }
}

// --- 3. Chức năng Từ chối (Reject) ---
async function rejectExpert(btnElement, username) {
    const reason = prompt("Nhập lý do từ chối (để gửi thông báo):");
    if (reason === null) return; 

    const originalText = btnElement.innerText;
    btnElement.innerText = "Đang xóa...";
    btnElement.disabled = true;

    try {
        const response = await fetch('/api/admin/reject-expert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: username,
                reason: reason 
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            removeProfileCard(btnElement); // Xóa UI
        } else {
            alert("Lỗi: " + data.message);
            resetButton(btnElement, originalText);
        }

    } catch (error) {
        console.error("Lỗi reject:", error);
        alert("Lỗi kết nối server.");
        resetButton(btnElement, originalText);
    }
}

// --- 4. Các hàm tiện ích UI ---

function removeProfileCard(btnElement) {
    // Tìm thẻ cha chứa thông tin (tr hoặc div.profile-item)
    const cardToRemove = btnElement.closest('.profile-item') || btnElement.closest('tr');
    
    if (cardToRemove) {
        cardToRemove.style.transition = "opacity 0.5s";
        cardToRemove.style.opacity = "0";
        setTimeout(() => {
            cardToRemove.remove();
            checkEmptyState();
        }, 500);
    } else {
        window.location.reload();
    }
}

function resetButton(btn, text) {
    btn.innerText = text;
    btn.disabled = false;
}

function checkEmptyState() {
    const container = document.querySelector('.dashboard-content'); 
    // Kiểm tra xem còn thẻ profile-item nào không
    if (container && container.querySelectorAll('.profile-item').length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #666;">Hiện không có hồ sơ nào cần duyệt.</div>';
    }
}

// --- 5. [MỚI] Hàm load thông tin Metadata (Tags & Kinh nghiệm) ---
async function loadCandidateMetadata() {
    // Tìm tất cả các thẻ profile có thuộc tính data-username
    const items = document.querySelectorAll('.profile-item'); 
    
    items.forEach(async (item) => {
        const username = item.getAttribute('data-username');
        if (!username) return;

        try {
            // Fetch file JSON tương ứng trong thư mục uploads
            // URL này hoạt động nhờ route uploaded_file trong main.py
            const response = await fetch(`/uploads/${username}_meta.json`);
            
            if (response.ok) {
                const data = await response.json();
                
                // Tìm các element placeholder trong HTML để điền dữ liệu
                const expEl = item.querySelector('.meta-experience');
                const specEl = item.querySelector('.meta-specialties');
                const timeEl = item.querySelector('.meta-time');

                if (expEl) expEl.innerHTML = `<strong>Kinh nghiệm:</strong> <br> <strong>${data.experience}</strong>`;
                
                if (specEl) {
                    // Format lại tags cho đẹp (vd: lo_au -> Lo âu)
                    const formattedTags = data.specialties.split(',').map(tag => {
                        const dict = {'stress': 'Stress', 'lo_au': 'Lo âu', 'tram_cam': 'Trầm cảm', 'hoc_tap': 'Học tập', 'roi_loan_giac_ngu': 'Giấc ngủ', 'tam_ly_xa_hoi': 'Xã hội'};
                        return `<span class="tag-badge">${dict[tag] || tag}</span>`;
                    }).join(' ');
                    specEl.innerHTML = `<div style="margin-top:5px">${formattedTags}</div>`;
                }

                if (timeEl) timeEl.innerText = `Nộp lúc: ${data.submission_time}`;
            }
        } catch (err) {
            console.warn(`Chưa có metadata cho ${username} (có thể là hồ sơ cũ)`);
        }
    });
}

// --- 6. Khởi tạo (Event Listeners & Socket) ---
document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if(this.getAttribute('onclick')) return;
            navLinks.forEach(n => n.classList.remove('active'));
            this.classList.add('active');
        });
    });

    loadCandidateMetadata();

    const socket = io();
    socket.on('admin_refresh_signal', (data) => {
        console.log(`Dữ liệu thay đổi (${data.type}). Reloading...`);
        const notice = document.createElement('div');
        notice.style.cssText = "position:fixed; top:20px; right:20px; background:#2563eb; color:white; padding:10px 20px; border-radius:5px; z-index:9999;";
        notice.innerText = "Danh sách đang được cập nhật...";
        document.body.appendChild(notice);

        setTimeout(() => {
            window.location.reload();
        }, 1500);
    });
});