// admin_script.js - Logic riêng cho trang Admin

async function handleLogout() {
    if(confirm('Bạn có chắc chắn muốn đăng xuất khỏi trang Admin?')) {
        try {
            const response = await fetch('/api/logout', {method: 'POST'});
            if (response.ok) {
                window.location.href = '/'; // Quay về trang chủ sau khi logout
            } else {
                alert("Lỗi khi đăng xuất");
            }
        } catch (error) {
            console.error("Logout error:", error);
        }
    }
}



// Thêm tham số btnElement vào đầu hàm
async function approveExpert(btnElement, username) {
    if(confirm(`Xác nhận DUYỆT hồ sơ và nâng cấp tài khoản cho: ${username}?`)) {
        
        // Hiệu ứng UX: Disable nút và đổi text để người dùng biết đang xử lý
        const originalText = btnElement.innerText;
        btnElement.innerText = "Đang xử lý...";
        btnElement.disabled = true;

        try {
            // Gọi API Backend
            const response = await fetch('/api/admin/approve-expert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username: username })
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message);
                
                // --- PHẦN XÓA UI ---
                // Tìm thẻ cha bao quanh cái nút này (ví dụ: thẻ <tr> nếu là bảng, hoặc <div> class="card" nếu là thẻ)
                // Bạn có thể thay '.card' hoặc 'tr' tùy theo cấu trúc HTML của bạn
                const cardToRemove = btnElement.closest('.btn-group') || btnElement.closest('tr') || btnElement.closest('.profile-item');
                
                if (cardToRemove) {
                    // Hiệu ứng mờ dần trước khi xóa (Optional)
                    cardToRemove.style.transition = "opacity 0.5s";
                    cardToRemove.style.opacity = "0";
                    
                    setTimeout(() => {
                        cardToRemove.remove(); // Xóa hoàn toàn khỏi DOM
                        
                        // (Tùy chọn) Kiểm tra nếu hết danh sách thì hiện thông báo trống
                        const container = document.querySelector('.dashboard-content'); // Class bao quanh danh sách
                        if (container && container.children.length === 0) {
                            container.innerHTML = '<p>Hiện không có hồ sơ nào cần duyệt.</p>';
                        }
                    }, 500);
                } else {
                    // Fallback nếu không tìm thấy thẻ cha để xóa
                    window.location.reload();
                }
                
            } else {
                alert("Lỗi: " + data.message);
                // Nếu lỗi, trả lại trạng thái nút cũ
                btnElement.innerText = originalText;
                btnElement.disabled = false;
            }
        } catch (error) {
            console.error("Lỗi approval:", error);
            alert("Đã xảy ra lỗi kết nối đến server.");
            btnElement.innerText = originalText;
            btnElement.disabled = false;
        }
    }
}

async function rejectExpert(btnElement, username) {
    const reason = prompt("Nhập lý do từ chối (để gửi thông báo):");
    
    // Nếu người dùng bấm Cancel hoặc không nhập gì thì thôi
    if (reason === null) return; 

    // UX: Disable nút
    const originalText = btnElement.innerText;
    btnElement.innerText = "Đang xóa...";
    btnElement.disabled = true;

    try {
        const response = await fetch('/api/admin/reject-expert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                username: username,
                reason: reason 
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            
            // Xóa UI
            const cardToRemove = btnElement.closest('.btn-group') || btnElement.closest('tr') || btnElement.closest('.profile-item');
            if (cardToRemove) {
                cardToRemove.remove();
            } else {
                window.location.reload();
            }
        } else {
            alert("Lỗi: " + data.message);
            btnElement.innerText = originalText;
            btnElement.disabled = false;
        }

    } catch (error) {
        console.error("Lỗi reject:", error);
        alert("Lỗi kết nối server.");
        btnElement.innerText = originalText;
        btnElement.disabled = false;
    }
}

// Hiệu ứng active cho menu
document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if(this.getAttribute('onclick')) return; // Bỏ qua nút logout
            navLinks.forEach(n => n.classList.remove('active'));
            this.classList.add('active');
        });
    });
});

document.addEventListener('DOMContentLoaded', function() {
    // 1. Kết nối Socket.IO
    const socket = io();

    // 2. Lắng nghe tín hiệu reload từ server
    socket.on('admin_refresh_signal', (data) => {
        console.log(`Phát hiện thay đổi dữ liệu (${data.type}). Đang tải lại trang...`);

        setTimeout(() => {
            window.location.reload();
        }, 1000);
    });
});