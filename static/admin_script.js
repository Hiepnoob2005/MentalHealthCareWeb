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

function approveExpert(username) {
    // Đây là nơi bạn sẽ gọi API để cập nhật database sau này
    // Hiện tại mình sẽ alert để demo luồng hoạt động
    if(confirm(`Xác nhận DUYỆT hồ sơ cho chuyên gia: ${username}?`)) {
        alert(`Đã duyệt thành công hồ sơ của ${username}!\n(Tính năng cập nhật DB sẽ được thêm ở phase sau)`);
        
        // Ẩn card đi để giả lập là đã xử lý xong
        // (Trong thực tế bạn sẽ reload trang hoặc xóa phần tử DOM)
    }
}

function rejectExpert(username) {
    const reason = prompt("Nhập lý do từ chối (để gửi mail thông báo):");
    if (reason) {
        alert(`Đã từ chối hồ sơ của ${username}.\nLý do: ${reason}`);
        // Gọi API từ chối tại đây
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