/* === NỘI DUNG CHO file static/profile.js === */

document.addEventListener('DOMContentLoaded', function() {
    
    // 1. Lấy các element
    const profileForm = document.getElementById('profileForm');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    const tagsContainer = document.getElementById('latestTagsContainer');
    const formMessage = document.getElementById('formMessage');

    // 2. Tải dữ liệu profile khi trang mở
    async function loadProfileData() {
        try {
            const response = await fetch('/api/profile');
            if (!response.ok) throw new Error('Không thể tải dữ liệu');
            
            const data = await response.json();
            
            // 2a. Điền thông tin vào form
            usernameInput.value = data.username;
            emailInput.value = data.email;
            phoneInput.value = data.phone;
            
            
            // 2b. Hiển thị tags
            tagsContainer.innerHTML = ''; // Xóa spinner
            if (data.latest_tags && data.latest_tags.length > 0 && data.latest_tags[0] !== 'none') {
                data.latest_tags.forEach(tag => {
                    const tagElement = document.createElement('span');
                    tagElement.className = 'issue-tag'; // Tái sử dụng class từ style.css
                    tagElement.textContent = formatTag(tag); // Dùng hàm format (nếu có)
                    tagsContainer.appendChild(tagElement);
                });
            } else {
                tagsContainer.innerHTML = '<p style="color: var(--gray);">Bạn chưa làm bài kiểm tra nào.</p>';
            }

        } catch (error) {
            console.error('Lỗi tải profile:', error);
            tagsContainer.innerHTML = '<p style_color="var(--danger);">Lỗi tải dữ liệu.</p>';
        }
    }

    // 3. Xử lý khi submit form
    profileForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        const email = emailInput.value;
        const phone = phoneInput.value;
        
        showMessage('Đang cập nhật...', 'loading');
        
        try {
            const response = await fetch('/api/profile/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, phone: phone })
            });

            const result = await response.json();
            
            if (response.ok) {
                showMessage(result.message, 'success');
            } else {
                throw new Error(result.message || 'Cập nhật thất bại');
            }
        } catch (error) {
            showMessage(error.message, 'error');
        }
    });

    // 4. Hàm hiển thị thông báo
    function showMessage(message, type) {
        formMessage.textContent = message;
        formMessage.className = `form-message ${type}`; // 'success', 'error', 'loading'
    }

    // 5. Hàm format tag (Tái sử dụng từ script.js)
    function formatTag(tag) {
        const tagNames = {
            'stress': 'Stress',
            'lo_au': 'Lo âu',
            'tram_cam': 'Trầm cảm',
            'hoc_tap': 'Học tập',
            'roi_loan_giac_ngu': 'Rối loạn giấc ngủ',
            'tam_ly_xa_hoi': 'Tâm lý xã hội'
            // Thêm các tag khác nếu cần
        };
        return tagNames[tag.trim()] || tag.trim(); // .trim() để xóa khoảng trắng
    }

    // Chạy hàm tải dữ liệu
    loadProfileData();
});