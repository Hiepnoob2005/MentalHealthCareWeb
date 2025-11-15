window.handleLogout = function() {
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

window.approveExpert = function(username) {
    if (!confirm(`Bạn có chắc chắn muốn DUYỆT hồ sơ của "${username}"?`)) return;
    
    fetch('/api/admin/approve', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username: username })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        if(data.success) window.location.reload();
    })
    .catch(err => alert("Lỗi: " + err));
}

window.rejectExpert = function(username) {
    if (!confirm(`Bạn có chắc chắn muốn TỪ CHỐI hồ sơ của "${username}"?`)) return;

    fetch('/api/admin/reject', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username: username })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        if(data.success) window.location.reload();
    })
    .catch(err => alert("Lỗi: " + err));
}