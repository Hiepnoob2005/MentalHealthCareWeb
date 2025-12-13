window.handleLogout = function () {
  if (confirm("Bạn có chắc chắn muốn đăng xuất?")) {
    // Giả định bạn có 1 API logout, nếu không hãy chuyển hướng
    // window.location.href = "/logout";

    fetch('/api/logout', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        alert(data.message || "Đã đăng xuất");
        window.location.href = "/"; // Chuyển về trang chủ
      })
      .catch(err => {
        console.error(err);
        window.location.href = "/";
      });
  }
}

async function approveExpert(username) {
    if(confirm(`Xác nhận DUYỆT hồ sơ cho chuyên gia: ${username}?`)) {
        try {
            const response = await fetch('/api/admin/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Tìm thẻ card của user này và xóa khỏi giao diện
                removeCardFromUI(username);
                alert("Đã duyệt thành công!");
            } else {
                alert("Lỗi: " + data.error);
            }
        } catch (e) {
            console.error(e);
            alert("Có lỗi xảy ra khi duyệt.");
        }
    }
}

async function rejectExpert(username) {
    const reason = prompt("Nhập lý do từ chối:");
    if (reason) {
        try {
            const response = await fetch('/api/admin/reject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, reason: reason })
            });
            
            const data = await response.json();
            
            if (data.success) {
                removeCardFromUI(username);
                alert("Đã từ chối hồ sơ.");
            }
        } catch (e) {
            console.error(e);
        }
    }
}

// Hàm phụ trợ để xóa Card khỏi giao diện mà không cần reload
function removeCardFromUI(username) {
    // Chúng ta cần tìm phần tử cha (request-card)
    // Cách đơn giản nhất: Duyệt qua các nút approve xem nút nào chứa onclick username đó
    const buttons = document.querySelectorAll('.btn-approve');
    buttons.forEach(btn => {
        if (btn.getAttribute('onclick').includes(username)) {
            // Button -> btn-group -> request-card (cấu trúc DOM của bạn)
            const card = btn.closest('.request-card'); 
            if (card) {
                card.style.transition = "all 0.5s ease";
                card.style.opacity = "0";
                card.style.transform = "translateX(50px)";
                setTimeout(() => card.remove(), 500); // Xóa sau khi hiệu ứng chạy xong
            }
        }
    });
    
    // Cập nhật số liệu thống kê (nếu muốn)
    const countEl = document.querySelector('.stat-value');
    if(countEl) countEl.innerText = parseInt(countEl.innerText) - 1;
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
